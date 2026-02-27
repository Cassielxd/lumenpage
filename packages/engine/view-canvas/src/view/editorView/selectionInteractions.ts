import { NodeSelection } from "lumenpage-state";
import { resolveNodeSelectionDecision } from "./selectionPolicy";

// Selection interactions: node targeting + node selection application.
export const createSelectionInteractions = ({
  getState,
  textOffsetToDocPos,
  dispatchTransaction,
  queryEditorProp,
  getDefaultNodeSelectionTypes = null,
  resolveNodeSelectionTargetFromManager,
  setSkipNextClickSelection,
}) => {
  const resolveNodeSelectionTarget = (hit, event = null) => {
    return resolveNodeSelectionTargetFromManager({
      hit,
      event,
      textOffsetToDocPos,
      queryEditorProp,
    });
  };

  const setSelectionFromHit = (hit, event) => {
    if (!hit || !hit.line || event?.shiftKey) {
      return false;
    }
    const target = resolveNodeSelectionTarget(hit, event);
    if (!target) {
      return false;
    }
    const state = getState();
    const tr = state.tr.setSelection(NodeSelection.create(state.doc, target.pos));
    dispatchTransaction(tr);
    setSkipNextClickSelection(true);
    return true;
  };

  // Set NodeSelection directly at a document position.
  const setNodeSelectionAtPos = (pos) => {
    const state = getState();
    if (!state?.doc || !Number.isFinite(pos)) {
      return false;
    }
    const docSize = Number(state.doc.content?.size ?? 0);
    if (pos < 0 || pos > docSize) {
      return false;
    }

    let node = null;
    try {
      node = state.doc.nodeAt(pos);
    } catch (_error) {
      return false;
    }
    if (!node || !NodeSelection.isSelectable(node)) {
      return false;
    }

    const decision = resolveNodeSelectionDecision({
      node,
      pos,
      hit: null,
      event: null,
      queryEditorProp,
      getDefaultNodeSelectionTypes,
    });
    if (!decision.allowed) {
      return false;
    }

    let tr = null;
    try {
      tr = state.tr.setSelection(NodeSelection.create(state.doc, pos));
    } catch (_error) {
      return false;
    }
    dispatchTransaction(tr);
    return true;
  };

  return {
    setSelectionFromHit,
    setNodeSelectionAtPos,
  };
};
