import type { ToolbarItemConfig } from "../../toolbarCatalog";
import type { EditorSessionMode } from "../../sessionMode";

export type RunCommand = (name: string, ...args: unknown[]) => boolean;
export type RunWithNotice = (name: string, message: string, ...args: unknown[]) => boolean;

export type ToolbarTexts = {
  alertCannotUndo: string;
  alertCannotRedo: string;
  alertTableCellRequired: string;
  alertMergeRightUnavailable: string;
  alertSplitCellUnavailable: string;
};

export type LayoutActions = {
  refreshLayoutAndRender: () => boolean;
  applyLineHeightSetting: () => boolean;
  applyParagraphSpacingSetting: () => boolean;
  selectAllContent: () => boolean;
  applyPageMarginSetting: () => boolean;
  applyPageSizeSetting: () => boolean;
  togglePageOrientation: () => boolean;
  togglePageBreakMarks: () => boolean;
  togglePageLineNumbers: () => boolean;
  toggleTocPlaceholder: () => boolean;
  applyPageBackgroundSetting: () => boolean;
  applyPageWatermarkSetting: () => boolean;
  applyPageHeaderSetting: () => boolean;
  applyPageFooterSetting: () => boolean;
};

export type TableActions = {
  insertTable: () => boolean;
  deleteCurrentTable: () => boolean;
  toggleHeaderRow: () => boolean;
  toggleHeaderColumn: () => boolean;
  toggleHeaderCell: () => boolean;
  applyCellAlignmentSetting: () => boolean;
};

export type ExportActions = {
  printDocument: () => boolean;
  exportImageDocument: () => boolean;
  exportPdfDocument: () => boolean;
  exportPlainText: () => boolean;
  exportHtmlDocument: () => boolean;
  exportWordDocument: () => boolean;
  copyShareLink: () => Promise<boolean>;
  copyEmbedCode: () => Promise<boolean>;
};

export type MarkdownActions = {
  handleMarkdownAction: () => Promise<boolean>;
};

export type InlineMediaActions = {
  toggleLink: () => boolean;
  insertImage: () => boolean;
  insertVideo: () => boolean;
};

export type TextFormatActions = {
  clearFormat: () => boolean;
  toggleFormatPainter: () => boolean;
};

export type TextStyleActions = {
  applyFontFamilySetting: () => boolean;
  applyFontSizeSetting: () => boolean;
  applyTextColorSetting: () => boolean;
  applyTextBackgroundSetting: () => boolean;
  highlightSelection: () => boolean;
};

export type SearchReplaceActions = {
  searchAndReplace: () => boolean;
};

export type ImportActions = {
  importWordDocument: () => Promise<boolean>;
};

export type QuickInsertActions = {
  insertSymbol: () => boolean;
  insertEmoji: () => boolean;
  insertChineseDate: () => boolean;
};

export type InsertAdvancedActions = {
  insertAudio: () => boolean;
  insertFile: () => boolean;
  insertMath: () => boolean;
  insertColumns: () => boolean;
  insertTag: () => boolean;
  insertCallout: () => boolean;
  insertMention: () => boolean;
  insertBookmark: () => boolean;
  insertOptionBox: () => boolean;
  insertTemplate: () => boolean;
  insertTextBox: () => boolean;
  insertWebPage: () => boolean;
};

export type ToolsActions = {
  insertQrCode: () => boolean;
  insertBarcode: () => boolean;
  insertSignature: () => boolean;
  insertSeal: () => boolean;
  insertDiagrams: () => boolean;
  insertEcharts: () => boolean;
  insertMermaid: () => boolean;
  insertMindMap: () => boolean;
  convertChineseCase: () => boolean;
};

export type ToolbarActionHandler = () => void | Promise<void>;

export type ToolbarActionContext = {
  run: RunCommand;
  runWithNotice: RunWithNotice;
  getToolbarTexts: () => ToolbarTexts;
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
