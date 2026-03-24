import { docPosToTextOffset } from "../../../core";
import { getLineAtOffset } from "../../layoutIndex";
import { Decoration } from "../../decorations";
import { isLineVisualBlock } from "../../layoutSemantics";
import { resolveLineVisualBox } from "../../render/geometry";

export const createDropCursorController = ({
  state,
  settings,
  getLayout,
  getLayoutIndex,
  getState,
  queryEditorProp,
  scheduleRender,
}: {
  state: any;
  settings: any;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getState: () => any;
  queryEditorProp?: (name: any, ...args: any[]) => any;
  scheduleRender: () => void;
}) => {
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

  const resolveLineHeightAtPos = (pos: number) => {
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

  const clearDropDecoration = () => {
    if (!state.getDropDecoration() && state.getDropPos() == null) {
      return;
    }
    state.clearDropDecorationValue();
    state.clearDropPos();
    scheduleRender();
  };

  const setDropDecoration = (pos: number) => {
    if (!Number.isFinite(pos)) {
      return;
    }
    if (state.getDropPos() === pos) {
      return;
    }
    const style = resolveDropCursorStyle();
    if (!style) {
      clearDropDecoration();
      return;
    }
    state.setDropPos(pos);
    const { color, width } = style;
    const height = resolveLineHeightAtPos(pos);
    const layout = getLayout?.() ?? null;
    const layoutIndex = getLayoutIndex?.() ?? null;
    const offset = docPosToTextOffset(getState().doc, pos);
    const lineInfo = layoutIndex ? getLineAtOffset(layoutIndex, offset) : null;
    const line = lineInfo?.line ?? null;
    const lineStart = Number.isFinite(lineInfo?.start) ? Number(lineInfo.start) : null;
    const lineEnd = Number.isFinite(lineInfo?.end) ? Number(lineInfo.end) : lineStart;
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
    const marginRight = Number.isFinite(settings?.margin?.right)
      ? Number(settings.margin.right)
      : null;
    const pageWidth = Number.isFinite(settings?.pageWidth) ? Number(settings.pageWidth) : null;
    const contentWidth = Number.isFinite(visualBox?.outerWidth)
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
    const dropDecoration =
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
    state.setDropDecorationValue(dropDecoration);
    scheduleRender();
  };

  return {
    setDropDecoration,
    clearDropDecoration,
    getDropDecoration: () => state.getDropDecoration(),
  };
};
