export type RenderedCanvasPages = {
  pages: HTMLCanvasElement[];
  pageWidthPx: number;
  pageHeightPx: number;
};

export const collectRenderedPageCanvases = (view: any): RenderedCanvasPages | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const internals = view?._internals;
  const renderer = internals?.renderer;
  const layout = internals?.getLayout?.();
  if (!renderer || !layout || !Array.isArray(layout.pages) || layout.pages.length === 0) {
    return null;
  }
  if (typeof renderer.getPageCache !== "function" || typeof renderer.renderPage !== "function") {
    return null;
  }

  const dpr = Number(window.devicePixelRatio) > 0 ? Number(window.devicePixelRatio) : 1;
  const pages: HTMLCanvasElement[] = [];
  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const entry = renderer.getPageCache(pageIndex, layout, dpr);
    if (!entry?.canvas) {
      continue;
    }
    renderer.renderPage(pageIndex, layout, entry);
    const sourceCanvas = entry.canvas;
    const width = Number(sourceCanvas?.width) || 0;
    const height = Number(sourceCanvas?.height) || 0;
    if (width <= 0 || height <= 0) {
      continue;
    }
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = width;
    pageCanvas.height = height;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) {
      continue;
    }
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    pages.push(pageCanvas);
  }

  if (pages.length === 0) {
    return null;
  }

  return {
    pages,
    pageWidthPx: Math.max(1, Math.round(Number(layout.pageWidth) || pages[0].width)),
    pageHeightPx: Math.max(1, Math.round(Number(layout.pageHeight) || pages[0].height)),
  };
};

export const buildCanvasPreviewDocument = (
  pages: HTMLCanvasElement[],
  pageWidthPx: number,
  pageHeightPx: number
) => {
  const pageMarkup = pages
    .map(
      (page, index) =>
        `<section class="print-page"><img src="${page.toDataURL(
          "image/png"
        )}" alt="Page ${index + 1}" /></section>`
    )
    .join("");

  const previewCss = `
      html, body { margin: 0; padding: 0; background: #eef1f5; }
      .preview-root {
        margin: 0;
        padding: 24px 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .print-page {
        width: ${pageWidthPx}px;
        height: ${pageHeightPx}px;
        overflow: hidden;
        box-shadow: 0 8px 28px rgba(15, 23, 42, 0.16);
        background: #fff;
      }
      .print-page img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: fill;
      }
      @media print {
        html, body { background: #fff; }
        @page { size: ${pageWidthPx}px ${pageHeightPx}px; margin: 0; }
        .preview-root { padding: 0; gap: 0; }
        .print-page {
          box-shadow: none;
          page-break-after: always;
          break-after: page;
        }
        .print-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .print-page img {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Lumen Document PDF</title>
    <style>${previewCss}</style>
  </head>
  <body>
    <main class="preview-root">${pageMarkup}</main>
  </body>
</html>`;
};
