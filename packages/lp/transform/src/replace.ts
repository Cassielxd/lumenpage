import {Fragment, Slice, Node, ResolvedPos, NodeType, ContentMatch, Attrs} from "lumenpage-model"

import {Step} from "./step"
import {ReplaceStep, ReplaceAroundStep} from "./replace_step"
import {Transform} from "./transform"
import {insertPoint} from "./structure"

/// ‘Fit’ a slice into a given position in the document, producing a
/// [step](#transform.Step) that inserts it. Will return null if
/// there's no meaningful way to insert the slice here, or inserting it
/// would be a no-op (an empty slice over an empty range).
export function replaceStep(doc: Node, from: number, to = from, slice = Slice.empty): Step | null {
  if (from == to && !slice.size) return null

  let $from = doc.resolve(from), $to = doc.resolve(to)
  // 优化 -- 如果明显不需要，则避免工作
  if (fitsTrivially($from, $to, slice)) return new ReplaceStep(from, to, slice)
  return new Fitter($from, $to, slice).fit()
}

function fitsTrivially($from: ResolvedPos, $to: ResolvedPos, slice: Slice) {
  return !slice.openStart && !slice.openEnd && $from.start() == $to.start() &&
    $from.parent.canReplace($from.index(), $to.index(), slice.content)
}

interface Fittable {
  sliceDepth: number
  frontierDepth: number
  parent: Node | null
  inject?: Fragment | null
  wrap?: readonly NodeType[]
}

// 将切片元素"放置"到间隙中的算法：
//
// 我们认为向左开放的每个节点的内容是可以独立放置的
// 即在 <p("foo"), p("bar")> 中，当左侧的段落开放时
// "foo" 可以独立于 p("bar") 放置（在替换间隙的左侧某处）
//
// 此类在以下属性中跟踪放置进度的状态：
//
//  - `frontier` 保存一个 `{type, match}` 对象的堆栈
//    表示替换的开放侧。它从 `$from` 开始
//    然后随着内容的放置向前移动，最后与 `$to` 协调
//
//  - `unplaced` 是一个表示尚未放置的内容的切片
//
//  - `placed` is a fragment of placed content. Its open-start value
//    is implicit in `$from`, and its open-end value in `frontier`.
class Fitter {
  frontier: {type: NodeType, match: ContentMatch}[] = []
  placed: Fragment = Fragment.empty

  constructor(
    readonly $from: ResolvedPos,
    readonly $to: ResolvedPos,
    public unplaced: Slice
  ) {
    for (let i = 0; i <= $from.depth; i++) {
      let node = $from.node(i)
      this.frontier.push({
        type: node.type,
        match: node.contentMatchAt($from.indexAfter(i))
      })
    }

    for (let i = $from.depth; i > 0; i--)
      this.placed = Fragment.from($from.node(i).copy(this.placed))
  }

  get depth() { return this.frontier.length - 1 }

  fit() {
    // 只要有未放置的内容，就尝试放置一些
    // 如果失败，要么增加未放置切片的开放分数
    // 要么从中删除节点，然后再试一次
    while (this.unplaced.size) {
      let fit = this.findFittable()
      if (fit) this.placeNodes(fit)
      else this.openMore() || this.dropNode()
    }
    // 当边界之后和 `this.$to` 之后直接有内联内容时
    // 我们必须生成一个 `ReplaceAround` 步骤，将该内容拉入边界之后的节点
    // 这意味着必须将拟合完成到 `this.$to` 之后的文本块节点的末尾
    // 而不是 `this.$to` 本身
    let moveInline = this.mustMoveInline(), placedSize = this.placed.size - this.depth - this.$from.depth
    let $from = this.$from, $to = this.close(moveInline < 0 ? this.$to : $from.doc.resolve(moveInline))
    if (!$to) return null

    // 如果成功关闭到 `$to`，创建一个步骤
    let content = this.placed, openStart = $from.depth, openEnd = $to.depth
    while (openStart && openEnd && content.childCount == 1) { // Normalize by dropping open parent nodes
      content = content.firstChild!.content
      openStart--; openEnd--
    }
    let slice = new Slice(content, openStart, openEnd)
    if (moveInline > -1)
      return new ReplaceAroundStep($from.pos, moveInline, this.$to.pos, this.$to.end(), slice, placedSize)
    if (slice.size || $from.pos != this.$to.pos) // Don't generate no-op steps
      return new ReplaceStep($from.pos, $to.pos, slice)
    return null
  }

  // 在 `this.unplaced` 的起始脊柱上找到一个位置
  // 该位置具有可以移动到边界某处的内容
  // 返回两个深度，一个用于切片，一个用于边界
  findFittable(): Fittable | undefined {
    let startDepth = this.unplaced.openStart
    for (let cur = this.unplaced.content, d = 0, openEnd = this.unplaced.openEnd; d < startDepth; d++) {
      let node = cur.firstChild!
      if (cur.childCount > 1) openEnd = 0
      if (node.type.spec.isolating && openEnd <= d) {
        startDepth = d
        break
      }
      cur = node.content
    }

    // 只有在没有包装的情况下找到位置失败后
    // 才尝试包装节点（第 2 遍）
    for (let pass = 1; pass <= 2; pass++) {
      for (let sliceDepth = pass == 1 ? startDepth : this.unplaced.openStart; sliceDepth >= 0; sliceDepth--) {
        let fragment, parent = null
        if (sliceDepth) {
          parent = contentAt(this.unplaced.content, sliceDepth - 1).firstChild
          fragment = parent!.content
        } else {
          fragment = this.unplaced.content
        }
        let first = fragment.firstChild
        for (let frontierDepth = this.depth; frontierDepth >= 0; frontierDepth--) {
          let {type, match} = this.frontier[frontierDepth], wrap, inject: Fragment | null = null
          // 在第 1 遍中，如果下一个节点匹配，或者没有下一个节点
          // 但父节点看起来兼容，我们就找到了一个位置
          if (pass == 1 && (first ? match.matchType(first.type) || (inject = match.fillBefore(Fragment.from(first), false))
                            : parent && type.compatibleContent(parent.type)))
            return {sliceDepth, frontierDepth, parent, inject}
          // 在第 2 遍中，寻找一组包装节点使 `first` 适合这里
          else if (pass == 2 && first && (wrap = match.findWrapping(first.type)))
            return {sliceDepth, frontierDepth, parent, wrap}
          // 如果父节点适合这里，不要继续向上查找
          if (parent && match.matchType(parent.type)) break
        }
      }
    }
  }

  openMore() {
    let {content, openStart, openEnd} = this.unplaced
    let inner = contentAt(content, openStart)
    if (!inner.childCount || inner.firstChild!.isLeaf) return false
    this.unplaced = new Slice(content, openStart + 1,
                              Math.max(openEnd, inner.size + openStart >= content.size - openEnd ? openStart + 1 : 0))
    return true
  }

  dropNode() {
    let {content, openStart, openEnd} = this.unplaced
    let inner = contentAt(content, openStart)
    if (inner.childCount <= 1 && openStart > 0) {
      let openAtEnd = content.size - openStart <= openStart + inner.size
      this.unplaced = new Slice(dropFromFragment(content, openStart - 1, 1), openStart - 1,
                                openAtEnd ? openStart - 1 : openEnd)
    } else {
      this.unplaced = new Slice(dropFromFragment(content, openStart, 1), openStart, openEnd)
    }
  }

  // 将内容从 `sliceDepth` 处的未放置切片移动到
  // `frontierDepth` 处的边界节点。在适用时关闭该边界节点
  placeNodes({sliceDepth, frontierDepth, parent, inject, wrap}: Fittable) {
    while (this.depth > frontierDepth) this.closeFrontierNode()
    if (wrap) for (let i = 0; i < wrap.length; i++) this.openFrontierNode(wrap[i])

    let slice = this.unplaced, fragment = parent ? parent.content : slice.content
    let openStart = slice.openStart - sliceDepth
    let taken = 0, add = []
    let {match, type} = this.frontier[frontierDepth]
    if (inject) {
      for (let i = 0; i < inject.childCount; i++) add.push(inject.child(i))
      match = match.matchFragment(inject)!
    }
    // 计算片段末尾的（结束）开放节点数量
    // 当为 0 时，父节点是开放的，但不再有更多
    // 当为负数时，没有任何节点是开放的
    let openEndCount = (fragment.size + sliceDepth) - (slice.content.size - slice.openEnd)
    // 扫描片段，尽可能多地拟合子节点
    while (taken < fragment.childCount) {
      let next = fragment.child(taken), matches = match.matchType(next.type)
      if (!matches) break
      taken++
      if (taken > 1 || openStart == 0 || next.content.size) { // Drop empty open nodes
        match = matches
        add.push(closeNodeStart(next.mark(type.allowedMarks(next.marks)), taken == 1 ? openStart : 0,
                                taken == fragment.childCount ? openEndCount : -1))
      }
    }
    let toEnd = taken == fragment.childCount
    if (!toEnd) openEndCount = -1

    this.placed = addToFragment(this.placed, frontierDepth, Fragment.from(add))
    this.frontier[frontierDepth].match = match

    // 如果父类型匹配，并且整个节点已移动，并且它未开放
    // 立即关闭此边界节点
    if (toEnd && openEndCount < 0 && parent && parent.type == this.frontier[this.depth].type && this.frontier.length > 1)
      this.closeFrontierNode()

    // 为末尾的任何开放节点添加新的边界节点
    for (let i = 0, cur = fragment; i < openEndCount; i++) {
      let node = cur.lastChild!
      this.frontier.push({type: node.type, match: node.contentMatchAt(node.childCount)})
      cur = node.content
    }

    // 更新 `this.unplaced`。如果我们到达了节点的末尾
    // 则删除我们从中放置的整个节点，否则只删除已放置的节点
    this.unplaced = !toEnd ? new Slice(dropFromFragment(slice.content, sliceDepth, taken), slice.openStart, slice.openEnd)
      : sliceDepth == 0 ? Slice.empty
      : new Slice(dropFromFragment(slice.content, sliceDepth - 1, 1),
                  sliceDepth - 1, openEndCount < 0 ? slice.openEnd : sliceDepth - 1)
  }

  mustMoveInline() {
    if (!this.$to.parent.isTextblock) return -1
    let top = this.frontier[this.depth], level
    if (!top.type.isTextblock || !contentAfterFits(this.$to, this.$to.depth, top.type, top.match, false) ||
        (this.$to.depth == this.depth && (level = this.findCloseLevel(this.$to)) && level.depth == this.depth)) return -1

    let {depth} = this.$to, after = this.$to.after(depth)
    while (depth > 1 && after == this.$to.end(--depth)) ++after
    return after
  }

  findCloseLevel($to: ResolvedPos) {
    scan: for (let i = Math.min(this.depth, $to.depth); i >= 0; i--) {
      let {match, type} = this.frontier[i]
      let dropInner = i < $to.depth && $to.end(i + 1) == $to.pos + ($to.depth - (i + 1))
      let fit = contentAfterFits($to, i, type, match, dropInner)
      if (!fit) continue
      for (let d = i - 1; d >= 0; d--) {
        let {match, type} = this.frontier[d]
        let matches = contentAfterFits($to, d, type, match, true)
        if (!matches || matches.childCount) continue scan
      }
      return {depth: i, fit, move: dropInner ? $to.doc.resolve($to.after(i + 1)) : $to}
    }
  }

  close($to: ResolvedPos) {
    let close = this.findCloseLevel($to)
    if (!close) return null

    while (this.depth > close.depth) this.closeFrontierNode()
    if (close.fit.childCount) this.placed = addToFragment(this.placed, close.depth, close.fit)
    $to = close.move
    for (let d = close.depth + 1; d <= $to.depth; d++) {
      let node = $to.node(d), add = node.type.contentMatch.fillBefore(node.content, true, $to.index(d))!
      this.openFrontierNode(node.type, node.attrs, add)
    }
    return $to
  }

  openFrontierNode(type: NodeType, attrs: Attrs | null = null, content?: Fragment) {
    let top = this.frontier[this.depth]
    top.match = top.match.matchType(type)!
    this.placed = addToFragment(this.placed, this.depth, Fragment.from(type.create(attrs, content)))
    this.frontier.push({type, match: type.contentMatch})
  }

  closeFrontierNode() {
    let open = this.frontier.pop()!
    let add = open.match.fillBefore(Fragment.empty, true)!
    if (add.childCount) this.placed = addToFragment(this.placed, this.frontier.length, add)
  }
}

function dropFromFragment(fragment: Fragment, depth: number, count: number): Fragment {
  if (depth == 0) return fragment.cutByIndex(count, fragment.childCount)
  return fragment.replaceChild(0, fragment.firstChild!.copy(dropFromFragment(fragment.firstChild!.content, depth - 1, count)))
}

function addToFragment(fragment: Fragment, depth: number, content: Fragment): Fragment {
  if (depth == 0) return fragment.append(content)
  return fragment.replaceChild(fragment.childCount - 1,
                               fragment.lastChild!.copy(addToFragment(fragment.lastChild!.content, depth - 1, content)))
}

function contentAt(fragment: Fragment, depth: number) {
  for (let i = 0; i < depth; i++) fragment = fragment.firstChild!.content
  return fragment
}

function closeNodeStart(node: Node, openStart: number, openEnd: number) {
  if (openStart <= 0) return node
  let frag = node.content
  if (openStart > 1)
    frag = frag.replaceChild(0, closeNodeStart(frag.firstChild!, openStart - 1, frag.childCount == 1 ? openEnd - 1 : 0))
  if (openStart > 0) {
    frag = node.type.contentMatch.fillBefore(frag)!.append(frag)
    if (openEnd <= 0) frag = frag.append(node.type.contentMatch.matchFragment(frag)!.fillBefore(Fragment.empty, true)!)
  }
  return node.copy(frag)
}

function contentAfterFits($to: ResolvedPos, depth: number, type: NodeType, match: ContentMatch, open: boolean) {
  let node = $to.node(depth), index = open ? $to.indexAfter(depth) : $to.index(depth)
  if (index == node.childCount && !type.compatibleContent(node.type)) return null
  let fit = match.fillBefore(node.content, true, index)
  return fit && !invalidMarks(type, node.content, index) ? fit : null
}

function invalidMarks(type: NodeType, fragment: Fragment, start: number) {
  for (let i = start; i < fragment.childCount; i++)
    if (!type.allowsMarks(fragment.child(i).marks)) return true
  return false
}

function definesContent(type: NodeType) {
  return type.spec.defining || type.spec.definingForContent
}

export function replaceRange(tr: Transform, from: number, to: number, slice: Slice) {
  if (!slice.size) return tr.deleteRange(from, to)

  let $from = tr.doc.resolve(from), $to = tr.doc.resolve(to)
  if (fitsTrivially($from, $to, slice))
    return tr.step(new ReplaceStep(from, to, slice))

  let targetDepths = coveredDepths($from, $to)
  // 无法替换整个文档，因此如果存在 0 则将其删除
  if (targetDepths[targetDepths.length - 1] == 0) targetDepths.pop()
  // 负数表示不是在该深度扩展整个节点
  // 而是从 $from.before(-D) 替换到 $to.pos
  let preferredTarget = -($from.depth + 1)
  targetDepths.unshift(preferredTarget)
  // 此循环选择首选目标深度，如果其中一个覆盖深度
  // 不在定义节点之外，并为任何在其开始处具有 $from
  // 且不跨越定义节点的深度添加负深度
  for (let d = $from.depth, pos = $from.pos - 1; d > 0; d--, pos--) {
    let spec = $from.node(d).type.spec
    if (spec.defining || spec.definingAsContext || spec.isolating) break
    if (targetDepths.indexOf(d) > -1) preferredTarget = d
    else if ($from.before(d) == pos) targetDepths.splice(1, 0, -d)
  }
  // 尝试将切片的每个可能深度拟合到每个可能的目标深度
  // 从首选深度开始
  let preferredTargetIndex = targetDepths.indexOf(preferredTarget)

  let leftNodes: Node[] = [], preferredDepth = slice.openStart
  for (let content = slice.content, i = 0;; i++) {
    let node = content.firstChild!
    leftNodes.push(node)
    if (i == slice.openStart) break
    content = node.content
  }

  // 回退 preferredDepth 以直接覆盖定义文本块
  // above it, possibly skipping a non-defining textblock.
  for (let d = preferredDepth - 1; d >= 0; d--) {
    let leftNode = leftNodes[d], def = definesContent(leftNode.type)
    if (def && !leftNode.sameMarkup($from.node(Math.abs(preferredTarget) - 1))) preferredDepth = d
    else if (def || !leftNode.type.isTextblock) break
  }

  for (let j = slice.openStart; j >= 0; j--) {
    let openDepth = (j + preferredDepth + 1) % (slice.openStart + 1)
    let insert = leftNodes[openDepth]
    if (!insert) continue
    for (let i = 0; i < targetDepths.length; i++) {
      // 循环遍历可能的扩展级别，从首选级别开始
      let targetDepth = targetDepths[(i + preferredTargetIndex) % targetDepths.length], expand = true
      if (targetDepth < 0) { expand = false; targetDepth = -targetDepth }
      let parent = $from.node(targetDepth - 1), index = $from.index(targetDepth - 1)
      if (parent.canReplaceWith(index, index, insert.type, insert.marks))
        return tr.replace($from.before(targetDepth), expand ? $to.after(targetDepth) : to,
                            new Slice(closeFragment(slice.content, 0, slice.openStart, openDepth),
                                      openDepth, slice.openEnd))
    }
  }

  let startSteps = tr.steps.length
  for (let i = targetDepths.length - 1; i >= 0; i--) {
    tr.replace(from, to, slice)
    if (tr.steps.length > startSteps) break
    let depth = targetDepths[i]
    if (depth < 0) continue
    from = $from.before(depth); to = $to.after(depth)
  }
}

function closeFragment(fragment: Fragment, depth: number, oldOpen: number, newOpen: number, parent?: Node) {
  if (depth < oldOpen) {
    let first = fragment.firstChild!
    fragment = fragment.replaceChild(0, first.copy(closeFragment(first.content, depth + 1, oldOpen, newOpen, first)))
  }
  if (depth > newOpen) {
    let match = parent!.contentMatchAt(0)!
    let start = match.fillBefore(fragment)!.append(fragment)
    fragment = start.append(match.matchFragment(start)!.fillBefore(Fragment.empty, true)!)
  }
  return fragment
}

export function replaceRangeWith(tr: Transform, from: number, to: number, node: Node) {
  if (!node.isInline && from == to && tr.doc.resolve(from).parent.content.size) {
    let point = insertPoint(tr.doc, from, node.type)
    if (point != null) from = to = point
  }
  tr.replaceRange(from, to, new Slice(Fragment.from(node), 0, 0))
}

export function deleteRange(tr: Transform, from: number, to: number) {
  let $from = tr.doc.resolve(from), $to = tr.doc.resolve(to)
  let covered = coveredDepths($from, $to)
  for (let i = 0; i < covered.length; i++) {
    let depth = covered[i], last = i == covered.length - 1
    if ((last && depth == 0) || $from.node(depth).type.contentMatch.validEnd)
      return tr.delete($from.start(depth), $to.end(depth))
    if (depth > 0 && (last || $from.node(depth - 1).canReplace($from.index(depth - 1), $to.indexAfter(depth - 1))))
      return tr.delete($from.before(depth), $to.after(depth))
  }
  for (let d = 1; d <= $from.depth && d <= $to.depth; d++) {
    if (from - $from.start(d) == $from.depth - d && to > $from.end(d) && $to.end(d) - to != $to.depth - d &&
        $from.start(d - 1) == $to.start(d - 1) && $from.node(d - 1).canReplace($from.index(d - 1), $to.index(d - 1)))
      return tr.delete($from.before(d), to)
  }
  tr.delete(from, to)
}

// 返回 $from - $to 跨越该深度节点的整个内容的所有深度的数组
function coveredDepths($from: ResolvedPos, $to: ResolvedPos) {
  let result: number[] = [], minDepth = Math.min($from.depth, $to.depth)
  for (let d = minDepth; d >= 0; d--) {
    let start = $from.start(d)
    if (start < $from.pos - ($from.depth - d) ||
        $to.end(d) > $to.pos + ($to.depth - d) ||
        $from.node(d).type.spec.isolating ||
        $to.node(d).type.spec.isolating) break
    if (start == $to.start(d) ||
        (d == $from.depth && d == $to.depth && $from.parent.inlineContent && $to.parent.inlineContent &&
         d && $to.start(d - 1) == start - 1))
      result.push(d)
  }
  return result
}
