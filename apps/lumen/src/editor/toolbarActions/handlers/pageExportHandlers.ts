import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";

export const createPageExportActionHandlers = ({
  layoutActions,
  exportActions,
}: ToolbarActionContext): ToolbarHandlerRecord => ({
  print: () => {
    exportActions.printDocument();
  },
  "page-preview": () => {
    exportActions.printDocument();
  },
  "page-margin": () => {
    layoutActions.applyPageMarginSetting();
  },
  "page-size": () => {
    layoutActions.applyPageSizeSetting();
  },
  "page-orientation": () => {
    layoutActions.togglePageOrientation();
  },
  "page-break-marks": () => {
    layoutActions.togglePageBreakMarks();
  },
  "page-line-number": () => {
    layoutActions.togglePageLineNumbers();
  },
  "page-watermark": () => {
    layoutActions.applyPageWatermarkSetting();
  },
  "page-background": () => {
    layoutActions.applyPageBackgroundSetting();
  },
  "export-image": () => {
    exportActions.exportImageDocument();
  },
  "export-pdf": () => {
    exportActions.exportPdfDocument();
  },
  "export-text": () => {
    exportActions.exportPlainText();
  },
  "export-html": () => {
    exportActions.exportHtmlDocument();
  },
  "export-word": () => {
    exportActions.exportWordDocument();
  },
  share: async () => {
    await exportActions.copyShareLink();
  },
  embed: async () => {
    await exportActions.copyEmbedCode();
  },
});
