import RopeSequence from "rope-sequence"
import {Mapping, Step, StepMap, Transform} from "lumenpage-transform"
import {Plugin, PluginKey} from "lumenpage-state"
import type {Command, EditorState, Transaction, SelectionBookmark} from "lumenpage-state"

// ProseMirror 的历史记录不仅仅是回滚到之前状态的方式
// 因为 ProseMirror 支持应用更改而不将其添加到历史记录中
// （例如在协作期间）
//
// 为此，每个"分支"（一个用于撤销历史，一个用于重做历史）
// 保留一个"项目"数组，可以选择性地保存一个步骤（实际可撤销的更改）
// 并始终保存一个位置映射（需要将其下方的更改移动到当前文档）
//
// 同时具有步骤和选区书签的项目是"事件"的开始
// — 一组将一次撤销或重做的更改。（它只存储书签
// 因为这样我们不必提供文档，直到实际应用选区
// 这在压缩时很有用）

// 用于调度历史压缩
const max_empty_items = 500

class Branch {
  constructor(readonly items: RopeSequence<Item>, readonly eventCount: number) {}

  // 从分支的历史记录中弹出最新事件并将其应用到文档转换
  popEvent(state: EditorState, preserveItems: boolean) {
    if (this.eventCount == 0) return null

    let end = this.items.length
    for (;; end--) {
      let next = this.items.get(end - 1)
      if (next.selection) { --end; break }
    }

    let remap: Mapping | undefined, mapFrom: number | undefined
    if (preserveItems) {
      remap = this.remapping(end, this.items.length)
      mapFrom = remap.maps.length
    }
    let transform = state.tr
    let selection: SelectionBookmark | undefined, remaining: Branch | undefined
    let addAfter: Item[] = [], addBefore: Item[] = []

    this.items.forEach((item, i) => {
      if (!item.step) {
        if (!remap) {
          remap = this.remapping(end, i + 1)
          mapFrom = remap.maps.length
        }
        mapFrom!--
        addBefore.push(item)
        return
      }

      if (remap) {
        addBefore.push(new Item(item.map))
        let step = item.step.map(remap.slice(mapFrom)), map

        if (step && transform.maybeStep(step).doc) {
          map = transform.mapping.maps[transform.mapping.maps.length - 1]
          addAfter.push(new Item(map, undefined, undefined, addAfter.length + addBefore.length))
        }
        mapFrom!--
        if (map) remap.appendMap(map, mapFrom)
      } else {
        transform.maybeStep(item.step)
      }

      if (item.selection) {
        selection = remap ? item.selection.map(remap.slice(mapFrom)) : item.selection
        remaining = new Branch(this.items.slice(0, end).append(addBefore.reverse().concat(addAfter)), this.eventCount - 1)
        return false
      }
    }, this.items.length, 0)

    return {remaining: remaining!, transform, selection: selection!}
  }

  // 创建一个添加了给定转换的新分支
  addTransform(transform: Transform, selection: SelectionBookmark | undefined,
               histOptions: Required<HistoryOptions>, preserveItems: boolean) {
    let newItems = [], eventCount = this.eventCount
    let oldItems = this.items, lastItem = !preserveItems && oldItems.length ? oldItems.get(oldItems.length - 1) : null

    for (let i = 0; i < transform.steps.length; i++) {
      let step = transform.steps[i].invert(transform.docs[i])
      let item = new Item(transform.mapping.maps[i], step, selection), merged
      if (merged = lastItem && lastItem.merge(item)) {
        item = merged
        if (i) newItems.pop()
        else oldItems = oldItems.slice(0, oldItems.length - 1)
      }
      newItems.push(item)
      if (selection) {
        eventCount++
        selection = undefined
      }
      if (!preserveItems) lastItem = item
    }
    let overflow = eventCount - histOptions.depth
    if (overflow > DEPTH_OVERFLOW) {
      oldItems = cutOffEvents(oldItems, overflow)
      eventCount -= overflow
    }
    return new Branch(oldItems.append(newItems), eventCount)
  }

  remapping(from: number, to: number): Mapping {
    let maps = new Mapping
    this.items.forEach((item, i) => {
      let mirrorPos = item.mirrorOffset != null && i - item.mirrorOffset >= from
          ? maps.maps.length - item.mirrorOffset : undefined
      maps.appendMap(item.map, mirrorPos)
    }, from, to)
    return maps
  }

  addMaps(array: readonly StepMap[]) {
    if (this.eventCount == 0) return this
    return new Branch(this.items.append(array.map(map => new Item(map))), this.eventCount)
  }

  // 当协作模块接收到远程更改时，历史记录必须知道这些更改
  // 以便它可以调整在远程更改之上变基的步骤
  // 并在其项目数组中包含远程更改的位置映射
  rebased(rebasedTransform: Transform, rebasedCount: number) {
    if (!this.eventCount) return this

    let rebasedItems: Item[] = [], start = Math.max(0, this.items.length - rebasedCount)

    let mapping = rebasedTransform.mapping
    let newUntil = rebasedTransform.steps.length
    let eventCount = this.eventCount
    this.items.forEach(item => { if (item.selection) eventCount-- }, start)

    let iRebased = rebasedCount
    this.items.forEach(item => {
      let pos = mapping.getMirror(--iRebased)
      if (pos == null) return
      newUntil = Math.min(newUntil, pos)
      let map = mapping.maps[pos]
      if (item.step) {
        let step = rebasedTransform.steps[pos].invert(rebasedTransform.docs[pos])
        let selection = item.selection && item.selection.map(mapping.slice(iRebased + 1, pos))
        if (selection) eventCount++
        rebasedItems.push(new Item(map, step, selection))
      } else {
        rebasedItems.push(new Item(map))
      }
    }, start)

    let newMaps = []
    for (let i = rebasedCount; i < newUntil; i++)
      newMaps.push(new Item(mapping.maps[i]))
    let items = this.items.slice(0, start).append(newMaps).append(rebasedItems)
    let branch = new Branch(items, eventCount)

    if (branch.emptyItemCount() > max_empty_items)
      branch = branch.compress(this.items.length - rebasedItems.length)
    return branch
  }

  emptyItemCount() {
    let count = 0
    this.items.forEach(item => { if (!item.step) count++ })
    return count
  }

  // 压缩分支意味着重写它以推出空气（仅映射项）
  // 在协作期间，这些自然会累积，因为每个远程更改都会添加一个
  // `upto` 参数用于确保只压缩给定级别以下的项目
  // 因为 `rebased` 依赖于一组干净、未触及的项目
  // 以便将旧项目与变基步骤关联
  compress(upto = this.items.length) {
    let remap = this.remapping(0, upto), mapFrom = remap.maps.length
    let items: Item[] = [], events = 0
    this.items.forEach((item, i) => {
      if (i >= upto) {
        items.push(item)
        if (item.selection) events++
      } else if (item.step) {
        let step = item.step.map(remap.slice(mapFrom)), map = step && step.getMap()
        mapFrom--
        if (map) remap.appendMap(map, mapFrom)
        if (step) {
          let selection = item.selection && item.selection.map(remap.slice(mapFrom))
          if (selection) events++
          let newItem = new Item(map!.invert(), step, selection), merged, last = items.length - 1
          if (merged = items.length && items[last].merge(newItem))
            items[last] = merged
          else
            items.push(newItem)
        }
      } else if (item.map) {
        mapFrom--
      }
    }, this.items.length, 0)
    return new Branch(RopeSequence.from(items.reverse()), events)
  }

  static empty = new Branch(RopeSequence.empty, 0)
}

function cutOffEvents(items: RopeSequence<Item>, n: number) {
  let cutPoint: number | undefined
  items.forEach((item, i) => {
    if (item.selection && (n-- == 0)) {
      cutPoint = i
      return false
    }
  })
  return items.slice(cutPoint!)
}

class Item {
  constructor(
    // 此项目的（正向）步骤映射
    readonly map: StepMap,
    // 反转的步骤
    readonly step?: Step,
    // 如果这不为 null，则此项目是组的开始
    // 此选区是组的起始选区（在应用第一步之前处于活动状态的选区）
    readonly selection?: SelectionBookmark,
    // 如果此项目是堆栈上先前映射的逆
    // 这指向逆的偏移量
    readonly mirrorOffset?: number
  ) {}

  merge(other: Item) {
    if (this.step && other.step && !other.selection) {
      let step = other.step.merge(this.step)
      if (step) return new Item(step.getMap().invert(), step, this.selection)
    }
  }
}

// 跟踪该状态的撤销/重做历史的状态字段的值
// 当历史插件处于活动状态时，将存储在插件状态中
class HistoryState {
  constructor(
    readonly done: Branch,
    readonly undone: Branch,
    readonly prevRanges: readonly number[] | null,
    readonly prevTime: number,
    readonly prevComposition: number
  ) {}
}

const DEPTH_OVERFLOW = 20

// 在撤销历史中记录转换
function applyTransaction(history: HistoryState, state: EditorState, tr: Transaction, options: Required<HistoryOptions>) {
  let historyTr = tr.getMeta(historyKey), rebased
  if (historyTr) return historyTr.historyState

  if (tr.getMeta(closeHistoryKey)) history = new HistoryState(history.done, history.undone, null, 0, -1)

  let appended = tr.getMeta("appendedTransaction")

  if (tr.steps.length == 0) {
    return history
  } else if (appended && appended.getMeta(historyKey)) {
    if (appended.getMeta(historyKey).redo)
      return new HistoryState(history.done.addTransform(tr, undefined, options, mustPreserveItems(state)),
                              history.undone, rangesFor(tr.mapping.maps),
                              history.prevTime, history.prevComposition)
    else
      return new HistoryState(history.done, history.undone.addTransform(tr, undefined, options, mustPreserveItems(state)),
                              null, history.prevTime, history.prevComposition)
  } else if (tr.getMeta("addToHistory") !== false && !(appended && appended.getMeta("addToHistory") === false)) {
    // 将快速连续发生的转换分组到一个事件中
    let composition = tr.getMeta("composition")
    let newGroup = history.prevTime == 0 ||
      (!appended && history.prevComposition != composition &&
       (history.prevTime < (tr.time || 0) - options.newGroupDelay || !isAdjacentTo(tr, history.prevRanges!)))
    let prevRanges = appended ? mapRanges(history.prevRanges!, tr.mapping) : rangesFor(tr.mapping.maps)
    return new HistoryState(history.done.addTransform(tr, newGroup ? state.selection.getBookmark() : undefined,
                                                      options, mustPreserveItems(state)),
                            Branch.empty, prevRanges, tr.time, composition == null ? history.prevComposition : composition)
  } else if (rebased = tr.getMeta("rebased")) {
    // 协作模块使用此方法告诉历史记录其某些内容已被变基
    return new HistoryState(history.done.rebased(tr, rebased),
                            history.undone.rebased(tr, rebased),
                            mapRanges(history.prevRanges!, tr.mapping), history.prevTime, history.prevComposition)
  } else {
    return new HistoryState(history.done.addMaps(tr.mapping.maps),
                            history.undone.addMaps(tr.mapping.maps),
                            mapRanges(history.prevRanges!, tr.mapping), history.prevTime, history.prevComposition)
  }
}

function isAdjacentTo(transform: Transform, prevRanges: readonly number[]) {
  if (!prevRanges) return false
  if (!transform.docChanged) return true
  let adjacent = false
  transform.mapping.maps[0].forEach((start, end) => {
    for (let i = 0; i < prevRanges.length; i += 2)
      if (start <= prevRanges[i + 1] && end >= prevRanges[i])
        adjacent = true
  })
  return adjacent
}

function rangesFor(maps: readonly StepMap[]) {
  let result: number[] = []
  for (let i = maps.length - 1; i >= 0 && result.length == 0; i--)
    maps[i].forEach((_from, _to, from, to) => result.push(from, to))
  return result
}

function mapRanges(ranges: readonly number[], mapping: Mapping) {
  if (!ranges) return null
  let result = []
  for (let i = 0; i < ranges.length; i += 2) {
    let from = mapping.map(ranges[i], 1), to = mapping.map(ranges[i + 1], -1)
    if (from <= to) result.push(from, to)
  }
  return result
}

// 将一个分支的最新事件应用到文档并将事件转移到另一个分支
function histTransaction(history: HistoryState, state: EditorState, redo: boolean): Transaction | null {
  let preserveItems = mustPreserveItems(state)
  let histOptions = (historyKey.get(state)!.spec as any).config as Required<HistoryOptions>
  let pop = (redo ? history.undone : history.done).popEvent(state, preserveItems)
  if (!pop) return null

  let selection = pop.selection!.resolve(pop.transform.doc)
  let added = (redo ? history.done : history.undone).addTransform(pop.transform, state.selection.getBookmark(),
                                                                  histOptions, preserveItems)

  let newHist = new HistoryState(redo ? added : pop.remaining, redo ? pop.remaining : added, null, 0, -1)
  return pop.transform.setSelection(selection).setMeta(historyKey, {redo, historyState: newHist})
}

let cachedPreserveItems = false, cachedPreserveItemsPlugins: readonly Plugin[] | null = null
// 检查给定状态中的任何插件是否有 historyPreserveItems 属性
// `historyPreserveItems` property in its spec, in which case we must
// preserve steps exactly as they came in, so that they can be
// rebased.
function mustPreserveItems(state: EditorState) {
  let plugins = state.plugins
  if (cachedPreserveItemsPlugins != plugins) {
    cachedPreserveItems = false
    cachedPreserveItemsPlugins = plugins
    for (let i = 0; i < plugins.length; i++) if ((plugins[i].spec as any).historyPreserveItems) {
      cachedPreserveItems = true
      break
    }
  }
  return cachedPreserveItems
}

/// Set a flag on the given transaction that will prevent further steps
/// from being appended to an existing history event (so that they
/// require a separate undo command to undo).
export function closeHistory(tr: Transaction) {
  return tr.setMeta(closeHistoryKey, true)
}

const historyKey = new PluginKey<HistoryState>("history")
const closeHistoryKey = new PluginKey("closeHistory")

interface HistoryOptions {
  /// The amount of history events that are collected before the
  /// oldest events are discarded. Defaults to 100.
  depth?: number

  /// The delay between changes after which a new group should be
  /// started. Defaults to 500 (milliseconds). Note that when changes
  /// aren't adjacent, a new group is always started.
  newGroupDelay?: number
}

/// Returns a plugin that enables the undo history for an editor. The
/// plugin will track undo and redo stacks, which can be used with the
/// [`undo`](#history.undo) and [`redo`](#history.redo) commands.
///
/// You can set an `"addToHistory"` [metadata
/// property](#state.Transaction.setMeta) of `false` on a transaction
/// to prevent it from being rolled back by undo.
export function history(config: HistoryOptions = {}): Plugin {
  config = {depth: config.depth || 100,
            newGroupDelay: config.newGroupDelay || 500}

  return new Plugin({
    key: historyKey,

    state: {
      init() {
        return new HistoryState(Branch.empty, Branch.empty, null, 0, -1)
      },
      apply(tr, hist, state) {
        return applyTransaction(hist, state, tr, config as Required<HistoryOptions>)
      }
    },

    config,

    props: {
      handleDOMEvents: {
        beforeinput(view, e: Event) {
          let inputType = (e as InputEvent).inputType
          let command = inputType == "historyUndo" ? undo : inputType == "historyRedo" ? redo : null
          if (!command || !view.editable) return false
          let state = view.state as EditorState | undefined
          let dispatch = view.dispatch as ((tr: Transaction) => void) | undefined
          if (!state || typeof dispatch != "function") return false
          e.preventDefault()
          return command(state, dispatch)
        }
      }
    }
  })
}

function buildCommand(redo: boolean, scroll: boolean): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    let hist: HistoryState | undefined = historyKey.getState(state)
    if (!hist || (redo ? hist.undone : hist.done).eventCount == 0) return false
    if (dispatch) {
      let tr = histTransaction(hist, state, redo)
      if (tr) dispatch(scroll ? tr.scrollIntoView() : tr)
    }
    return true
  }
}

/// A command function that undoes the last change, if any.
export const undo = buildCommand(false, true)

/// A command function that redoes the last undone change, if any.
export const redo = buildCommand(true, true)

/// A command function that undoes the last change. Don't scroll the
/// selection into view.
export const undoNoScroll = buildCommand(false, false)

/// A command function that redoes the last undone change. Don't
/// scroll the selection into view.
export const redoNoScroll = buildCommand(true, false)

/// The amount of undoable events available in a given state.
export function undoDepth(state: EditorState) {
  let hist = historyKey.getState(state)
  return hist ? hist.done.eventCount : 0
}

/// The amount of redoable events available in a given editor state.
export function redoDepth(state: EditorState) {
  let hist = historyKey.getState(state)
  return hist ? hist.undone.eventCount : 0
}

/// Returns true if the given transaction was generated by the history
/// plugin.
export function isHistoryTransaction(tr: Transaction) {
  return tr.getMeta(historyKey) != null
}
