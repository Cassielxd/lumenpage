import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";
import { invokeCommand } from "../commandUtils";

export const createTextActionHandlers = ({
  getEditorCommands,
  notifyCommandFailure,
  getToolbarTexts,
  layoutActions,
  tableActions,
  markdownActions,
  inlineMediaActions,
  textFormatActions,
  textStyleActions,
  searchReplaceActions,
  importActions,
  quickInsertActions,
}: ToolbarActionContext): ToolbarHandlerRecord => ({
  undo: () => {
    const commands = getEditorCommands();
    notifyCommandFailure(invokeCommand(commands?.undo), getToolbarTexts().alertCannotUndo);
  },
  redo: () => {
    const commands = getEditorCommands();
    notifyCommandFailure(invokeCommand(commands?.redo), getToolbarTexts().alertCannotRedo);
  },
  "format-painter": () => {
    textFormatActions.toggleFormatPainter();
  },
  bold: () => {
    invokeCommand(getEditorCommands()?.toggleBold);
  },
  italic: () => {
    invokeCommand(getEditorCommands()?.toggleItalic);
  },
  underline: () => {
    invokeCommand(getEditorCommands()?.toggleUnderline);
  },
  strike: () => {
    invokeCommand(getEditorCommands()?.toggleStrike);
  },
  subscript: () => {
    invokeCommand(getEditorCommands()?.toggleSubscript);
  },
  superscript: () => {
    invokeCommand(getEditorCommands()?.toggleSuperscript);
  },
  "inline-code": () => {
    invokeCommand(getEditorCommands()?.toggleInlineCode);
  },
  "clear-format": () => {
    textFormatActions.clearFormat();
  },
  "font-family": () => {
    textStyleActions.applyFontFamilySetting();
  },
  "font-size": () => {
    textStyleActions.applyFontSizeSetting();
  },
  color: () => {
    textStyleActions.applyTextColorSetting();
  },
  "background-color": () => {
    textStyleActions.applyTextBackgroundSetting();
  },
  highlight: () => {
    textStyleActions.highlightSelection();
  },
  "ordered-list": () => {
    invokeCommand(getEditorCommands()?.toggleOrderedList);
  },
  "bullet-list": () => {
    invokeCommand(getEditorCommands()?.toggleBulletList);
  },
  "task-list": () => {
    invokeCommand(getEditorCommands()?.toggleTaskList);
  },
  indent: () => {
    invokeCommand(getEditorCommands()?.indent);
  },
  outdent: () => {
    invokeCommand(getEditorCommands()?.outdent);
  },
  "line-height": () => {
    layoutActions.applyLineHeightSetting();
  },
  margin: () => {
    layoutActions.applyParagraphSpacingSetting();
  },
  "align-left": () => {
    invokeCommand(getEditorCommands()?.alignLeft);
  },
  "align-center": () => {
    invokeCommand(getEditorCommands()?.alignCenter);
  },
  "align-right": () => {
    invokeCommand(getEditorCommands()?.alignRight);
  },
  "align-justify": () => {
    invokeCommand(getEditorCommands()?.alignJustify);
  },
  "align-distributed": () => {
    invokeCommand(getEditorCommands()?.alignDistributed);
  },
  quote: () => {
    invokeCommand(getEditorCommands()?.toggleBlockquote);
  },
  markdown: async () => {
    await markdownActions.handleMarkdownAction();
  },
  "search-replace": () => {
    searchReplaceActions.searchAndReplace();
  },
  "import-word": async () => {
    await importActions.importWordDocument();
  },
  link: () => {
    inlineMediaActions.toggleLink();
  },
  "code-block": () => {
    const commands = getEditorCommands();
    if (!invokeCommand(commands?.toggleCodeBlock)) {
      invokeCommand(commands?.setCodeBlock);
    }
  },
  image: () => {
    inlineMediaActions.insertImage();
  },
  video: () => {
    inlineMediaActions.insertVideo();
  },
  symbol: () => {
    quickInsertActions.insertSymbol();
  },
  emoji: () => {
    quickInsertActions.insertEmoji();
  },
  "chinese-date": () => {
    quickInsertActions.insertChineseDate();
  },
  hr: () => {
    invokeCommand(getEditorCommands()?.insertHorizontalRule);
  },
  "hard-break": () => {
    invokeCommand(getEditorCommands()?.insertHardBreak);
  },
  "page-break": () => {
    invokeCommand(getEditorCommands()?.insertPageBreak);
  },
  "table-insert": () => {
    tableActions.insertTable();
  },
  "select-all": () => {
    layoutActions.selectAllContent();
  },
});
