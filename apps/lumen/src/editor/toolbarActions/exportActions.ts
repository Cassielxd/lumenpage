import type { PlaygroundLocale } from "../i18n";
import {
  downloadBlobAsFile,
  downloadDataUrlAsFile,
  downloadTextAsFile,
} from "./export/downloadHelpers";
import { buildHtmlPreviewDocument, serializeViewDocToHtml } from "./export/htmlExportHelpers";
import { openPrintPreviewDialog } from "./export/printPreviewDialog";
import { buildPdfFromCanvasPages } from "./export/pdfBuilder";
import {
  buildCanvasPreviewDocument,
  collectRenderedPageCanvases,
} from "./export/renderedPagesHelpers";
import { createShareClipboardActions } from "./export/shareClipboardActions";
import { buildWordHtmlDocument } from "./export/wordExportHelpers";

type GetView = () => any;
const EXPORT_PREVIEW_HTML_FILENAME = "lumen-print-preview.html";
const EXPORT_WORD_FILENAME = "lumen-document.doc";

export const createExportActions = ({
  getView,
  getLocaleKey,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
}) => {
  // Raw semantic HTML (without preview shell); kept for integration reuse.
  const serializeCurrentDocToHtml = () => serializeViewDocToHtml(getView());
  const { copyShareLink, copyEmbedCode } = createShareClipboardActions({ getLocaleKey });

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

  const exportWordDocument = () => {
    const html = serializeCurrentDocToHtml();
    if (typeof html !== "string") {
      return false;
    }
    const wordHtml = buildWordHtmlDocument(html);
    return downloadTextAsFile(EXPORT_WORD_FILENAME, wordHtml, "application/msword;charset=utf-8");
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
