import { NodeSelection } from "lumenpage-state";

import { getPageOffsetDelta } from "../../layoutRuntimeMetadata";
import { resolveNodeSelectionDecision } from "../selectionPolicy";

export const createNodeViewSelectionHandlers = ({
  managerState,
  getState,
  getDefaultNodeSelectionTypes,
  logNodeSelection,
  getPreferredBlockIdFromLine,
  lineHasTextContent,
  getPosByBlockId,
  resolveSelectableAtResolvedPos,
  getNodeViewAtCoords,
  resolveNodeViewEntry,
}: {
  managerState: any;
  getState: () => any;
  getDefaultNodeSelectionTypes: () => Set<string> | null;
  logNodeSelection?: (...args: any[]) => void;
  getPreferredBlockIdFromLine: (line: any) => any;
  lineHasTextContent: (line: any) => boolean;
  getPosByBlockId: (blockId: any) => any;
  resolveSelectableAtResolvedPos: ($pos: any, preferredBlockId?: any) => any;
  getNodeViewAtCoords: (args: {
    coords: any;
    getDocPosFromCoords: (coords: any) => any;
    docPosToTextOffset: (doc: any, pos: number) => number;
    layoutIndex: any;
  }) => any;
  resolveNodeViewEntry: (nodeView: any) => any;
}) => {
  const syncNodeViewSelection = () => {
    let nextKey = null;
    const state = getState();
    const selection = state?.selection;
    if (selection instanceof NodeSelection) {
      nextKey = selection.node ? `${selection.node.type.name}:${selection.node.attrs?.id ?? selection.from}` : null;
      if (!managerState.nodeViews.has(nextKey)) {
        nextKey = null;
        for (const [key, entry] of managerState.nodeViews.entries()) {
          if (entry?.pos === selection.from) {
            nextKey = key;
            break;
          }
        }
      }
    }

    if (nextKey === managerState.selectedNodeViewKey) {
      return;
    }

    if (managerState.selectedNodeViewKey && managerState.nodeViews.has(managerState.selectedNodeViewKey)) {
      const entry = managerState.nodeViews.get(managerState.selectedNodeViewKey);
      if (entry?.view) {
        entry.view.isSelected = false;
        entry.view.deselectNode?.();
      }
    }

    managerState.selectedNodeViewKey = nextKey;
    if (typeof logNodeSelection === "function" && managerState.selectedNodeViewKey) {
      const entry = managerState.nodeViews.get(managerState.selectedNodeViewKey);
      logNodeSelection("sync-selection", {
        key: managerState.selectedNodeViewKey,
        pos: entry?.pos ?? null,
        nodeType: entry?.node?.type?.name ?? null,
      });
    }

    if (managerState.selectedNodeViewKey && managerState.nodeViews.has(managerState.selectedNodeViewKey)) {
      const entry = managerState.nodeViews.get(managerState.selectedNodeViewKey);
      if (entry?.view) {
        entry.view.isSelected = true;
        entry.view.selectNode?.();
      }
    }
  };

  const resolveNodeSelectionTarget = ({
    hit,
    event,
    textOffsetToDocPos,
    queryEditorProp,
  }: {
    hit: any;
    event: any;
    textOffsetToDocPos: (doc: any, offset: number) => number;
    queryEditorProp: (name: any, ...args: any[]) => any;
  }) => {
    const state = getState();
    if (!hit?.line || !state?.doc) {
      return null;
    }
    const line = hit.line;
    const blockId = getPreferredBlockIdFromLine(line);
    const hitOffset = Number.isFinite(hit.offset) ? hit.offset : null;
    const blockStart = Number.isFinite(hit?.start)
      ? Number(hit.start)
      : Number.isFinite(getPageOffsetDelta(hit?.page)) && Number.isFinite(line.blockStart)
        ? Number(line.blockStart) + getPageOffsetDelta(hit.page)
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
    if (!decision.explicit && lineHasTextContent(hit?.line)) {
      return null;
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
  }: {
    event: any;
    handlerName: any;
    getEventCoords: (event: any) => any;
    getDocPosFromCoords: (coords: any) => any;
    docPosToTextOffset: (doc: any, pos: number) => number;
    layoutIndex: any;
    queryEditorProp: (name: any, ...args: any[]) => any;
    dispatchTransaction: (tr: any) => void;
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

  const setSkipNextClickSelection = (value: boolean) => {
    managerState.skipNextClickSelection = value === true;
  };

  const consumeSkipNextClickSelection = () => {
    if (!managerState.skipNextClickSelection) {
      return false;
    }
    managerState.skipNextClickSelection = false;
    return true;
  };

  return {
    syncNodeViewSelection,
    resolveNodeSelectionTarget,
    handleNodeViewClick,
    setSkipNextClickSelection,
    consumeSkipNextClickSelection,
  };
};
