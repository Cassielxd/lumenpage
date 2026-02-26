import type { ToolbarActionContext, ToolbarHandlerRecord } from "./types";

export const createTextActionHandlers = ({
  run,
  runWithNotice,
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
    runWithNotice("undo", getToolbarTexts().alertCannotUndo);
  },
  redo: () => {
    runWithNotice("redo", getToolbarTexts().alertCannotRedo);
  },
  "format-painter": () => {
    textFormatActions.toggleFormatPainter();
  },
  bold: () => {
    run("toggleBold");
  },
  italic: () => {
    run("toggleItalic");
  },
  underline: () => {
    run("toggleUnderline");
  },
  strike: () => {
    run("toggleStrike");
  },
  subscript: () => {
    run("toggleSubscript");
  },
  superscript: () => {
    run("toggleSuperscript");
  },
  "inline-code": () => {
    run("toggleInlineCode");
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
    run("toggleOrderedList");
  },
  "bullet-list": () => {
    run("toggleBulletList");
  },
  "task-list": () => {
    run("toggleTaskList");
  },
  indent: () => {
    run("indent");
  },
  outdent: () => {
    run("outdent");
  },
  "line-height": () => {
    layoutActions.applyLineHeightSetting();
  },
  margin: () => {
    layoutActions.applyParagraphSpacingSetting();
  },
  "align-left": () => {
    run("alignLeft");
  },
  "align-center": () => {
    run("alignCenter");
  },
  "align-right": () => {
    run("alignRight");
  },
  "align-justify": () => {
    run("alignJustify");
  },
  "align-distributed": () => {
    run("alignDistributed");
  },
  quote: () => {
    run("toggleBlockquote");
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
    if (!run("toggleCodeBlock")) {
      run("setBlockType", "code_block");
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
    run("insertHorizontalRule");
  },
  "hard-break": () => {
    run("insertHardBreak");
  },
  "page-break": () => {
    run("insertPageBreak");
  },
  "table-insert": () => {
    tableActions.insertTable();
  },
  "select-all": () => {
    layoutActions.selectAllContent();
  },
});
