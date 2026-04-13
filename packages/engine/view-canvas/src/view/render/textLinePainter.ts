import { measureTextWidth, getFontSize } from "../measure.js";
import {
  drawRunBackground,
  drawRunMarkInstructions,
  drawRunStrike,
  drawRunUnderline,
} from "lumenpage-render-engine";

const getLineHeight = (line: any, layout: any) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const getBaselineOffset = (lineHeight: number, fontSize: number) =>
  Math.max(0, (lineHeight - fontSize) / 2);

export const renderTextLine = ({
  ctx,
  line,
  pageX,
  pageTop,
  layout,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  line: any;
  pageX: number;
  pageTop: number;
  layout: any;
}) => {
  const lineHeight = getLineHeight(line, layout);
  const markCtx = ctx as CanvasRenderingContext2D;

  if (Array.isArray(line?.runs) && line.runs.length > 0) {
    let cursorX = pageX + line.x;

    for (const run of line.runs) {
      const font = run.font || layout.font;
      const color = run.color || "#111827";
      const fontSize = getFontSize(font);
      const baselineOffset = getBaselineOffset(lineHeight, fontSize);
      const width = typeof run.width === "number" ? run.width : measureTextWidth(font, run.text);
      const shiftY = Number.isFinite(run.shiftY) ? Number(run.shiftY) : 0;
      const textY = pageTop + line.y + baselineOffset + shiftY;
      const markDrawContext = {
        ctx: markCtx,
        run,
        line,
        pageX,
        pageTop,
        layout,
        x: cursorX,
        y: pageTop + line.y,
        width,
        lineHeight,
        textY,
        font,
        fontSize,
        color,
      };

      drawRunMarkInstructions(run, "beforeBackground", markDrawContext);
      drawRunBackground(markCtx, run, cursorX, pageTop + line.y, width, lineHeight);
      drawRunMarkInstructions(run, "afterBackground", markDrawContext);

      ctx.font = font;
      ctx.fillStyle = color;

      drawRunMarkInstructions(run, "beforeText", markDrawContext);
      ctx.fillText(run.text, cursorX, textY);
      drawRunMarkInstructions(run, "afterText", markDrawContext);
      drawRunUnderline(markCtx, { ...run, color }, cursorX, textY, width, fontSize);
      drawRunStrike(markCtx, { ...run, color }, cursorX, textY, width, fontSize);

      cursorX += width;
    }
    return;
  }

  const font = layout.font;
  const fontSize = getFontSize(font);
  const baselineOffset = getBaselineOffset(lineHeight, fontSize);
  const textY = pageTop + line.y + baselineOffset;

  ctx.font = font;
  ctx.fillStyle = "#111827";
  ctx.fillText(line.text, pageX + line.x, textY);
};
