import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";

export const createPageExportActionHandlers = ({
  layoutActions,
  exportActions,
  toggleTocPanel,
}: ToolbarActionContext): ToolbarHandlerRecord => ({
  print: () => {
    exportActions.printDocument();
  },
  "page-preview": () => {
    exportActions.printDocument();
  },
  "toggle-toc": () => {
    toggleTocPanel();
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
  "page-line-number": () => {
    layoutActions.togglePageLineNumbers();
  },
  "page-watermark": () => {
    layoutActions.applyPageWatermarkSetting();
  },
  "page-background": () => {
    layoutActions.applyPageBackgroundSetting();
  },
  "page-header": () => {
    layoutActions.applyPageHeaderSetting();
  },
  "page-footer": () => {
    layoutActions.applyPageFooterSetting();
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
