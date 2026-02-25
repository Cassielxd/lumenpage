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
  searchReplaceActions,
  quickInsertActions,
}: ToolbarActionContext): ToolbarHandlerRecord => ({
  undo: () => {
    runWithNotice("undo", getToolbarTexts().alertCannotUndo);
  },
  redo: () => {
    runWithNotice("redo", getToolbarTexts().alertCannotRedo);
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
  "inline-code": () => {
    run("toggleInlineCode");
  },
  "clear-format": () => {
    textFormatActions.clearFormat();
  },
  "ordered-list": () => {
    run("toggleOrderedList");
  },
  "bullet-list": () => {
    run("toggleBulletList");
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
