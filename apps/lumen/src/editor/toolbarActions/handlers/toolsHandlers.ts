import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";

export const createToolsActionHandlers = ({ toolsActions }: ToolbarActionContext): ToolbarHandlerRecord => ({
  qrcode: () => {
    toolsActions.insertQrCode();
  },
  barcode: () => {
    toolsActions.insertBarcode();
  },
  signature: () => {
    toolsActions.insertSignature();
  },
  diagrams: () => {
    toolsActions.insertDiagrams();
  },
  echarts: () => {
    toolsActions.insertEcharts();
  },
  mermaid: () => {
    toolsActions.insertMermaid();
  },
  "mind-map": () => {
    toolsActions.insertMindMap();
  },
  "chinese-case": () => {
    toolsActions.convertChineseCase();
  },
});
