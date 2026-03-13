import type { PlaygroundLocale } from "../i18n";
import { openMentionPicker } from "lumenpage-extension-mention";
import { sanitizeLinkHref } from "lumenpage-link";
import { TextSelection } from "lumenpage-state";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";

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

const resolveTexts = (locale: PlaygroundLocale): InsertAdvancedTexts =>
  locale === "en-US"
    ? {
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
      }
    : {
        promptAudioUrl: "\u97f3\u9891\u5730\u5740",
        promptAudioTitle: "\u97f3\u9891\u6807\u9898",
        promptFileUrl: "\u6587\u4ef6\u5730\u5740",
        promptFileName: "\u6587\u4ef6\u540d",
        promptMathExpr: "\u6570\u5b66\u516c\u5f0f",
        promptColumnsCount: "\u5217\u6570\uff082-4\uff09",
        promptTagText: "\u6807\u7b7e\u6587\u672c",
        promptCalloutText: "\u63d0\u793a\u6587\u672c",
        promptBookmarkUrl: "\u4e66\u7b7e\u5730\u5740",
        promptBookmarkTitle: "\u4e66\u7b7e\u6807\u9898",
        promptOptionText: "\u9009\u9879\u5217\u8868\uff08\u9017\u53f7\u6216\u6362\u884c\u5206\u9694\uff09",
        promptTextBoxText: "\u6587\u672c\u6846\u5185\u5bb9",
        promptWebPageUrl: "\u7f51\u9875\u5730\u5740",
        promptWebPageTitle: "\u7f51\u9875\u6807\u9898",
        promptTemplateTitle: "\u6a21\u677f\u6807\u9898",
        promptTemplateSummary: "\u6a21\u677f\u6458\u8981",
        promptTemplateItems: "\u6a21\u677f\u6761\u76ee\uff08\u9017\u53f7\u5206\u9694\uff09",
        insertBookmarkPrefix: "\u4e66\u7b7e",
        insertWebPagePrefix: "\u7f51\u9875",
        insertAudioPrefix: "\u97f3\u9891",
        insertFilePrefix: "\u6587\u4ef6",
        insertCalloutPrefix: "\u63d0\u793a",
        insertTextBoxPrefix: "\u6587\u672c\u6846",
        insertTemplatePrefix: "\u6a21\u677f",
        defaultCallout: "\u91cd\u8981\u63d0\u793a",
        defaultTextBox: "\u53ef\u7f16\u8f91\u6587\u672c\u6846",
        defaultBookmarkTitle: "\u53c2\u8003\u8d44\u6599",
        defaultWebPageTitle: "\u5d4c\u5165\u9875\u9762",
        defaultAudioTitle: "\u97f3\u9891\u7247\u6bb5",
        defaultFileName: "\u9644\u4ef6",
        defaultMathExpr: "E = mc^2",
        defaultTag: "\u6807\u7b7e",
        defaultOptionText: "\u9009\u9879 A,\u9009\u9879 B",
        defaultColumnsCount: "2",
        defaultTemplateTitle: "\u9879\u76ee\u8ba1\u5212",
        defaultTemplateSummary: "\u8303\u56f4\u3001\u91cc\u7a0b\u7891\u548c\u8d1f\u8d23\u4eba\u3002",
        defaultTemplateItems: "\u91cc\u7a0b\u7891,\u8d1f\u8d23\u4eba,\u98ce\u9669",
        labelColumn: "\u5217",
      };

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

const isParagraphNode = (node: any) => node?.type?.name === "paragraph";

const findTablePosAround = (doc: any, pos: number) => {
  if (!doc || !Number.isFinite(pos)) {
    return null;
  }
  const maxPos = Number(doc.content?.size ?? 0);
  const seeds = [pos, pos - 1, pos + 1, pos - 2, pos + 2];
  for (const seed of seeds) {
    const candidate = Math.max(0, Math.min(maxPos, seed));
    const direct = doc.nodeAt(candidate);
    if (direct?.type?.name === "table") {
      return candidate;
    }
    const $pos = doc.resolve(candidate);
    const before = $pos.nodeBefore;
    if (before?.type?.name === "table") {
      return candidate - before.nodeSize;
    }
    const after = $pos.nodeAfter;
    if (after?.type?.name === "table") {
      return candidate;
    }
  }
  return null;
};

const replaceSelectionWithNode = (getView: GetView, node: any) => {
  const payload = getViewState(getView);
  if (!payload || !node) {
    return false;
  }
  const { view, state } = payload;
  if (node?.type?.name === "table") {
    const paragraphType = state.schema?.nodes?.paragraph;
    const from = Number(state.selection?.from);
    if (!Number.isFinite(from)) {
      return false;
    }
    let tr = state.tr.replaceSelectionWith(node, false);
    let tablePos = findTablePosAround(tr.doc, tr.mapping.map(from, -1));
    if (!Number.isFinite(tablePos)) {
      view.dispatch(tr.scrollIntoView());
      return true;
    }
    const ensureParagraph = () =>
      paragraphType?.createAndFill?.() ?? paragraphType?.create?.() ?? null;

    const $before = tr.doc.resolve(tablePos);
    if (!isParagraphNode($before.nodeBefore)) {
      const paragraphBefore = ensureParagraph();
      if (paragraphBefore) {
        tr = tr.insert(tablePos, paragraphBefore);
        tablePos += paragraphBefore.nodeSize;
      }
    }

    const insertedTable = tr.doc.nodeAt(tablePos);
    if (!insertedTable || insertedTable.type?.name !== "table") {
      view.dispatch(tr.scrollIntoView());
      return true;
    }
    const afterPos = tablePos + insertedTable.nodeSize;
    const $after = tr.doc.resolve(afterPos);
    let trailingParagraphPos = afterPos;
    if (!isParagraphNode($after.nodeAfter)) {
      const paragraphAfter = ensureParagraph();
      if (paragraphAfter) {
        tr = tr.insert(afterPos, paragraphAfter);
      } else {
        trailingParagraphPos = null;
      }
    }
    if (Number.isFinite(trailingParagraphPos)) {
      try {
        tr = tr.setSelection(TextSelection.create(tr.doc, trailingParagraphPos + 1));
      } catch (_error) {
        // Keep transaction selection when mapping near document boundary fails.
      }
    }
    view.dispatch(tr.scrollIntoView());
    return true;
  }
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
  const rowType = schema?.nodes?.tableRow;
  const cellType = schema?.nodes?.tableCell;
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
  const taskListType = schema?.nodes?.taskList;
  const taskItemType = schema?.nodes?.taskItem;
  if (!taskListType || !taskItemType) {
    return null;
  }
  const safeItems = (items || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (safeItems.length === 0) {
    return null;
  }
  const taskItems = [];
  for (const item of safeItems) {
    const paragraph = createParagraphNode(schema, item);
    if (!paragraph) {
      return null;
    }
    const taskItem =
      taskItemType.createAndFill?.({ checked: false }, [paragraph]) ??
      taskItemType.create?.({ checked: false }, [paragraph]) ??
      null;
    if (!taskItem) {
      return null;
    }
    taskItems.push(taskItem);
  }
  return (
    taskListType.createAndFill?.(null, taskItems) ??
    taskListType.create?.(null, taskItems) ??
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
  const bulletListType = schema?.nodes?.bulletList;
  const listItemType = schema?.nodes?.listItem;
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
    return false;
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
  run,
  getLocaleKey,
  requestInputDialog,
}: {
  getView: GetView;
  run: (name: string, ...args: unknown[]) => boolean;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const dialogTitle = (en: string, zh: string) => (getLocaleKey() === "en-US" ? en : zh);

  const readInput = async ({
    title,
    label,
    defaultValue = "",
    required = false,
    type = "text",
  }: {
    title: string;
    label: string;
    defaultValue?: string;
    required?: boolean;
    type?: "text" | "textarea" | "number";
  }) => {
    const result = await requestInputDialog({
      title,
      fields: [
        {
          key: "value",
          label,
          type,
          defaultValue,
          required,
        },
      ],
    });
    if (!result) {
      return null;
    }
    return String(result.value || "").trim();
  };

  const insertAudio = async () => {
    const texts = resolveTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: dialogTitle("Insert Audio", "插入音频"),
      width: 560,
      fields: [
        {
          key: "href",
          label: texts.promptAudioUrl,
          defaultValue: "https://",
          required: true,
        },
        {
          key: "title",
          label: texts.promptAudioTitle,
          defaultValue: texts.defaultAudioTitle,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const href = String(result.href || "").trim();
    if (!href) {
      return false;
    }
    const title = String(result.title || "").trim() || texts.defaultAudioTitle;
    if (run("insertAudio", { src: href, title })) {
      return true;
    }
    return insertReference(getView, texts.insertAudioPrefix, title, href);
  };

  const insertFile = async () => {
    const texts = resolveTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: dialogTitle("Insert File", "插入附件"),
      width: 560,
      fields: [
        {
          key: "href",
          label: texts.promptFileUrl,
          defaultValue: "https://",
          required: true,
        },
        {
          key: "name",
          label: texts.promptFileName,
          defaultValue: texts.defaultFileName,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const href = String(result.href || "").trim();
    if (!href) {
      return false;
    }
    const name = String(result.name || "").trim() || texts.defaultFileName;
    if (run("insertFile", { href, name })) {
      return true;
    }
    return insertReference(getView, texts.insertFilePrefix, name, href);
  };

  const insertMath = async () => {
    const texts = resolveTexts(getLocaleKey());
    const expr = await readInput({
      title: dialogTitle("Insert Formula", "插入公式"),
      label: texts.promptMathExpr,
      defaultValue: texts.defaultMathExpr,
      required: true,
    });
    if (!expr) {
      return false;
    }
    if (run("insertMath", { source: expr })) {
      return true;
    }
    return insertText(getView, `$$ ${expr} $$`);
  };

  const insertColumns = async () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const raw = await readInput({
      title: dialogTitle("Insert Columns", "插入分栏"),
      label: texts.promptColumnsCount,
      defaultValue: texts.defaultColumnsCount,
      type: "number",
      required: true,
    });
    if (!raw) {
      return false;
    }
    const count = Number.parseInt(raw, 10);
    if (!Number.isFinite(count)) {
      return false;
    }
    const safeCount = Math.max(2, Math.min(4, count));
    if (run("insertColumns", { count: safeCount })) {
      return true;
    }
    const tableNode = createTableNode(payload.state.schema, 1, safeCount, (_rowIndex, colIndex) => {
      return `${texts.labelColumn} ${colIndex + 1}`;
    });
    if (!tableNode) {
      return false;
    }
    return replaceSelectionWithNode(getView, tableNode);
  };

  const insertTag = async () => {
    const texts = resolveTexts(getLocaleKey());
    const raw = await readInput({
      title: dialogTitle("Insert Tag", "插入标签"),
      label: texts.promptTagText,
      defaultValue: texts.defaultTag,
      required: true,
    });
    if (!raw) {
      return false;
    }
    const tag = raw.replace(/^#+/, "").trim();
    if (!tag) {
      return false;
    }
    if (run("insertTag", { label: tag })) {
      return true;
    }
    return insertText(getView, `#${tag}`);
  };

  const insertCallout = async () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const raw = await readInput({
      title: dialogTitle("Insert Callout", "插入提示块"),
      label: texts.promptCalloutText,
      defaultValue: texts.defaultCallout,
      type: "textarea",
    });
    if (raw === null) {
      return false;
    }
    const content = raw || texts.defaultCallout;
    if (run("insertCallout", { title: texts.insertCalloutPrefix, text: content, tone: "info" })) {
      return true;
    }
    const schema = payload.state.schema;
    const blockquoteType = schema?.nodes?.blockquote;
    if (!blockquoteType) {
      return false;
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

  const insertBookmark = async () => {
    const texts = resolveTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: dialogTitle("Insert Bookmark", "插入书签"),
      width: 560,
      fields: [
        {
          key: "href",
          label: texts.promptBookmarkUrl,
          defaultValue: "https://",
          required: true,
        },
        {
          key: "title",
          label: texts.promptBookmarkTitle,
          defaultValue: texts.defaultBookmarkTitle,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const href = String(result.href || "").trim();
    if (!href) {
      return false;
    }
    const title = String(result.title || "").trim() || texts.defaultBookmarkTitle;
    if (run("insertBookmark", { href, title })) {
      return true;
    }
    return insertReference(getView, texts.insertBookmarkPrefix, title, href);
  };

  const insertOptionBox = async () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const raw = await readInput({
      title: dialogTitle("Insert Option Box", "插入多选框"),
      label: texts.promptOptionText,
      defaultValue: texts.defaultOptionText,
      type: "textarea",
      required: true,
    });
    if (!raw) {
      return false;
    }
    const items = parseListItemsInput(raw);
    if (run("insertOptionBox", { title: "Options", items })) {
      return true;
    }
    const taskListNode = createTaskListNode(payload.state.schema, items);
    if (!taskListNode) {
      return false;
    }
    return replaceSelectionWithNode(getView, taskListNode);
  };

  const insertTextBox = async () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const raw = await readInput({
      title: dialogTitle("Insert Text Box", "插入文本框"),
      label: texts.promptTextBoxText,
      defaultValue: texts.defaultTextBox,
      type: "textarea",
    });
    if (raw === null) {
      return false;
    }
    const content = raw || texts.defaultTextBox;
    if (run("insertTextBox", { title: texts.insertTextBoxPrefix, text: content })) {
      return true;
    }
    const tableNode = createTableNode(payload.state.schema, 1, 1, () => content);
    if (!tableNode) {
      return false;
    }
    return replaceSelectionWithNode(getView, tableNode);
  };

  const insertWebPage = async () => {
    const texts = resolveTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: dialogTitle("Insert Web Page", "插入网页"),
      width: 560,
      fields: [
        {
          key: "href",
          label: texts.promptWebPageUrl,
          defaultValue: "https://",
          required: true,
        },
        {
          key: "title",
          label: texts.promptWebPageTitle,
          defaultValue: texts.defaultWebPageTitle,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const href = String(result.href || "").trim();
    if (!href) {
      return false;
    }
    const title = String(result.title || "").trim() || texts.defaultWebPageTitle;
    if (run("insertWebPage", { href, title })) {
      return true;
    }
    return insertReference(getView, texts.insertWebPagePrefix, title, href);
  };

  const insertMention = () => {
    const view = getView();
    if (!view) {
      return false;
    }
    return openMentionPicker(view);
  };

  const insertTemplate = async () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = resolveTexts(getLocaleKey());
    const result = await requestInputDialog({
      title: dialogTitle("Insert Template", "插入模板"),
      width: 560,
      fields: [
        {
          key: "title",
          label: texts.promptTemplateTitle,
          defaultValue: texts.defaultTemplateTitle,
          required: true,
        },
        {
          key: "summary",
          label: texts.promptTemplateSummary,
          defaultValue: texts.defaultTemplateSummary,
          type: "textarea",
          required: true,
        },
        {
          key: "items",
          label: texts.promptTemplateItems,
          defaultValue: texts.defaultTemplateItems,
          type: "textarea",
          required: true,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const title = String(result.title || "").trim() || texts.defaultTemplateTitle;
    const summary = String(result.summary || "").trim() || texts.defaultTemplateSummary;
    const items = parseListItemsInput(String(result.items || ""));
    if (run("insertTemplate", { title, summary, items })) {
      return true;
    }
    const headingNode = createHeadingNode(payload.state.schema, title, 2);
    const summaryNode = createParagraphNode(payload.state.schema, summary);
    const bulletNode = createBulletListNode(payload.state.schema, items);
    const structuredNodes = [headingNode, summaryNode, bulletNode].filter(Boolean);
    if (structuredNodes.length === 0) {
      return false;
    }
    return insertNodesAtSelection(getView, structuredNodes);
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
