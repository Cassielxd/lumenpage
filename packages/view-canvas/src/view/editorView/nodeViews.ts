import { NodeSelection } from "lumenpage-state";
import { docPosToTextOffset } from "../../core";
import { resolveNodeSelectionDecision } from "./selectionPolicy";

import { getLineAtOffset } from "../layoutIndex";
import { collectAllLayoutBoxesForRange, resolveLayoutBoxRect } from "../render/geometry";

// NodeView manager.
export const createNodeViewManager = ({
  view,
  getState,
  nodeRegistry,
  getNodeViewFactories,
  getDecorations,
  getDefaultNodeSelectionTypes,
  logNodeSelection,
}) => {
  const nodeViews = new Map();
  const nodeViewsByBlockId = new Map();
  let selectedNodeViewKey = null;
  let skipNextClickSelection = false;
  let lastVisibleOverlayKeys = new Set();
  const docTopLevelBlockIndexCache = new WeakMap();
  const getDocTopLevelBlockIndex = (doc) => {
    const cached = docTopLevelBlockIndexCache.get(doc);
    if (cached) {
      return cached;
    }
    const byId = new Map();
    doc?.forEach?.((node, pos, index) => {
      const blockId = node?.attrs?.id ?? null;
      if (!blockId) {
        return;
      }
      byId.set(blockId, { node, pos, index });
    });
    const next = { byId };
    docTopLevelBlockIndexCache.set(doc, next);
    return next;
  };
  const lineHasTextContent = (line) => {
    if (!line) {
      return false;
    }
    if (typeof line.text === "string" && line.text.length > 0) {
      return true;
    }
    if (Array.isArray(line.runs)) {
      for (const run of line.runs) {
        if (typeof run?.text === "string" && run.text.length > 0) {
          return true;
        }
      }
    }
    return false;
  };

  const getPreferredBlockIdFromLine = (line) => {
    if (line?.blockId) {
      return line.blockId;
    }
    const owners = Array.isArray(line?.fragmentOwners) ? line.fragmentOwners : [];
    for (let index = owners.length - 1; index >= 0; index -= 1) {
      const owner = owners[index];
      if (owner?.blockId != null) {
        return owner.blockId;
      }
      if (owner?.nodeId != null) {
        return owner.nodeId;
      }
    }
    return null;
  };

  const getNodeViewKey = (node, pos) => {
    const id = node?.attrs?.id;
    if (id) {
      return `${node.type.name}:${id}`;
    }
    return `${node.type.name}:${pos}`;
  };

  const resolveNodeViewEntry = (nodeView) => {
    if (!nodeView) {
      return null;
    }
    for (const entry of nodeViews.values()) {
      if (entry.view === nodeView) {
        return entry;
      }
    }
    return null;
  };

  const getNodeViewForLine = (line) => {
    const blockId = getPreferredBlockIdFromLine(line);
    if (blockId && nodeViewsByBlockId.has(blockId)) {
      return nodeViewsByBlockId.get(blockId).view;
    }
    return null;
  };

  const getPosByBlockId = (blockId) => {
    if (!blockId) {
      return null;
    }
    const state = getState();
    if (!state?.doc) {
      return null;
    }
    const topLevelEntry = getDocTopLevelBlockIndex(state.doc).byId.get(blockId) ?? null;
    if (topLevelEntry && Number.isFinite(topLevelEntry.pos)) {
      return topLevelEntry.pos;
    }
    if (nodeViewsByBlockId.has(blockId)) {
      const pos = nodeViewsByBlockId.get(blockId)?.pos;
      if (Number.isFinite(pos)) {
        return pos;
      }
    }
    let found = null;
    state.doc.descendants((node, pos) => {
      if (node?.attrs?.id === blockId) {
        found = pos;
        return false;
      }
      return true;
    });
    return found;
  };

  const resolveNodeViewBoxRect = ({
    entry,
    layout,
    layoutIndex,
    scrollTop,
    viewportWidth,
    viewportHeight,
    doc,
  }) => {
    if (!entry?.node || !Number.isFinite(entry?.pos) || !layout || !layoutIndex || !doc) {
      return null;
    }
    const fromOffset = docPosToTextOffset(doc, entry.pos);
    const endPos = Math.max(entry.pos, entry.pos + Math.max(1, entry.node.nodeSize ?? 1) - 1);
    const toOffset = docPosToTextOffset(doc, endPos);
    if (!Number.isFinite(fromOffset) || !Number.isFinite(toOffset)) {
      return null;
    }
    const minOffset = Math.min(fromOffset, toOffset);
    const maxOffset = Math.max(fromOffset, toOffset);
    const boxHits = collectAllLayoutBoxesForRange(layout, minOffset, maxOffset, {
      exact: true,
      layoutIndex,
      predicate: ({ box }) => {
        if (!box) {
          return false;
        }
        if (entry.blockId && (box?.blockId != null || box?.nodeId != null)) {
          return (
            String(box.blockId ?? "") === String(entry.blockId) ||
            String(box.nodeId ?? "") === String(entry.blockId)
          );
        }
        return String(box?.type || "") === String(entry.node?.type?.name || "");
      },
    });
    if (boxHits.length === 0) {
      return null;
    }

    let best = null;
    for (const hit of boxHits) {
      const rect = resolveLayoutBoxRect({
        layout,
        box: hit.box,
        pageIndex: hit.pageIndex,
        scrollTop,
        viewportWidth,
      });
      if (!rect) {
        continue;
      }
      const area = Math.max(1, rect.width * rect.height);
      const viewportBottom =
        Number.isFinite(viewportHeight) && Number(viewportHeight) > 0
          ? Number(viewportHeight)
          : null;
      const visibleOverlap =
        viewportBottom == null
          ? 0
          : Math.max(0, Math.min(rect.y + rect.height, viewportBottom) - Math.max(rect.y, 0));
      const distanceToViewport =
        viewportBottom == null
          ? Math.abs(rect.y)
          : rect.y + rect.height < 0
            ? Math.abs(rect.y + rect.height)
            : rect.y > viewportBottom
              ? Math.abs(rect.y - viewportBottom)
              : 0;
      if (
        !best ||
        visibleOverlap > best.visibleOverlap ||
        (visibleOverlap === best.visibleOverlap && distanceToViewport < best.distanceToViewport) ||
        (visibleOverlap === best.visibleOverlap &&
          distanceToViewport === best.distanceToViewport &&
          area < best.area)
      ) {
        best = {
          hit,
          rect,
          area,
          visibleOverlap,
          distanceToViewport,
        };
      }
    }
    if (!best) {
      return null;
    }

    return {
      ...best.rect,
      pageIndex: best.hit.pageIndex,
      box: best.hit.box,
    };
  };

  const getNodeViewAtCoords = ({
    coords,
    getDocPosFromCoords,
    docPosToTextOffset,
    layoutIndex,
  }) => {
    if (!layoutIndex) {
      return null;
    }
    const state = getState();
    if (!state?.doc) {
      return null;
    }
    const layout = view?._internals?.getLayout?.() ?? null;
    const scrollArea = view?._internals?.dom?.scrollArea ?? null;
    if (layout && scrollArea) {
      let bestBoxEntry = null;
      let bestBoxArea = Number.POSITIVE_INFINITY;
      for (const entry of nodeViews.values()) {
        const rect = resolveNodeViewBoxRect({
          entry,
          layout,
          layoutIndex,
          scrollTop: scrollArea.scrollTop,
          viewportWidth: scrollArea.clientWidth,
          viewportHeight: scrollArea.clientHeight,
          doc: state.doc,
        });
        if (!rect) {
          continue;
        }
        const withinX = coords.x >= rect.x && coords.x <= rect.x + rect.width;
        const withinY = coords.y >= rect.y && coords.y <= rect.y + rect.height;
        if (!withinX || !withinY) {
          continue;
        }
        const area = Math.max(1, rect.width * rect.height);
        if (!bestBoxEntry || area <= bestBoxArea) {
          bestBoxEntry = entry;
          bestBoxArea = area;
        }
      }
      if (bestBoxEntry?.view) {
        return bestBoxEntry.view;
      }
    }
    const pos = getDocPosFromCoords(coords);
    if (!Number.isFinite(pos)) {
      return null;
    }
    const offset = docPosToTextOffset(state.doc, pos);
    const lineItem = getLineAtOffset(layoutIndex, offset);
    const blockId = getPreferredBlockIdFromLine(lineItem?.line);
    if (blockId) {
      const fromBlockId = nodeViewsByBlockId.get(blockId)?.view ?? null;
      if (fromBlockId) {
        return fromBlockId;
      }
    }
    let fallback = null;
    for (const entry of nodeViews.values()) {
      if (!entry?.node || !Number.isFinite(entry?.pos)) {
        continue;
      }
      const from = entry.pos;
      const to = entry.pos + (entry.node.nodeSize ?? 0);
      if (pos >= from && pos <= to) {
        if (!fallback) {
          fallback = entry;
          continue;
        }
        const currentSize = fallback.node?.nodeSize ?? Number.MAX_SAFE_INTEGER;
        const nextSize = entry.node?.nodeSize ?? Number.MAX_SAFE_INTEGER;
        if (nextSize <= currentSize) {
          fallback = entry;
        }
      }
    }
    return fallback?.view ?? null;
  };

  const resolveSelectableAtResolvedPos = ($pos, preferredBlockId = null) => {
    if (!$pos) {
      return null;
    }
    const candidates = [];
    const after = $pos.nodeAfter;
    if (after && NodeSelection.isSelectable(after)) {
      candidates.push({ node: after, pos: $pos.pos });
    }
    const before = $pos.nodeBefore;
    if (before && NodeSelection.isSelectable(before)) {
      candidates.push({ node: before, pos: $pos.pos - before.nodeSize });
    }
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth);
      const pos = $pos.before(depth);
      if (node && NodeSelection.isSelectable(node)) {
        candidates.push({ node, pos });
      }
    }
    if (candidates.length === 0) {
      return null;
    }
    if (preferredBlockId != null) {
      const matched = candidates.find((item) => item?.node?.attrs?.id === preferredBlockId);
      if (matched) {
        return matched;
      }
    }
    return candidates[0];
  };

  const syncNodeViewOverlays = ({ layout, layoutIndex, scrollArea }) => {
    // Sync NodeView DOM positions. Fallback to pos mapping when blockId is missing.
    if (!layout || !layoutIndex || nodeViews.size === 0) {
      return;
    }
    const state = getState();
    if (!state?.doc) {
      return;
    }
    const scrollTop = scrollArea.scrollTop;
    const viewportWidth = scrollArea.clientWidth;
    const viewportHeight = scrollArea.clientHeight;
    const pageSpan = layout.pageHeight + layout.pageGap;
    const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
    const syncOverlayEntry = (entry, item = null, boxRect = null) => {
      if (!entry?.view) {
        return false;
      }
      if (!item && !boxRect) {
        entry.view.syncDOM?.({ visible: false });
        return false;
      }
      const line = item?.line ?? null;
      const pageIndex = Number.isFinite(boxRect?.pageIndex)
        ? Number(boxRect.pageIndex)
        : item?.pageIndex ?? 0;
      const pageTop = pageIndex * pageSpan - scrollTop;
      const x = boxRect?.x ?? pageX + (line?.x ?? 0);
      const y = boxRect?.y ?? pageTop + (line?.y ?? 0);
      const width =
        boxRect?.width ??
        (Number.isFinite(line?.width)
          ? line.width
          : layout.pageWidth - layout.margin.left - layout.margin.right);
      const height =
        boxRect?.height ??
        (Number.isFinite(line?.lineHeight) ? line.lineHeight : layout.lineHeight);
      const visible = y + height > 0 && y < viewportHeight;
      entry.view.syncDOM?.({ x, y, width, height, visible, line, pageIndex, layout });
      return visible;
    };

    const nextVisibleOverlayKeys = new Set();

    for (const entry of nodeViews.values()) {
      const boxRect = resolveNodeViewBoxRect({
        entry,
        layout,
        layoutIndex,
        scrollTop,
        viewportWidth,
        viewportHeight,
        doc: state.doc,
      });
      let item = null;
      if (Number.isFinite(entry?.pos)) {
        const offset = docPosToTextOffset(state.doc, entry.pos);
        item = getLineAtOffset(layoutIndex, offset);
      }
      const visible = syncOverlayEntry(entry, item, boxRect);
      if (visible) {
        nextVisibleOverlayKeys.add(entry.key);
      }
    }

    for (const key of lastVisibleOverlayKeys) {
      if (nextVisibleOverlayKeys.has(key)) {
        continue;
      }
      const entry = nodeViews.get(key);
      entry?.view?.syncDOM?.({ visible: false });
    }
    lastVisibleOverlayKeys = nextVisibleOverlayKeys;
  };
  const syncNodeViewSelection = () => {
    // Sync NodeSelection to NodeView state.
    let nextKey = null;
    const state = getState();
    const selection = state?.selection;
    if (selection instanceof NodeSelection) {
      nextKey = getNodeViewKey(selection.node, selection.from);
    }

    if (nextKey === selectedNodeViewKey) {
      return;
    }

    if (selectedNodeViewKey && nodeViews.has(selectedNodeViewKey)) {
      const entry = nodeViews.get(selectedNodeViewKey);
      if (entry?.view) {
        entry.view.isSelected = false;
        entry.view.deselectNode?.();
      }
    }

    selectedNodeViewKey = nextKey;
    if (typeof logNodeSelection === "function" && selectedNodeViewKey) {
      const entry = nodeViews.get(selectedNodeViewKey);
      logNodeSelection("sync-selection", {
        key: selectedNodeViewKey,
        pos: entry?.pos ?? null,
        nodeType: entry?.node?.type?.name ?? null,
      });
    }

    if (selectedNodeViewKey && nodeViews.has(selectedNodeViewKey)) {
      const entry = nodeViews.get(selectedNodeViewKey);
      if (entry?.view) {
        entry.view.isSelected = true;
        entry.view.selectNode?.();
      }
    }
  };

  const syncNodeViews = (changeSummary = null) => {
    // 鏂囨。鍙樺寲鍚庡閲忓鐢?NodeView锛涙棤娉?update 鐨勫疄渚嬩細琚攢姣佸苟閲嶅缓銆?
    const state = getState();
    if (!state?.doc) {
      return;
    }
    const activeNodeViewFactories =
      typeof getNodeViewFactories === "function" ? getNodeViewFactories() : null;

    if (!nodeRegistry && !activeNodeViewFactories) {
      return;
    }

    const decorations = typeof getDecorations === "function" ? getDecorations() : null;
    const resolveNodeViewFactory = (node) => {
      const renderer = nodeRegistry?.get?.(node?.type?.name);
      return activeNodeViewFactories?.[node?.type?.name] ?? renderer?.createNodeView;
    };
    const destroyEntry = (entry) => {
      if (!entry) {
        return;
      }
      nodeViews.delete(entry.key);
      if (entry.blockId && nodeViewsByBlockId.get(entry.blockId) === entry) {
        nodeViewsByBlockId.delete(entry.blockId);
      }
      entry.view?.destroy?.();
    };
    const createEntry = (node, pos, factory, key) => {
      const entry = {
        node,
        pos,
        view: null,
        key,
        blockId: node?.attrs?.id ?? null,
        getPos: () => entry.pos,
      };
      entry.getPos = () => {
        if (entry.blockId) {
          const currentPos = getPosByBlockId(entry.blockId);
          if (Number.isFinite(currentPos)) {
            entry.pos = currentPos;
            return currentPos;
          }
        }
        return entry.pos;
      };
      const nodeView = factory(node, view, entry.getPos);
      if (!nodeView) {
        return null;
      }
      entry.view = nodeView;
      return entry;
    };
    const fullSync = () => {
      const nextViews = new Map();
      const nextByBlockId = new Map();

      state.doc.descendants((node, pos) => {
        const factory = resolveNodeViewFactory(node);
        if (typeof factory !== "function") {
          return;
        }

        const key = getNodeViewKey(node, pos);
        let entry = nodeViews.get(key);

        if (!entry) {
          entry = createEntry(node, pos, factory, key);
          if (!entry) {
            return;
          }
        } else {
          const shouldUpdate = entry.view?.update?.(node, decorations);
          if (shouldUpdate === false) {
            entry.view?.destroy?.();
            entry = createEntry(node, pos, factory, key);
            if (!entry) {
              return;
            }
          } else {
            entry.node = node;
            entry.pos = pos;
            entry.blockId = node.attrs?.id ?? entry.blockId;
          }
        }

        nextViews.set(key, entry);
        if (entry.blockId) {
          nextByBlockId.set(entry.blockId, entry);
        }
      });

      for (const [key, entry] of nodeViews.entries()) {
        if (!nextViews.has(key)) {
          entry.view?.destroy?.();
        }
      }

      nodeViews.clear();
      nodeViewsByBlockId.clear();
      for (const [key, entry] of nextViews.entries()) {
        nodeViews.set(key, entry);
      }
      for (const [blockId, entry] of nextByBlockId.entries()) {
        nodeViewsByBlockId.set(blockId, entry);
      }
    };

    if (changeSummary?.docChanged !== true) {
      syncNodeViewSelection();
      return;
    }

    const changedIds = Array.isArray(changeSummary?.blocks?.ids)
      ? changeSummary.blocks.ids.filter(Boolean)
      : [];
    const canIncremental =
      changedIds.length > 0 &&
      nodeViews.size > 0 &&
      nodeViews.size === nodeViewsByBlockId.size;

    if (!canIncremental) {
      fullSync();
      syncNodeViewSelection();
      return;
    }

    const topLevelIndex = getDocTopLevelBlockIndex(state.doc);
    for (const blockId of changedIds) {
      const current = topLevelIndex.byId.get(blockId) ?? null;
      const existing = nodeViewsByBlockId.get(blockId) ?? null;
      if (!current) {
        destroyEntry(existing);
        continue;
      }
      const factory = resolveNodeViewFactory(current.node);
      if (typeof factory !== "function") {
        destroyEntry(existing);
        continue;
      }
      const nextKey = getNodeViewKey(current.node, current.pos);
      let entry = existing;
      if (entry && entry.key !== nextKey) {
        destroyEntry(entry);
        entry = null;
      }
      if (!entry) {
        entry = createEntry(current.node, current.pos, factory, nextKey);
        if (!entry) {
          continue;
        }
        nodeViews.set(entry.key, entry);
        if (entry.blockId) {
          nodeViewsByBlockId.set(entry.blockId, entry);
        }
        continue;
      }
      const shouldUpdate = entry.view?.update?.(current.node, decorations);
      if (shouldUpdate === false) {
        destroyEntry(entry);
        const recreated = createEntry(current.node, current.pos, factory, nextKey);
        if (!recreated) {
          continue;
        }
        nodeViews.set(recreated.key, recreated);
        if (recreated.blockId) {
          nodeViewsByBlockId.set(recreated.blockId, recreated);
        }
        continue;
      }
      entry.node = current.node;
      entry.pos = current.pos;
      entry.blockId = current.node?.attrs?.id ?? entry.blockId;
      nodeViews.set(entry.key, entry);
      if (entry.blockId) {
        nodeViewsByBlockId.set(entry.blockId, entry);
      }
    }

    syncNodeViewSelection();
  };

  const destroyNodeViews = () => {
    // 缂栬緫鍣ㄩ攢姣佹椂缁熶竴閲婃斁 NodeView锛岄伩鍏嶆硠婕忎簨浠朵笌 DOM銆?
    for (const entry of nodeViews.values()) {
      entry.view?.destroy?.();
    }
    nodeViews.clear();
    nodeViewsByBlockId.clear();
    selectedNodeViewKey = null;
    lastVisibleOverlayKeys = new Set();
  };

  const resolveNodeSelectionTarget = ({
    hit,
    event,
    textOffsetToDocPos,
    queryEditorProp,
  }) => {
    // 灏嗗懡涓瑙ｆ瀽涓哄彲閫変腑鐨勮妭鐐逛綅缃紝鍏煎鎻掍欢閲嶅啓 isNodeSelectionTarget銆?
    const state = getState();
    if (!hit?.line || !state?.doc) {
      return null;
    }
    const line = hit.line;
    const blockId = getPreferredBlockIdFromLine(line);
    const hitOffset = Number.isFinite(hit.offset) ? hit.offset : null;
    const blockStart = Number.isFinite(hit?.start)
      ? Number(hit.start)
      : Number.isFinite(hit?.page?.__pageOffsetDelta) && Number.isFinite(line.blockStart)
        ? Number(line.blockStart) + Number(hit.page.__pageOffsetDelta)
        : Number.isFinite(line.blockStart)
          ? Number(line.blockStart)
          : null;
    const primaryOffset = Number.isFinite(hitOffset) ? hitOffset : blockStart;
    let resolvedTarget = null;
    if (Number.isFinite(primaryOffset)) {
      const primaryPos = textOffsetToDocPos(state.doc, primaryOffset);
      if (Number.isFinite(primaryPos)) {
        resolvedTarget = resolveSelectableAtResolvedPos(state.doc.resolve(primaryPos), blockId ?? null);
      }
    }
    if (!resolvedTarget && Number.isFinite(blockStart)) {
      const blockPos = textOffsetToDocPos(state.doc, blockStart);
      if (Number.isFinite(blockPos)) {
        resolvedTarget = resolveSelectableAtResolvedPos(state.doc.resolve(blockPos), blockId ?? null);
      }
    }
    if (!resolvedTarget && blockId) {
      const idPos = getPosByBlockId(blockId);
      if (Number.isFinite(idPos)) {
        resolvedTarget = resolveSelectableAtResolvedPos(state.doc.resolve(idPos), blockId);
      }
    }
    if (!resolvedTarget?.node || !Number.isFinite(resolvedTarget?.pos)) {
      return null;
    }
    const node = resolvedTarget.node;
    const selectPos = resolvedTarget.pos;

    const decision = resolveNodeSelectionDecision({
      node,
      pos: selectPos,
      hit,
      event,
      queryEditorProp,
      getDefaultNodeSelectionTypes,
    });
    if (!decision.allowed) {
      return null;
    }
    if (!decision.explicit) {
      if (lineHasTextContent(hit?.line)) {
        return null;
      }
    }

    return { node, pos: selectPos };
  };

  const handleNodeViewClick = ({
    event,
    handlerName,
    getEventCoords,
    getDocPosFromCoords,
    docPosToTextOffset,
    layoutIndex,
    queryEditorProp,
    dispatchTransaction,
  }) => {
    const coords = getEventCoords(event);
    const nodeView = getNodeViewAtCoords({
      coords,
      getDocPosFromCoords,
      docPosToTextOffset,
      layoutIndex,
    });
    if (nodeView && typeof nodeView[handlerName] === "function") {
      const handled = nodeView[handlerName](coords.x, coords.y);
      if (handled) {
        return true;
      }
    }

    const entry = resolveNodeViewEntry(nodeView);
    const state = getState();
    const entryPos = Number.isFinite(entry?.getPos?.()) ? Number(entry.getPos()) : entry?.pos;
    if (
      entry?.node &&
      Number.isFinite(entryPos) &&
      NodeSelection.isSelectable(entry.node) &&
      state?.doc
    ) {
      const decision = resolveNodeSelectionDecision({
        node: entry.node,
        pos: entryPos,
        hit: null,
        event,
        queryEditorProp,
        getDefaultNodeSelectionTypes,
      });
      if (!decision.allowed) {
        return false;
      }
      const tr = state.tr.setSelection(NodeSelection.create(state.doc, entryPos));
      if (typeof logNodeSelection === "function") {
        logNodeSelection("click-selection", {
          pos: entryPos,
          nodeType: entry?.node?.type?.name ?? null,
        });
      }
      dispatchTransaction(tr);
      return true;
    }

    return false;
  };
  const setSkipNextClickSelection = (value) => {
    skipNextClickSelection = value === true;
  };

  const consumeSkipNextClickSelection = () => {
    if (!skipNextClickSelection) {
      return false;
    }
    skipNextClickSelection = false;
    return true;
  };

  return {
    getNodeViewForLine,
    syncNodeViewOverlays,
    syncNodeViews,
    destroyNodeViews,
    resolveNodeSelectionTarget,
    handleNodeViewClick,
    setSkipNextClickSelection,
    consumeSkipNextClickSelection,
  };
};








