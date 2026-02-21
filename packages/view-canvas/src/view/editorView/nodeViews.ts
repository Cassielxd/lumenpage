import { NodeSelection } from "lumenpage-state";
import { docPosToTextOffset } from "../../core";

import { getFirstLineForBlockId, getLineAtOffset } from "../layoutIndex";

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
  const allowDefaultNodeSelection = (node) => {
    if (!node || !NodeSelection.isSelectable(node)) {
      return false;
    }
    const defaultNodeSelectionTypes =
      typeof getDefaultNodeSelectionTypes === "function"
        ? getDefaultNodeSelectionTypes()
        : null;
    if (defaultNodeSelectionTypes) {
      return defaultNodeSelectionTypes.has(node.type?.name);
    }
    // Default behavior aligns with PM table UX:
    // table internals should keep text/cell selection semantics, not NodeSelection on table.
    if (node.type?.name === "table") {
      return false;
    }
    return node.isTextblock !== true;
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
    const blockId = line?.blockId;
    if (blockId && nodeViewsByBlockId.has(blockId)) {
      return nodeViewsByBlockId.get(blockId).view;
    }
    return null;
  };

  const getPosByBlockId = (blockId) => {
    if (!blockId) {
      return null;
    }
    if (nodeViewsByBlockId.has(blockId)) {
      const pos = nodeViewsByBlockId.get(blockId)?.pos;
      if (Number.isFinite(pos)) {
        return pos;
      }
    }
    const state = getState();
    if (!state?.doc) {
      return null;
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
    const pos = getDocPosFromCoords(coords);
    if (!Number.isFinite(pos) || !state?.doc) {
      return null;
    }
    const offset = docPosToTextOffset(state.doc, pos);
    const lineItem = getLineAtOffset(layoutIndex, offset);
    const blockId = lineItem?.line?.blockId;
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

    for (const entry of nodeViews.values()) {
      const blockId = entry?.blockId ?? null;
      let item = blockId ? getFirstLineForBlockId(layoutIndex, blockId) : null;
      if (!item && Number.isFinite(entry?.pos)) {
        const offset = docPosToTextOffset(state.doc, entry.pos);
        item = getLineAtOffset(layoutIndex, offset);
      }
      if (!item) {
        entry.view?.syncDOM?.({ visible: false });
        continue;
      }
      const line = item.line;
      const pageTop = item.pageIndex * pageSpan - scrollTop;
      const x = pageX + (line.x ?? 0);
      const y = pageTop + (line.y ?? 0);
      const width = Number.isFinite(line.width)
        ? line.width
        : layout.pageWidth - layout.margin.left - layout.margin.right;
      const height = Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;
      const visible = y + height > 0 && y < viewportHeight;
      entry.view?.syncDOM?.({ x, y, width, height, visible, line, pageIndex: item.pageIndex, layout });
    }
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

  const syncNodeViews = () => {
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

    const nextViews = new Map();
    const nextByBlockId = new Map();

    state.doc.descendants((node, pos) => {
      const renderer = nodeRegistry?.get?.(node.type.name);
      const factory = activeNodeViewFactories?.[node.type.name] ?? renderer?.createNodeView;
      if (typeof factory !== "function") {
        return;
      }

      const key = getNodeViewKey(node, pos);
      let entry = nodeViews.get(key);

      if (!entry) {
        entry = { node, pos, view: null, key, blockId: node.attrs?.id ?? null };
        entry.getPos = () => entry.pos;
        const nodeView = factory(node, view, entry.getPos);
        if (!nodeView) {
          return;
        }
        entry.view = nodeView;
      } else {
        const shouldUpdate = entry.view?.update?.(node, decorations);
        if (shouldUpdate === false) {
          entry.view?.destroy?.();
          entry = null;
        } else if (entry) {
          entry.node = node;
          entry.pos = pos;
          entry.blockId = node.attrs?.id ?? entry.blockId;
        }
      }

      if (entry) {
        nextViews.set(key, entry);
        if (entry.blockId) {
          nextByBlockId.set(entry.blockId, entry);
        }
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
    const blockId = line.blockId;
    const hitOffset = Number.isFinite(hit.offset) ? hit.offset : null;
    const blockStart = Number.isFinite(line.blockStart) ? line.blockStart : null;
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

    const decision = queryEditorProp("isNodeSelectionTarget", {
      node,
      pos: selectPos,
      hit,
      event,
    });
    if (decision === false) {
      return null;
    }
    if (decision !== true) {
        if (lineHasTextContent(hit?.line)) {
        return null;
      }
      if (!allowDefaultNodeSelection(node)) {
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
    if (entry?.node && NodeSelection.isSelectable(entry.node) && state?.doc) {
      const decision = queryEditorProp("isNodeSelectionTarget", {
        node: entry.node,
        pos: entry.pos,
        hit: null,
        event,
      });
      if (decision !== true && entry?.node?.type?.name === "table") {
        return false;
      }
      if (
        decision !== true &&
        (decision === false || !allowDefaultNodeSelection(entry.node))
      ) {
        return false;
      }
      const tr = state.tr.setSelection(NodeSelection.create(state.doc, entry.pos));
      if (typeof logNodeSelection === "function") {
        logNodeSelection("click-selection", {
          pos: entry.pos,
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



