import type { ToolbarItemConfig } from "../../toolbarCatalog";
import type { EditorSessionMode } from "../../sessionMode";
import type { GetEditorCommandMap } from "../commandUtils";

export type RunCommand = (name: string, ...args: unknown[]) => boolean;
export type NotifyCommandFailure = (ok: boolean, message: string) => boolean;
export type ToolbarActionResult = boolean | Promise<boolean>;

export type ToolbarTexts = {
  alertCannotUndo: string;
  alertCannotRedo: string;
  alertTableCellRequired: string;
  alertMergeRightUnavailable: string;
  alertSplitCellUnavailable: string;
};

export type LayoutActions = {
  refreshLayoutAndRender: () => ToolbarActionResult;
  applyLineHeightSetting: () => ToolbarActionResult;
  applyParagraphSpacingSetting: () => ToolbarActionResult;
  selectAllContent: () => ToolbarActionResult;
  applyPageMarginSetting: () => ToolbarActionResult;
  applyPageSizeSetting: () => ToolbarActionResult;
  togglePageOrientation: () => ToolbarActionResult;
  togglePageLineNumbers: () => ToolbarActionResult;
  toggleTocPlaceholder: () => ToolbarActionResult;
  applyPageBackgroundSetting: () => ToolbarActionResult;
  applyPageWatermarkSetting: () => ToolbarActionResult;
  applyPageHeaderSetting: () => ToolbarActionResult;
  applyPageFooterSetting: () => ToolbarActionResult;
};

export type TableActions = {
  insertTable: () => ToolbarActionResult;
  deleteCurrentTable: () => boolean;
  toggleHeaderRow: () => boolean;
  toggleHeaderColumn: () => boolean;
  toggleHeaderCell: () => boolean;
  applyCellAlignmentSetting: () => ToolbarActionResult;
  getCurrentCellBackgroundColor?: () => string | null;
  setCurrentCellBackgroundColor?: (color: string | null) => ToolbarActionResult;
};

export type ExportActions = {
  printDocument: () => ToolbarActionResult;
  exportImageDocument: () => ToolbarActionResult;
  exportPdfDocument: () => ToolbarActionResult;
  exportPlainText: () => ToolbarActionResult;
  exportHtmlDocument: () => ToolbarActionResult;
  exportWordDocument: () => ToolbarActionResult;
  copyShareLink: () => Promise<boolean>;
  copyEmbedCode: () => Promise<boolean>;
};

export type MarkdownActions = {
  handleMarkdownAction: () => ToolbarActionResult;
};

export type InlineMediaActions = {
  toggleLink: () => ToolbarActionResult;
  insertImage: () => ToolbarActionResult;
  insertVideo: () => ToolbarActionResult;
};

export type TextFormatActions = {
  clearFormat: () => ToolbarActionResult;
  toggleFormatPainter: () => ToolbarActionResult;
};

export type TextStyleActions = {
  applyFontFamilySetting: () => ToolbarActionResult;
  applyFontSizeSetting: () => ToolbarActionResult;
  applyTextColorSetting: () => ToolbarActionResult;
  applyTextBackgroundSetting: () => ToolbarActionResult;
  highlightSelection: () => ToolbarActionResult;
};

export type SearchReplaceActions = {
  searchAndReplace: () => ToolbarActionResult;
};

export type ImportActions = {
  importWordDocument: () => ToolbarActionResult;
};

export type QuickInsertActions = {
  insertSymbol: () => ToolbarActionResult;
  insertEmoji: () => ToolbarActionResult;
  insertChineseDate: () => ToolbarActionResult;
};

export type InsertAdvancedActions = {
  insertAudio: () => ToolbarActionResult;
  insertFile: () => ToolbarActionResult;
  insertTag: () => ToolbarActionResult;
  insertCallout: () => ToolbarActionResult;
  insertMention: () => ToolbarActionResult;
  insertBookmark: () => ToolbarActionResult;
  insertOptionBox: () => ToolbarActionResult;
  insertTemplate: () => ToolbarActionResult;
  insertWebPage: () => ToolbarActionResult;
};

export type ToolsActions = {
  insertQrCode: () => ToolbarActionResult;
  insertBarcode: () => ToolbarActionResult;
  insertSignature: () => ToolbarActionResult;
  insertDiagrams: () => ToolbarActionResult;
  insertEcharts: () => ToolbarActionResult;
  insertMermaid: () => ToolbarActionResult;
  insertMindMap: () => ToolbarActionResult;
  convertChineseCase: () => ToolbarActionResult;
};

export type ToolbarActionHandler = () => void | Promise<void>;

export type ToolbarActionContext = {
  run: RunCommand;
  getEditorCommands: GetEditorCommandMap;
  getEditorCanCommands: GetEditorCommandMap;
  notifyCommandFailure: NotifyCommandFailure;
  getToolbarTexts: () => ToolbarTexts;
  toggleTocPanel: () => void;
  getSessionMode: () => EditorSessionMode;
  setSessionMode: (value: EditorSessionMode) => void;
  toggleSessionMode: () => void;
  layoutActions: LayoutActions;
  tableActions: TableActions;
  exportActions: ExportActions;
  markdownActions: MarkdownActions;
  inlineMediaActions: InlineMediaActions;
  textFormatActions: TextFormatActions;
  textStyleActions: TextStyleActions;
  searchReplaceActions: SearchReplaceActions;
  importActions: ImportActions;
  quickInsertActions: QuickInsertActions;
  insertAdvancedActions: InsertAdvancedActions;
  toolsActions: ToolsActions;
};

export type ToolbarHandlerRecord = Record<string, ToolbarActionHandler>;

export type ToolbarItemActionHandler = (item: ToolbarItemConfig) => void;
