import type { PlaygroundLocale } from "../i18n";
import {
  downloadBlobAsFile,
  downloadDataUrlAsFile,
  downloadTextAsFile,
} from "./export/downloadHelpers";
import {
  buildHtmlPreviewDocument,
  serializeViewDocToHtml,
  serializeViewDocToHtmlForWord,
} from "./export/htmlExportHelpers";
import { openPrintPreviewDialog } from "./export/printPreviewDialog";
import { buildPdfFromCanvasPages } from "./export/pdfBuilder";
import {
  buildCanvasPreviewDocument,
  collectRenderedPageCanvases,
} from "./export/renderedPagesHelpers";
import { createShareClipboardActions } from "./export/shareClipboardActions";
import {
  buildWordDocxBlobFromHtml,
  buildWordDocxBlobFromRenderedPages,
} from "./export/wordDocxExport";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";

type GetView = () => any;
const EXPORT_PREVIEW_HTML_FILENAME = "lumen-print-preview.html";
const EXPORT_WORD_FILENAME = "lumen-document.docx";

const collectWordPageBreakRootIndices = (view: any) => {
  const layout = view?._internals?.getLayout?.();
  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  if (pages.length <= 1) {
    return [];
  }

  const breaks = new Set<number>();
  for (let pageIndex = 1; pageIndex < pages.length; pageIndex += 1) {
    const firstLine = Array.isArray(pages[pageIndex]?.lines) ? pages[pageIndex].lines[0] : null;
    if (!firstLine) {
      continue;
    }
    const attrs = firstLine?.blockAttrs || {};
    const tableMeta = firstLine?.tableMeta || {};
    const fromPrev =
      !!attrs.sliceFromPrev || !!attrs.tableSliceFromPrev || !!tableMeta.continuedFromPrev;
    if (fromPrev) {
      continue;
    }
    const rootIndex = Number(firstLine?.rootIndex);
    if (Number.isFinite(rootIndex) && rootIndex > 0) {
      breaks.add(Math.floor(rootIndex));
    }
  }

  return Array.from(breaks).sort((a, b) => a - b);
};

export const createExportActions = ({
  getView,
  getLocaleKey,
  requestInputDialog,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  // Raw semantic HTML (without preview shell); kept for integration reuse.
  const serializeCurrentDocToHtml = () => serializeViewDocToHtml(getView());
  const { copyShareLink, copyEmbedCode } = createShareClipboardActions({
    getLocaleKey,
    requestInputDialog,
  });

  const buildPrintPreviewHtml = () => {
    const renderedPages = collectRenderedPageCanvases(getView());
    if (renderedPages) {
      return buildCanvasPreviewDocument(
        renderedPages.pages,
        renderedPages.pageWidthPx,
        renderedPages.pageHeightPx
      );
    }
    const html = serializeCurrentDocToHtml();
    if (typeof html !== "string") {
      return null;
    }
    return buildHtmlPreviewDocument(html);
  };

  const exportPlainText = () => {
    const view = getView();
    const text = view?.getTextContent?.() ?? "";
    return downloadTextAsFile("lumen-document.txt", text);
  };

  const exportHtmlDocument = () => {
    const previewHtml = buildPrintPreviewHtml();
    if (typeof previewHtml !== "string") {
      return false;
    }
    return downloadTextAsFile(EXPORT_PREVIEW_HTML_FILENAME, previewHtml, "text/html;charset=utf-8");
  };

  const exportWordDocument = async () => {
    const view = getView();
    const html = serializeViewDocToHtmlForWord(view) ?? serializeCurrentDocToHtml();
    if (typeof html !== "string") {
      const renderedPages = collectRenderedPageCanvases(view);
      if (renderedPages) {
        const blob = await buildWordDocxBlobFromRenderedPages(
          renderedPages.pages.map((page) => ({
            dataUrl: page.toDataURL("image/png"),
            widthPx: renderedPages.pageWidthPx,
            heightPx: renderedPages.pageHeightPx,
          })),
          {
            pageWidthPx: renderedPages.pageWidthPx,
            pageHeightPx: renderedPages.pageHeightPx,
          }
        );
        if (blob) {
          return downloadBlobAsFile(EXPORT_WORD_FILENAME, blob);
        }
      }
      return false;
    }
    const settings = view?._internals?.settings;
    const blob = await buildWordDocxBlobFromHtml(html, {
      pageBreakBeforeRootIndices: collectWordPageBreakRootIndices(view),
      settings: {
        pageWidthPx: Number(settings?.pageWidth) || undefined,
        pageHeightPx: Number(settings?.pageHeight) || undefined,
        margin: settings?.margin || undefined,
        font: settings?.font || undefined,
        lineHeight: Number(settings?.lineHeight) || undefined,
        blockSpacing: Number(settings?.blockSpacing) || 8,
        paragraphSpacingBefore: Number(settings?.paragraphSpacingBefore) || 0,
        paragraphSpacingAfter: Number(settings?.paragraphSpacingAfter) || 8,
      },
    });
    if (!blob) {
      const renderedPages = collectRenderedPageCanvases(view);
      if (renderedPages) {
        const renderedBlob = await buildWordDocxBlobFromRenderedPages(
          renderedPages.pages.map((page) => ({
            dataUrl: page.toDataURL("image/png"),
            widthPx: renderedPages.pageWidthPx,
            heightPx: renderedPages.pageHeightPx,
          })),
          {
            pageWidthPx: renderedPages.pageWidthPx,
            pageHeightPx: renderedPages.pageHeightPx,
          }
        );
        if (renderedBlob) {
          return downloadBlobAsFile(EXPORT_WORD_FILENAME, renderedBlob);
        }
      }
      return false;
    }
    return downloadBlobAsFile(EXPORT_WORD_FILENAME, blob);
  };

  const exportImageDocument = () => {
    const renderedPages = collectRenderedPageCanvases(getView());
    if (!renderedPages) {
      return false;
    }
    const { pages } = renderedPages;

    const width = pages.reduce((max: number, page) => Math.max(max, page.width), 0);
    const height = pages.reduce((sum: number, page) => sum + page.height, 0);
    if (width <= 0 || height <= 0) {
      return false;
    }

    const composite = document.createElement("canvas");
    composite.width = width;
    composite.height = height;
    const ctx = composite.getContext("2d");
    if (!ctx) {
      return false;
    }

    let offsetY = 0;
    for (const page of pages) {
      ctx.drawImage(page, 0, offsetY);
      offsetY += page.height;
    }

    try {
      return downloadDataUrlAsFile("lumen-document.png", composite.toDataURL("image/png"));
    } catch (_error) {
      return false;
    }
  };

  const printDocument = () => {
    const previewHtml = buildPrintPreviewHtml();
    if (typeof previewHtml === "string") {
      return openPrintPreviewDialog(previewHtml, getLocaleKey());
    }
    return false;
  };

  const exportPdfDocument = () => {
    const renderedPages = collectRenderedPageCanvases(getView());
    if (!renderedPages) {
      return false;
    }
    const pdfBytes = buildPdfFromCanvasPages(
      renderedPages.pages,
      renderedPages.pageWidthPx,
      renderedPages.pageHeightPx
    );
    if (!pdfBytes) {
      return false;
    }
    return downloadBlobAsFile(
      "lumen-document.pdf",
      new Blob([pdfBytes], { type: "application/pdf" })
    );
  };

  return {
    downloadTextAsFile,
    exportPlainText,
    serializeCurrentDocToHtml,
    exportHtmlDocument,
    exportWordDocument,
    exportImageDocument,
    printDocument,
    exportPdfDocument,
    copyShareLink,
    copyEmbedCode,
  };
};
