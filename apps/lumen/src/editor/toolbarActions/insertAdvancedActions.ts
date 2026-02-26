import type { PlaygroundLocale } from "../i18n";
import { openMentionPicker } from "lumenpage-editor-plugins";

type GetView = () => any;

type InsertAdvancedTexts = {
  promptAudioUrl: string;
  promptAudioTitle: string;
  promptFileUrl: string;
  promptFileName: string;
  promptMathExpr: string;
  promptColumnsCount: string;
  promptTagText: string;
  promptCalloutText: string;
  promptBookmarkUrl: string;
  promptBookmarkTitle: string;
  promptOptionText: string;
  promptTextBoxText: string;
  promptWebPageUrl: string;
  promptWebPageTitle: string;
  promptTemplateTitle: string;
  promptTemplateSummary: string;
  promptTemplateItems: string;
  insertBookmarkPrefix: string;
  insertWebPagePrefix: string;
  insertAudioPrefix: string;
  insertFilePrefix: string;
  insertCalloutPrefix: string;
  insertTextBoxPrefix: string;
  insertTemplatePrefix: string;
  defaultCallout: string;
  defaultTextBox: string;
  defaultBookmarkTitle: string;
  defaultWebPageTitle: string;
  defaultAudioTitle: string;
  defaultFileName: string;
  defaultMathExpr: string;
  defaultTag: string;
  defaultOptionText: string;
  defaultColumnsCount: string;
  defaultTemplateTitle: string;
  defaultTemplateSummary: string;
  defaultTemplateItems: string;
  labelColumn: string;
};

const resolveTexts = (_locale: PlaygroundLocale): InsertAdvancedTexts => ({
  promptAudioUrl: "Audio URL",
  promptAudioTitle: "Audio title",
  promptFileUrl: "File URL",
  promptFileName: "File name",
  promptMathExpr: "Math expression",
  promptColumnsCount: "Column count (2-4)",
  promptTagText: "Tag text",
  promptCalloutText: "Callout text",
  promptBookmarkUrl: "Bookmark URL",
  promptBookmarkTitle: "Bookmark title",
  promptOptionText: "Option text",
  promptTextBoxText: "Text box content",
  promptWebPageUrl: "Web page URL",
  promptWebPageTitle: "Web page title",
  promptTemplateTitle: "Template title",
  promptTemplateSummary: "Template summary",
  promptTemplateItems: "Template bullet items (comma separated)",
  insertBookmarkPrefix: "Bookmark",
  insertWebPagePrefix: "WebPage",
  insertAudioPrefix: "Audio",
  insertFilePrefix: "File",
  insertCalloutPrefix: "Callout",
  insertTextBoxPrefix: "TextBox",
  insertTemplatePrefix: "Template",
  defaultCallout: "Important note",
  defaultTextBox: "Editable text box",
  defaultBookmarkTitle: "Reference",
  defaultWebPageTitle: "Embedded page",
  defaultAudioTitle: "Audio clip",
  defaultFileName: "Attachment",
  defaultMathExpr: "E = mc^2",
  defaultTag: "tag",
  defaultOptionText: "Option",
  defaultColumnsCount: "2",
  defaultTemplateTitle: "Project Plan",
  defaultTemplateSummary: "Scope, milestones, and owners.",
  defaultTemplateItems: "Milestone,Owner,Risk",
  labelColumn: "Column",
});

const getViewState = (getView: GetView) => {
  const view = getView();
  const state = view?.state;
  if (!view || !state?.tr) {
    return null;
  }
  return { view, state };
};

const insertText = (getView: GetView, value: string) => {
  const payload = getViewState(getView);
  const text = String(value || "");
  if (!payload || !text) {
    return false;
  }
  const { view, state } = payload;
  const tr = state.tr.insertText(text, state.selection.from, state.selection.to);
  view.dispatch(tr.scrollIntoView());
  return true;
};

const replaceSelectionWithNode = (getView: GetView, node: any) => {
  const payload = getViewState(getView);
  if (!payload || !node) {
    return false;
  }
  const { view, state } = payload;
  const tr = state.tr.replaceSelectionWith(node);
  view.dispatch(tr.scrollIntoView());
  return true;
};

const createParagraphNode = (schema: any, text: string) => {
  const paragraphType = schema?.nodes?.paragraph;
  if (!paragraphType) {
    return null;
  }
  const content = text ? [schema.text(text)] : undefined;
  return paragraphType.createAndFill?.(null, content) ?? paragraphType.create?.(null, content) ?? null;
};

const createTableNode = (
  schema: any,
  rows: number,
  cols: number,
  getCellText: (rowIndex: number, colIndex: number) => string
) => {
  const tableType = schema?.nodes?.table;
  const rowType = schema?.nodes?.table_row;
  const cellType = schema?.nodes?.table_cell;
  if (!tableType || !rowType || !cellType) {
    return null;
  }
  const safeRows = Math.max(1, Math.min(20, Math.floor(rows)));
  const safeCols = Math.max(1, Math.min(20, Math.floor(cols)));
  const tableRows = [];
  for (let rowIndex = 0; rowIndex < safeRows; rowIndex += 1) {
    const cells = [];
    for (let colIndex = 0; colIndex < safeCols; colIndex += 1) {
      const paragraph = createParagraphNode(schema, getCellText(rowIndex, colIndex));
      const cell =
        cellType.createAndFill?.(null, paragraph ? [paragraph] : undefined) ??
        cellType.create?.(null, paragraph ? [paragraph] : undefined) ??
        null;
      if (!cell) {
        return null;
      }
      cells.push(cell);
    }
    tableRows.push(rowType.create(null, cells));
  }
  return tableType.createAndFill?.(null, tableRows) ?? tableType.create?.(null, tableRows) ?? null;
};

const readPrompt = (message: string, defaultValue = "") => {
  const raw = window.prompt(message, defaultValue);
  if (raw === null) {
    return null;
  }
  return String(raw).trim();
};

const insertReference = (getView: GetView, prefix: string, title: string, href: string) =>
  insertText(getView, `[${prefix}: ${title}](${href})`);

export const createInsertAdvancedActions = ({
  getView,
  getLocaleKey,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
}) => {
  const insertAudio = () => {
    const texts = resolveTexts(getLocaleKey());
    const href = readPrompt(texts.promptAudioUrl, "https://");
    if (!href) {
      return false;
    }
    const title = readPrompt(texts.promptAudioTitle, texts.defaultAudioTitle);
    if (title === null) {
      return false;
    }
    return insertReference(getView, texts.insertAudioPrefix, title || texts.defaultAudioTitle, href);
  };

  const insertFile = () => {
    const texts = resolveTexts(getLocaleKey());
    const href = readPrompt(texts.promptFileUrl, "https://");
    if (!href) {
      return false;
    }
    const name = readPrompt(texts.promptFileName, texts.defaultFileName);
    if (name === null) {
      return false;
    }
    return insertReference(getView, texts.insertFilePrefix, name || texts.defaultFileName, href);
  };

  const insertMath = () => {
    const texts = resolveTexts(getLocaleKey());
    const expr = readPrompt(texts.promptMathExpr, texts.defaultMathExpr);
    if (!expr) {
      return false;
    }
    return insertText(getView, `$$ ${expr} $$`);
  };

  const insertColumns = () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const raw = readPrompt(texts.promptColumnsCount, texts.defaultColumnsCount);
    if (!raw) {
      return false;
    }
    const count = Number.parseInt(raw, 10);
    if (!Number.isFinite(count)) {
      return false;
    }
    const safeCount = Math.max(2, Math.min(4, count));
    const tableNode = createTableNode(payload.state.schema, 1, safeCount, (_rowIndex, colIndex) => {
      return `${texts.labelColumn} ${colIndex + 1}`;
    });
    if (!tableNode) {
      return false;
    }
    return replaceSelectionWithNode(getView, tableNode);
  };

  const insertTag = () => {
    const texts = resolveTexts(getLocaleKey());
    const raw = readPrompt(texts.promptTagText, texts.defaultTag);
    if (!raw) {
      return false;
    }
    const tag = raw.replace(/^#+/, "").trim();
    if (!tag) {
      return false;
    }
    return insertText(getView, `#${tag}`);
  };

  const insertCallout = () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const raw = readPrompt(texts.promptCalloutText, texts.defaultCallout);
    if (raw === null) {
      return false;
    }
    const content = raw || texts.defaultCallout;
    const schema = payload.state.schema;
    const blockquoteType = schema?.nodes?.blockquote;
    if (!blockquoteType) {
      return insertText(getView, `[${texts.insertCalloutPrefix}] ${content}`);
    }
    const paragraph = createParagraphNode(schema, content);
    const node =
      blockquoteType.createAndFill?.(null, paragraph ? [paragraph] : undefined) ??
      blockquoteType.create?.(null, paragraph ? [paragraph] : undefined) ??
      null;
    if (!node) {
      return false;
    }
    return replaceSelectionWithNode(getView, node);
  };

  const insertBookmark = () => {
    const texts = resolveTexts(getLocaleKey());
    const href = readPrompt(texts.promptBookmarkUrl, "https://");
    if (!href) {
      return false;
    }
    const title = readPrompt(texts.promptBookmarkTitle, texts.defaultBookmarkTitle);
    if (title === null) {
      return false;
    }
    return insertReference(
      getView,
      texts.insertBookmarkPrefix,
      title || texts.defaultBookmarkTitle,
      href
    );
  };

  const insertOptionBox = () => {
    const texts = resolveTexts(getLocaleKey());
    const raw = readPrompt(texts.promptOptionText, texts.defaultOptionText);
    if (!raw) {
      return false;
    }
    return insertText(getView, `[ ] ${raw}`);
  };

  const insertTextBox = () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const raw = readPrompt(texts.promptTextBoxText, texts.defaultTextBox);
    if (raw === null) {
      return false;
    }
    const content = raw || texts.defaultTextBox;
    const tableNode = createTableNode(payload.state.schema, 1, 1, () => content);
    if (!tableNode) {
      return insertText(getView, `[${texts.insertTextBoxPrefix}] ${content}`);
    }
    return replaceSelectionWithNode(getView, tableNode);
  };

  const insertWebPage = () => {
    const texts = resolveTexts(getLocaleKey());
    const href = readPrompt(texts.promptWebPageUrl, "https://");
    if (!href) {
      return false;
    }
    const title = readPrompt(texts.promptWebPageTitle, texts.defaultWebPageTitle);
    if (title === null) {
      return false;
    }
    return insertReference(
      getView,
      texts.insertWebPagePrefix,
      title || texts.defaultWebPageTitle,
      href
    );
  };

  const insertMention = () => {
    const view = getView();
    if (!view) {
      return false;
    }
    return openMentionPicker(view);
  };

  const insertTemplate = () => {
    const texts = resolveTexts(getLocaleKey());
    const titleInput = readPrompt(texts.promptTemplateTitle, texts.defaultTemplateTitle);
    if (titleInput === null) {
      return false;
    }
    const summaryInput = readPrompt(texts.promptTemplateSummary, texts.defaultTemplateSummary);
    if (summaryInput === null) {
      return false;
    }
    const itemsInput = readPrompt(texts.promptTemplateItems, texts.defaultTemplateItems);
    if (itemsInput === null) {
      return false;
    }
    const title = titleInput || texts.defaultTemplateTitle;
    const summary = summaryInput || texts.defaultTemplateSummary;
    const items = itemsInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `- ${item}`);
    const bulletText = items.length > 0 ? items.join("\n") : "- Item 1\n- Item 2";
    const templateText = [
      `[${texts.insertTemplatePrefix}] ${title}`,
      summary,
      "",
      bulletText,
      "",
    ].join("\n");
    return insertText(getView, templateText);
  };

  return {
    insertAudio,
    insertFile,
    insertMath,
    insertColumns,
    insertTag,
    insertCallout,
    insertBookmark,
    insertOptionBox,
    insertTextBox,
    insertWebPage,
    insertMention,
    insertTemplate,
  };
};
