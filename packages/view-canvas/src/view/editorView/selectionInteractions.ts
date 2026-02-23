import { NodeSelection, TextSelection } from "lumenpage-state";
import { resolveNodeSelectionDecision } from "./selectionPolicy";

// 选区交互策略：节点选中、GapCursor 选择、createSelectionBetween 回退。
export const createSelectionInteractions = ({
  getState,
  getLayout,
  scrollArea,
  isEditable,
  textOffsetToDocPos,
  dispatchTransaction,
  queryEditorProp,
  getDefaultNodeSelectionTypes = null,
  resolveNodeSelectionTargetFromManager,
  setSkipNextClickSelection,
}) => {
  const createSelectionBetweenFromProps = (anchorPos, headPos) => {
    const state = getState();
    const $anchor = state.doc.resolve(anchorPos);
    const $head = state.doc.resolve(headPos);
    return queryEditorProp("createSelectionBetween", $anchor, $head);
  };

  const createSelectionBetween = (anchorPos, headPos) => {
    const fromProps = createSelectionBetweenFromProps(anchorPos, headPos);
    if (fromProps) {
      return fromProps;
    }
    const state = getState();
    const $anchor = state.doc.resolve(anchorPos);
    const $head = state.doc.resolve(headPos);
    return TextSelection.between($anchor, $head);
  };

  // 在目标位置附近尝试解析 GapSelection（通常由 gapcursor 插件提供）。
  const resolveGapSelectionAtPos = (pos) => {
    const state = getState();
    if (!state?.doc || !Number.isFinite(pos)) {
      return null;
    }
    const maxPos = state.doc.content.size;
    const seeds = [pos, pos - 1, pos + 1, pos - 2, pos + 2];
    for (const seed of seeds) {
      if (!Number.isFinite(seed)) {
        continue;
      }
      const candidatePos = Math.max(0, Math.min(maxPos, seed));
      const selection = createSelectionBetweenFromProps(candidatePos, candidatePos);
      if (selection && !(selection instanceof TextSelection)) {
        return { selection, pos: candidatePos };
      }
    }
    return null;
  };

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

  // 按文档位置直接设置 NodeSelection（用于拖拽句柄/媒体本体点击）。
  const setNodeSelectionAtPos = (pos) => {
    const state = getState();
    if (!state?.doc || !Number.isFinite(pos)) {
      return false;
    }
    const node = state.doc.nodeAt(pos);
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
    const tr = state.tr.setSelection(NodeSelection.create(state.doc, pos));
    dispatchTransaction(tr);
    return true;
  };

  const setGapCursorAtCoords = (x, y, hit, event) => {
    const layout = getLayout();
    if (!layout || event?.shiftKey || isEditable() === false) {
      return false;
    }
    if (resolveNodeSelectionTarget(hit, event)) {
      return false;
    }
    const pageSpan = layout.pageHeight + layout.pageGap;
    const absoluteY = y + scrollArea.scrollTop;
    const pageIndex = Math.floor(absoluteY / pageSpan);
    if (pageIndex < 0 || pageIndex >= layout.pages.length) {
      return false;
    }
    const page = layout.pages[pageIndex];
    const localY = absoluteY - pageIndex * pageSpan;
    const lines = page.lines || [];
    const lineAtY = lines.find((line) => {
      const lineHeight = Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;
      return localY >= line.y && localY < line.y + lineHeight;
    });
    if (lineAtY) {
      return false;
    }
    let above = null;
    let below = null;
    for (const line of lines) {
      const lineHeight = Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;
      const bottom = line.y + lineHeight;
      if (bottom <= localY) {
        if (!above || bottom > above.bottom) {
          above = { line, bottom };
        }
      }
      if (line.y >= localY) {
        if (!below || line.y < below.top) {
          below = { line, top: line.y };
        }
      }
    }
    if (!above || !below) {
      return false;
    }
    const targetOffset = Number.isFinite(below.line.blockStart)
      ? below.line.blockStart
      : Number.isFinite(above.line.end)
        ? above.line.end
        : null;
    if (!Number.isFinite(targetOffset)) {
      return false;
    }
    const state = getState();
    const pos = textOffsetToDocPos(state.doc, targetOffset);
    if (!Number.isFinite(pos)) {
      return false;
    }
    const resolved = resolveGapSelectionAtPos(pos);
    if (!resolved?.selection) {
      return false;
    }
    const tr = state.tr.setSelection(resolved.selection);
    dispatchTransaction(tr);
    setSkipNextClickSelection(true);
    return true;
  };

  return {
    setSelectionFromHit,
    setNodeSelectionAtPos,
    createSelectionBetweenFromProps,
    resolveGapSelectionAtPos,
    createSelectionBetween,
    resolveNodeSelectionTarget,
    setGapCursorAtCoords,
  };
};
