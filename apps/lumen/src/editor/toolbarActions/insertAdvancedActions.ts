import type { PlaygroundLocale } from "../i18n";
import { openMentionPicker } from "lumenpage-editor-plugins";
import { sanitizeLinkHref } from "lumenpage-link";
import { TextSelection } from "lumenpage-state";

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
  promptOptionText: "Option items (comma/new line separated)",
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
  defaultOptionText: "Option A,Option B",
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

const createTaskListNode = (schema: any, items: string[]) => {
  const taskListType = schema?.nodes?.task_list;
  const listItemType = schema?.nodes?.list_item;
  if (!taskListType || !listItemType) {
    return null;
  }
  const safeItems = (items || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (safeItems.length === 0) {
    return null;
  }
  const listItems = [];
  for (const item of safeItems) {
    const paragraph = createParagraphNode(schema, item);
    if (!paragraph) {
      return null;
    }
    const listItem =
      listItemType.createAndFill?.({ checked: false }, [paragraph]) ??
      listItemType.create?.({ checked: false }, [paragraph]) ??
      null;
    if (!listItem) {
      return null;
    }
    listItems.push(listItem);
  }
  return (
    taskListType.createAndFill?.(null, listItems) ??
    taskListType.create?.(null, listItems) ??
    null
  );
};

const createHeadingNode = (schema: any, text: string, level = 2) => {
  const headingType = schema?.nodes?.heading;
  if (!headingType) {
    return null;
  }
  const content = text ? [schema.text(text)] : undefined;
  return (
    headingType.createAndFill?.({ level }, content) ??
    headingType.create?.({ level }, content) ??
    null
  );
};

const createBulletListNode = (schema: any, items: string[]) => {
  const bulletListType = schema?.nodes?.bullet_list;
  const listItemType = schema?.nodes?.list_item;
  if (!bulletListType || !listItemType) {
    return null;
  }
  const safeItems = (items || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (safeItems.length === 0) {
    return null;
  }
  const listItems = [];
  for (const item of safeItems) {
    const paragraph = createParagraphNode(schema, item);
    if (!paragraph) {
      return null;
    }
    const listItem =
      listItemType.createAndFill?.(null, [paragraph]) ?? listItemType.create?.(null, [paragraph]) ?? null;
    if (!listItem) {
      return null;
    }
    listItems.push(listItem);
  }
  return (
    bulletListType.createAndFill?.(null, listItems) ??
    bulletListType.create?.(null, listItems) ??
    null
  );
};

const readPrompt = (message: string, defaultValue = "") => {
  const raw = window.prompt(message, defaultValue);
  if (raw === null) {
    return null;
  }
  return String(raw).trim();
};

const insertReference = (getView: GetView, prefix: string, title: string, href: string) => {
  const payload = getViewState(getView);
  if (!payload) {
    return false;
  }
  const safeHref = sanitizeLinkHref(href);
  if (!safeHref) {
    return false;
  }
  const label = `${prefix}: ${title}`;
  const schema = payload.state.schema;
  const linkType = schema?.marks?.link;
  if (!linkType) {
    return insertText(getView, `[${label}](${safeHref})`);
  }
  const linkMark = linkType.create({ href: safeHref, title });
  const textNode = schema.text(label, [linkMark]);
  if (!textNode) {
    return false;
  }
  const tr = payload.state.tr.replaceSelectionWith(textNode, false);
  payload.view.dispatch(tr.scrollIntoView());
  return true;
};

const insertNodesAtSelection = (getView: GetView, nodes: any[]) => {
  const payload = getViewState(getView);
  const safeNodes = (nodes || []).filter(Boolean);
  if (!payload || safeNodes.length === 0) {
    return false;
  }
  const { view, state } = payload;
  const from = state.selection.from;
  const to = state.selection.to;
  let tr = state.tr.delete(from, to);
  let insertPos = from;
  for (const node of safeNodes) {
    tr = tr.insert(insertPos, node);
    insertPos += node.nodeSize;
  }
  try {
    tr = tr.setSelection(TextSelection.create(tr.doc, insertPos));
  } catch (_error) {
    // Keep current selection when cursor relocation fails at edge positions.
  }
  view.dispatch(tr.scrollIntoView());
  return true;
};

const parseListItemsInput = (raw: string) =>
  String(raw || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

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
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const raw = readPrompt(texts.promptOptionText, texts.defaultOptionText);
    if (!raw) {
      return false;
    }
    const items = parseListItemsInput(raw);
    const taskListNode = createTaskListNode(payload.state.schema, items);
    if (!taskListNode) {
      return insertText(
        getView,
        items.length > 0 ? items.map((item) => `[ ] ${item}`).join("\n") : `[ ] ${raw}`
      );
    }
    return replaceSelectionWithNode(getView, taskListNode);
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
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
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
    const items = parseListItemsInput(itemsInput);
    const headingNode = createHeadingNode(payload.state.schema, title, 2);
    const summaryNode = createParagraphNode(payload.state.schema, summary);
    const bulletNode = createBulletListNode(payload.state.schema, items);
    const structuredNodes = [headingNode, summaryNode, bulletNode].filter(Boolean);
    if (structuredNodes.length > 0 && insertNodesAtSelection(getView, structuredNodes)) {
      return true;
    }
    const bulletText = (items.length > 0 ? items : ["Item 1", "Item 2"]).map((item) => `- ${item}`);
    const fallbackText = [
      `[${texts.insertTemplatePrefix}] ${title}`,
      summary,
      "",
      bulletText.join("\n"),
      "",
    ].join("\n");
    return insertText(getView, fallbackText);
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
