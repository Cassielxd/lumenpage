import { Slice } from "lumenpage-model";

import { docPosToTextOffset } from "../../core";
import { NodeSelection, Selection } from "lumenpage-state";
import { getLineAtOffset } from "../layoutIndex";
import { isLineVisualBlock } from "../layoutSemantics";
import { Decoration } from "../decorations";
import { resolveLineVisualBox } from "../render/geometry";
import { isEditorDomEventHandled } from "./plugins";

// 鎷栨嫿/鏀剧疆澶勭悊锛堝寘鍚?drop cursor 璁＄畻涓庣粯鍒讹級銆?
export const createDragHandlers = ({
  view,
  settings,
  scrollArea,
  getLayout,
  getLayoutIndex,
  getText,
  getState,
  getEventCoords,
  getDocPosFromCoords,
  serializeSliceToHtml,
  clipboardTextSerializer,
  createSliceFromText,
  parseHtmlToSlice,
  dispatchEditorProp,
  queryEditorProp,
  dispatchTransaction,
  setPendingPreferredUpdate,
  scheduleRender,
}) => {
  const isEditable = () => view?.editable !== false;
  let dragState = null;
  let dropDecoration = null;
  let dropPos = null;
  let internalDragging = false;

  const clampDocPos = (doc, pos) => {
    const size = Number(doc?.content?.size ?? 0);
    const n = Number(pos);
    if (!Number.isFinite(n)) {
      return Math.max(0, Math.min(size, 0));
    }
    return Math.max(0, Math.min(size, n));
  };

  const resolveDropSelection = (tr, insertPos, slice) => {
    if (!tr?.doc || !Number.isFinite(insertPos)) {
      return tr;
    }
    const mappedStart = clampDocPos(tr.doc, tr.mapping.map(insertPos, -1));
    const mappedAfter = clampDocPos(tr.doc, tr.mapping.map(insertPos, 1));
    const singleAtomNode =
      slice?.openStart === 0 &&
      slice?.openEnd === 0 &&
      Number(slice?.content?.childCount) === 1 &&
      !!slice?.content?.firstChild?.isAtom;
    if (singleAtomNode) {
      try {
        return tr.setSelection(NodeSelection.create(tr.doc, mappedStart));
      } catch (_error) {
        // fall back to a text-like selection
      }
    }
    try {
      return tr.setSelection(Selection.near(tr.doc.resolve(mappedAfter), 1));
    } catch (_error) {
      return tr;
    }
  };

  // 瑙ｆ瀽 drop cursor 鏍峰紡銆?
  const resolveDropCursorStyle = () => {
    const fromProps = queryEditorProp?.("dropCursor");
    if (fromProps === false) {
      return null;
    }
    const config =
      fromProps && typeof fromProps === "object" ? fromProps : settings?.dropCursor || {};
    return {
      color: config.color || "#2563eb",
      width: Number.isFinite(config.width) ? config.width : 2,
    };
  };

  // 鏍规嵁钀界偣瀹氫綅鍏夋爣楂樺害銆?
  const resolveLineHeightAtPos = (pos) => {
    const layout = getLayout?.();
    if (!layout) {
      return settings?.lineHeight ?? 22;
    }
    const layoutIndex = getLayoutIndex?.() ?? null;
    if (layoutIndex) {
      const offset = docPosToTextOffset(getState().doc, pos);
      const lineInfo = getLineAtOffset(layoutIndex, offset);
      if (lineInfo?.line) {
        const lineHeight = Number.isFinite(lineInfo.line.lineHeight)
          ? lineInfo.line.lineHeight
          : layout.lineHeight;
        return Number.isFinite(lineHeight) ? lineHeight : settings?.lineHeight ?? 22;
      }
    }
    return Number.isFinite(layout.lineHeight) ? layout.lineHeight : settings?.lineHeight ?? 22;
  };

  // 璁剧疆 drop cursor 瑁呴グ銆?
  const setDropDecoration = (pos) => {
    if (!Number.isFinite(pos)) {
      return;
    }
    if (dropPos === pos) {
      return;
    }
    const style = resolveDropCursorStyle();
    if (!style) {
      clearDropDecoration();
      return;
    }
    dropPos = pos;
    const { color, width } = style;
    const height = resolveLineHeightAtPos(pos);
    const layout = getLayout?.() ?? null;
    const layoutIndex = getLayoutIndex?.() ?? null;
    const offset = docPosToTextOffset(getState().doc, pos);
    const lineInfo = layoutIndex ? getLineAtOffset(layoutIndex, offset) : null;
    const line = lineInfo?.line ?? null;
    const lineStart = Number.isFinite(lineInfo?.start)
      ? Number(lineInfo.start)
      : null;
    const lineEnd = Number.isFinite(lineInfo?.end)
      ? Number(lineInfo.end)
      : lineStart;
    const isLineEnd =
      lineStart != null &&
      lineEnd != null &&
      lineEnd > lineStart &&
      Number(offset) >= Number(lineEnd);
    const blockType = line?.blockType || null;
    const isVisualBlock = isLineVisualBlock(line);
    const visualBox = line && layout ? resolveLineVisualBox(line, layout) : null;
    const blockWidth = Number.isFinite(visualBox?.outerWidth)
      ? Number(visualBox.outerWidth)
      : Number.isFinite(line?.width)
        ? Number(line.width)
        : null;
    const lineX = Number.isFinite(visualBox?.outerX)
      ? Number(visualBox.outerX)
      : Number.isFinite(line?.x)
        ? Number(line.x)
        : null;
    const marginLeft = Number.isFinite(settings?.margin?.left) ? Number(settings.margin.left) : null;
    const marginRight = Number.isFinite(settings?.margin?.right) ? Number(settings.margin.right) : null;
    const pageWidth = Number.isFinite(settings?.pageWidth) ? Number(settings.pageWidth) : null;
    const contentWidth =
      Number.isFinite(visualBox?.outerWidth)
        ? Number(visualBox.outerWidth)
        : pageWidth != null && marginLeft != null && marginRight != null
        ? Math.max(1, pageWidth - marginLeft - marginRight)
        : blockWidth;
    const isBlockBoundary =
      lineStart != null &&
      (Number(offset) <= Number(lineStart) || (lineEnd != null && Number(offset) >= Number(lineEnd)));
    const fromProps = queryEditorProp?.("createDropCursorDecoration", pos, {
      color,
      width,
      height,
      line,
      blockType,
      isVisualBlock,
      blockWidth,
      isLineEnd,
      isBlockBoundary,
      lineX,
      marginLeft,
      contentWidth,
      offset,
      lineStart,
      lineEnd,
    });
    dropDecoration =
      fromProps ??
      Decoration.widget(
        pos,
        (ctx, x, y, renderHeight) => {
          const thickness = Math.max(1, Math.round(width));
          const widgetHeight = Number.isFinite(renderHeight) ? Number(renderHeight) : height;
          const lineTop = y - Math.max(0, (height - widgetHeight) / 2);
          if (isBlockBoundary && Number.isFinite(contentWidth) && contentWidth > 0) {
            const left = isLineEnd && Number.isFinite(blockWidth) ? x - Number(blockWidth) : x;
            const top = isLineEnd
              ? lineTop + height - thickness / 2
              : lineTop - thickness / 2;
            ctx.fillStyle = color;
            ctx.fillRect(left, top, Number(contentWidth), thickness);
            return;
          }
          ctx.fillStyle = color;
          ctx.fillRect(x - width / 2, lineTop, width, height);
        },
        { side: 1 }
      );
    scheduleRender();
  };

  // 娓呯悊 drop cursor銆?
  const clearDropDecoration = () => {
    if (!dropDecoration && dropPos == null) {
      return;
    }
    dropDecoration = null;
    dropPos = null;
    scheduleRender();
  };

  const isDragCopy = (event) => {
    const fromProps = queryEditorProp?.("dragCopies", event);
    if (typeof fromProps === "boolean") {
      return fromProps;
    }
    // Default copy modifier: Alt on macOS, Ctrl elsewhere.
    const platform =
      typeof navigator !== "undefined" ? navigator.platform || navigator.userAgent || "" : "";
    const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
    return isMac ? event.altKey : event.ctrlKey;
  };

  const commitInternalDrop = ({ dropTargetPos, event }) => {
    if (!Number.isFinite(dropTargetPos) || !dragState?.slice) {
      dragState = null;
      internalDragging = false;
      clearDropDecoration();
      return false;
    }

    const isCopy = isDragCopy(event);
    const moved = !isCopy;
    const state = getState();
    let tr = state.tr;

    if (moved) {
      const { from, to } = dragState;
      if (dropTargetPos >= from && dropTargetPos <= to) {
        dragState = null;
        internalDragging = false;
        clearDropDecoration();
        return true;
      }
      tr = tr.deleteRange(from, to);
      const mappedPos = tr.mapping.map(dropTargetPos, -1);
      tr = tr.replaceRange(mappedPos, mappedPos, dragState.slice);
      tr = resolveDropSelection(tr, mappedPos, dragState.slice);
    } else {
      tr = tr.replaceRange(dropTargetPos, dropTargetPos, dragState.slice);
      tr = resolveDropSelection(tr, dropTargetPos, dragState.slice);
    }

    setPendingPreferredUpdate(true);
    dispatchTransaction(tr.scrollIntoView());
    dragState = null;
    internalDragging = false;
    clearDropDecoration();
    return true;
  };

  // 鐢?pointer 鎵嬪娍瑙﹀彂鐨勫唴閮ㄦ嫋鎷藉叆鍙ｏ紙涓嶄緷璧栨祻瑙堝櫒鍘熺敓 dragstart锛夈€?
  const startInternalDragFromSelection = (event) => {
    if (!isEditable()) {
      return false;
    }
    if (internalDragging) {
      return true;
    }
    const state = getState?.();
    if (!state?.selection || state.selection.empty) {
      return false;
    }
    const slice = state.selection.content();
    dragState = {
      slice,
      from: state.selection.from,
      to: state.selection.to,
    };
    internalDragging = true;
    return true;
  };

  // 鐢辫妭鐐逛綅缃Е鍙戝唴閮ㄦ嫋鎷斤紙鐢ㄤ簬鍥剧墖/瑙嗛绛夊師瀛愯妭鐐瑰彞鏌勶級銆?
  const startInternalDragFromNodePos = (nodePos, _event) => {
    if (!isEditable()) {
      return false;
    }
    if (internalDragging) {
      return true;
    }
    if (!Number.isFinite(nodePos)) {
      return false;
    }
    const state = getState?.();
    if (!state?.doc) {
      return false;
    }
    const docSize = Number(state.doc.content?.size ?? 0);
    if (nodePos < 0 || nodePos > docSize) {
      return false;
    }
    let node = null;
    try {
      node = state.doc.nodeAt(nodePos);
    } catch (_error) {
      return false;
    }
    if (!state?.doc || !node) {
      return false;
    }
    const from = nodePos;
    const to = nodePos + node.nodeSize;
    const slice = state.doc.slice(from, to);
    if (!slice || slice.size === 0) {
      return false;
    }
    dragState = { slice, from, to };
    internalDragging = true;
    return true;
  };

  const updateInternalDrag = (event, coords) => {
    if (!internalDragging || !dragState) {
      return false;
    }
    const point = coords || getEventCoords(event);
    const nextDropPos = getDocPosFromCoords(point);
    if (Number.isFinite(nextDropPos)) {
      setDropDecoration(nextDropPos);
    } else {
      clearDropDecoration();
    }
    return true;
  };

  const finishInternalDrag = (event, coords) => {
    if (!internalDragging || !dragState) {
      return false;
    }
    const point = coords || getEventCoords(event);
    const dropTargetPos = getDocPosFromCoords(point);
    if (!Number.isFinite(dropTargetPos)) {
      dragState = null;
      internalDragging = false;
      clearDropDecoration();
      return false;
    }
    return commitInternalDrop({ dropTargetPos, event });
  };

  // 寮€濮嬫嫋鎷斤細鍐欏叆鍓创鏁版嵁銆?
  const handleDragStart = (event) => {
    if (!isEditable()) {
      event.preventDefault();
      return;
    }
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    if (dispatchEditorProp?.("handleDragStart", event)) {
      event.preventDefault();
      return;
    }
    const state = getState?.();
    if (!state?.selection) {
      event.preventDefault();
      return;
    }

    let from = state.selection.from;
    let to = state.selection.to;
    let slice = state.selection.content();

    if (state.selection.empty) {
      const fromProps = queryEditorProp?.("resolveDragNodePos", event);
      const nodePos = Number.isFinite(fromProps) ? fromProps : null;
      const docSize = Number(state.doc?.content?.size ?? 0);
      let node = null;
      if (Number.isFinite(nodePos) && nodePos >= 0 && nodePos <= docSize) {
        try {
          node = state.doc.nodeAt(nodePos);
        } catch (_error) {
          node = null;
        }
      }
      if (!node || !Number.isFinite(nodePos)) {
        event.preventDefault();
        return;
      }
      from = nodePos;
      to = nodePos + node.nodeSize;
      slice = state.doc.slice(from, to);
      if (!slice || slice.size === 0) {
        event.preventDefault();
        return;
      }
    }

    const serializedText = clipboardTextSerializer?.(slice) ?? null;
    const text = typeof serializedText === "string"
      ? serializedText
      : state.doc.textBetween(from, to, "\n");
    const html = serializeSliceToHtml(slice, state.schema);
    const json = slice?.toJSON?.() ?? null;

    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", text);
      if (html) {
        event.dataTransfer.setData("text/html", html);
      }
      if (json) {
        event.dataTransfer.setData("application/x-lumenpage-slice", JSON.stringify(json));
      }
      event.dataTransfer.effectAllowed = "copyMove";
    }

    dragState = {
      slice,
      from,
      to,
    };
  };

  // 鎷栨嫿涓細鏇存柊 drop cursor銆?
  const handleDragOver = (event) => {
    if (!isEditable()) {
      event.preventDefault();
      clearDropDecoration();
      return;
    }
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    if (dispatchEditorProp?.("handleDragOver", event)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const coords = getEventCoords(event);
    const nextDropPos = getDocPosFromCoords(coords);
    if (Number.isFinite(nextDropPos)) {
      setDropDecoration(nextDropPos);
    } else {
      clearDropDecoration();
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = isDragCopy(event) ? "copy" : "move";
    }
  };

  // 绂诲紑鎷栨嫿鍖哄煙锛氭竻鐞?drop cursor銆?
  const handleDragLeave = (event) => {
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    if (dispatchEditorProp?.("handleDragLeave", event)) {
      event.preventDefault();
      return;
    }
    clearDropDecoration();
  };

  // 鏀剧疆锛氳В鏋愭暟鎹苟鎻掑叆/绉诲姩銆?
  const handleDrop = (event) => {
    if (!isEditable()) {
      event.preventDefault();
      clearDropDecoration();
      dragState = null;
      return;
    }
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    event.preventDefault();
    clearDropDecoration();

    const coords = getEventCoords(event);
    const dropTargetPos = getDocPosFromCoords(coords) ?? getState().selection.head;
    if (!Number.isFinite(dropTargetPos)) {
      dragState = null;
      return;
    }

    const dataTransfer = event.dataTransfer;
    const isCopy = isDragCopy(event) || dataTransfer?.dropEffect === "copy";
    const isInternal = !!dragState;
    const moved = isInternal && !isCopy;
    let slice = null;

    if (isInternal && dragState?.slice) {
      slice = dragState.slice;
    } else if (dataTransfer) {
      const json = dataTransfer.getData("application/x-lumenpage-slice");
      if (json) {
        try {
          slice = Slice.fromJSON(getState().schema, JSON.parse(json));
        } catch (error) {
        }
      }
      if (!slice) {
        const html = dataTransfer.getData("text/html");
        if (html) {
          try {
            slice = parseHtmlToSlice(html);
          } catch (error) {
          }
        }
      }
      if (!slice) {
        const text = dataTransfer.getData("text/plain");
        if (text) {
          slice = createSliceFromText(getState().schema, text);
        }
      }
    }

    if (!slice) {
      dragState = null;
      return;
    }

    if (dispatchEditorProp?.("handleDrop", event, slice, moved)) {
      dragState = null;
      return;
    }

    const state = getState();
    let tr = state.tr;

    if (moved && dragState) {
      const { from, to } = dragState;
      if (dropTargetPos >= from && dropTargetPos <= to) {
        dragState = null;
        return;
      }
      tr = tr.deleteRange(from, to);
      const mappedPos = tr.mapping.map(dropTargetPos, -1);
      tr = tr.replaceRange(mappedPos, mappedPos, slice);
      tr = resolveDropSelection(tr, mappedPos, slice);
    } else {
      tr = tr.replaceRange(dropTargetPos, dropTargetPos, slice);
      tr = resolveDropSelection(tr, dropTargetPos, slice);
    }

    setPendingPreferredUpdate(true);
    dispatchTransaction(tr.scrollIntoView());
    dragState = null;
  };

  // 鎷栨嫿缁撴潫锛氭竻鐞嗙姸鎬併€?
  const handleDragEnd = (event) => {
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    if (dispatchEditorProp?.("handleDragEnd", event)) {
      event.preventDefault();
      return;
    }
    clearDropDecoration();
    dragState = null;
  };

  return {
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    clearDropDecoration,
    getDropDecoration: () => dropDecoration,
    startInternalDragFromSelection,
    startInternalDragFromNodePos,
    updateInternalDrag,
    finishInternalDrag,
    isInternalDragging: () => internalDragging,
  };
};
