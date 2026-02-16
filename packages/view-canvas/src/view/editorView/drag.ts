import { Slice } from "lumenpage-model";

import { docPosToTextOffset } from "../../core";
import { getLineAtOffset } from "../layoutIndex";
import { Decoration } from "../decorations";

// 拖拽/放置处理（包含 drop cursor 计算与绘制）。
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
  createSliceFromText,
  parseHtmlToSlice,
  dispatchEditorProp,
  dispatchTransaction,
  setPendingPreferredUpdate,
  scheduleRender,
}) => {
  let dragState = null;
  let dropDecoration = null;
  let dropPos = null;

  // 解析 drop cursor 样式。
  const resolveDropCursorStyle = () => {
    const config = settings?.dropCursor || {};
    return {
      color: config.color || "#2563eb",
      width: Number.isFinite(config.width) ? config.width : 2,
    };
  };

  // 根据落点定位光标高度。
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

  // 设置 drop cursor 装饰。
  const setDropDecoration = (pos) => {
    if (!Number.isFinite(pos)) {
      return;
    }
    if (dropPos === pos) {
      return;
    }
    dropPos = pos;
    const { color, width } = resolveDropCursorStyle();
    const height = resolveLineHeightAtPos(pos);
    dropDecoration = Decoration.widget(
      pos,
      (ctx, x, y) => {
        ctx.fillStyle = color;
        ctx.fillRect(x - width / 2, y, width, height);
      },
      { side: 1 }
    );
    scheduleRender();
  };

  // 清理 drop cursor。
  const clearDropDecoration = () => {
    if (!dropDecoration && dropPos == null) {
      return;
    }
    dropDecoration = null;
    dropPos = null;
    scheduleRender();
  };

  // 开始拖拽：写入剪贴数据。
  const handleDragStart = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (dispatchEditorProp?.("handleDragStart", event)) {
      event.preventDefault();
      return;
    }
    const state = getState?.();
    if (!state?.selection || state.selection.empty) {
      event.preventDefault();
      return;
    }
    const slice = state.selection.content();
    const text = state.doc.textBetween(state.selection.from, state.selection.to, "\n");
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
      from: state.selection.from,
      to: state.selection.to,
    };
  };

  // 拖拽中：更新 drop cursor。
  const handleDragOver = (event) => {
    if (event.defaultPrevented) {
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
      event.dataTransfer.dropEffect = event.ctrlKey || event.metaKey ? "copy" : "move";
    }
  };

  // 离开拖拽区域：清理 drop cursor。
  const handleDragLeave = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (dispatchEditorProp?.("handleDragLeave", event)) {
      event.preventDefault();
      return;
    }
    clearDropDecoration();
  };

  // 放置：解析数据并插入/移动。
  const handleDrop = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (dispatchEditorProp?.("handleDrop", event)) {
      event.preventDefault();
      clearDropDecoration();
      dragState = null;
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
    const isCopy = event.ctrlKey || event.metaKey || dataTransfer?.dropEffect === "copy";
    const isInternal = !!dragState;
    let slice = null;

    if (isInternal && dragState?.slice) {
      slice = dragState.slice;
    } else if (dataTransfer) {
      const json = dataTransfer.getData("application/x-lumenpage-slice");
      if (json) {
        try {
          slice = Slice.fromJSON(getState().schema, JSON.parse(json));
        } catch (error) {
          console.warn("Failed to parse dropped slice", error);
        }
      }
      if (!slice) {
        const html = dataTransfer.getData("text/html");
        if (html) {
          try {
            slice = parseHtmlToSlice(html);
          } catch (error) {
            console.warn("Failed to parse dropped HTML", error);
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

    const state = getState();
    let tr = state.tr;

    if (isInternal && dragState && !isCopy) {
      const { from, to } = dragState;
      if (dropTargetPos >= from && dropTargetPos <= to) {
        dragState = null;
        return;
      }
      tr = tr.deleteRange(from, to);
      const mappedPos = tr.mapping.map(dropTargetPos, -1);
      tr = tr.replaceRange(mappedPos, mappedPos, slice);
    } else {
      tr = tr.replaceRange(dropTargetPos, dropTargetPos, slice);
    }

    setPendingPreferredUpdate(true);
    dispatchTransaction(tr.scrollIntoView());
    dragState = null;
  };

  // 拖拽结束：清理状态。
  const handleDragEnd = (event) => {
    if (event.defaultPrevented) {
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
  };
};
