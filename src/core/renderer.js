import { getVisiblePages } from "./virtualization.js";
import { measureTextWidth, getFontSize } from "./measure.js";

const getBaselineOffset = (lineHeight, fontSize) =>
  Math.max(0, (lineHeight - fontSize) / 2);

export class Renderer {
  constructor(canvas, settings, registry = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = settings;
    this.registry = registry;
  }

  renderLine(line, pageX, pageTop, layout) {
    if (line.runs && line.runs.length > 0) {
      let cursorX = pageX + line.x;
      for (const run of line.runs) {
        const font = run.font || layout.font;
        const color = run.color || "#111827";
        const fontSize = getFontSize(font);
        const baselineOffset = getBaselineOffset(layout.lineHeight, fontSize);
        const width =
          typeof run.width === "number"
            ? run.width
            : measureTextWidth(font, run.text);
        const textY = pageTop + line.y + baselineOffset;

        this.ctx.font = font;
        this.ctx.fillStyle = color;
        this.ctx.fillText(run.text, cursorX, textY);

        if (run.underline && run.text.length > 0) {
          const underlineY = textY + fontSize - 2;
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(cursorX, underlineY);
          this.ctx.lineTo(cursorX + width, underlineY);
          this.ctx.stroke();
        }

        cursorX += width;
      }
    } else {
      const font = layout.font;
      const fontSize = getFontSize(font);
      const baselineOffset = getBaselineOffset(layout.lineHeight, fontSize);
      const textY = pageTop + line.y + baselineOffset;

      this.ctx.font = font;
      this.ctx.fillStyle = "#111827";
      this.ctx.fillText(line.text, pageX + line.x, textY);
    }
  }

  render(layout, viewport, caret, selectionRects = []) {
    if (!layout) {
      return;
    }

    const { clientWidth, clientHeight, scrollTop } = viewport;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.max(1, Math.floor(clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(clientHeight * dpr));
    this.canvas.style.width = `${clientWidth}px`;
    this.canvas.style.height = `${clientHeight}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, clientWidth, clientHeight);

    this.ctx.fillStyle = "#e5e7eb";
    this.ctx.fillRect(0, 0, clientWidth, clientHeight);

    this.ctx.textBaseline = "top";

    const pageX = Math.max(0, (clientWidth - layout.pageWidth) / 2);
    const pageSpan = layout.pageHeight + layout.pageGap;
    const visible = getVisiblePages(layout, scrollTop, clientHeight);

    for (let i = visible.startIndex; i <= visible.endIndex; i += 1) {
      const page = layout.pages[i];
      const pageTop = i * pageSpan - scrollTop;

      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(pageX, pageTop, layout.pageWidth, layout.pageHeight);
      this.ctx.strokeStyle = "#d1d5db";
      this.ctx.strokeRect(pageX, pageTop, layout.pageWidth, layout.pageHeight);
    }

    if (selectionRects && selectionRects.length > 0) {
      this.ctx.fillStyle = "#bfdbfe";
      for (const rect of selectionRects) {
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }

    const defaultRender = this.renderLine.bind(this);

    for (let i = visible.startIndex; i <= visible.endIndex; i += 1) {
      const page = layout.pages[i];
      const pageTop = i * pageSpan - scrollTop;

      for (const line of page.lines) {
        const renderer = this.registry?.get(line.blockType);
        if (renderer?.renderLine) {
          renderer.renderLine({
            ctx: this.ctx,
            line,
            pageTop,
            pageX,
            layout,
            defaultRender,
          });
        } else {
          defaultRender(line, pageX, pageTop, layout);
        }
      }
    }

    if (caret) {
      const caretBottom = caret.y + caret.height;
      if (caretBottom >= 0 && caret.y <= clientHeight) {
        this.ctx.fillStyle = "#111827";
        this.ctx.fillRect(caret.x, caret.y, 1, caret.height);
      }
    }
  }
}
