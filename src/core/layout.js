function newPage(index) {
  return { index, lines: [] };
}

export class LayoutEngine {
  constructor(settings) {
    this.settings = settings;
    this.measureCanvas = document.createElement("canvas");
    this.ctx = this.measureCanvas.getContext("2d");
  }

  layout(text) {
    const { pageWidth, pageHeight, pageGap, margin, lineHeight, font } = this.settings;
    const maxWidth = pageWidth - margin.left - margin.right;

    this.ctx.font = font;

    const pages = [];
    let pageIndex = 0;
    let page = newPage(pageIndex);
    let y = margin.top;

    let lineStart = 0;
    let lineText = "";

    const pushLine = (endOffset) => {
      const textValue = lineText;
      page.lines.push({
        text: textValue,
        x: margin.left,
        y,
        start: lineStart,
        end: endOffset,
      });
      y += lineHeight;
      if (y + lineHeight > pageHeight - margin.bottom) {
        pages.push(page);
        pageIndex += 1;
        page = newPage(pageIndex);
        y = margin.top;
      }
      lineText = "";
      lineStart = endOffset;
    };

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];

      if (ch === "\n") {
        pushLine(i);
        lineStart = i + 1;
        continue;
      }

      const nextText = lineText + ch;
      const nextWidth = this.ctx.measureText(nextText).width;

      if (nextWidth > maxWidth && lineText.length > 0) {
        pushLine(i);
        lineText = ch;
      } else {
        lineText = nextText;
      }
    }

    if (lineText.length > 0 || lineStart === text.length) {
      pushLine(text.length);
    }

    if (page.lines.length > 0) {
      pages.push(page);
    }

    const totalHeight = pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;

    return {
      pages,
      pageHeight,
      pageWidth,
      pageGap,
      margin,
      lineHeight,
      font,
      totalHeight,
    };
  }
}
