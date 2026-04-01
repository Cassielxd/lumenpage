import { createPlaygroundI18n, type PlaygroundLocale } from "../i18n";
import { openMentionPicker } from "lumenpage-extension-mention";
import { sanitizeLinkHref } from "lumenpage-link";
import { TextSelection } from "lumenpage-state";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import type { GetEditorCommandMap } from "./commandUtils";
import { invokeCommand } from "./commandUtils";

type GetView = () => any;

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
  getEditorCommands,
  getLocaleKey,
  requestInputDialog,
}: {
  getView: GetView;
  getEditorCommands: GetEditorCommandMap;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const getTexts = () => createPlaygroundI18n(getLocaleKey()).insertAdvancedActions;

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
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleInsertAudio,
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
    if (invokeCommand(getEditorCommands()?.insertAudio, { src: href, title })) {
      return true;
    }
    return insertReference(getView, texts.insertAudioPrefix, title, href);
  };

  const insertFile = async () => {
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleInsertFile,
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
    if (invokeCommand(getEditorCommands()?.insertFile, { href, name })) {
      return true;
    }
    return insertReference(getView, texts.insertFilePrefix, name, href);
  };

  const insertTag = async () => {
    const texts = getTexts();
    const raw = await readInput({
      title: texts.titleInsertTag,
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
    if (invokeCommand(getEditorCommands()?.insertTag, { label: tag })) {
      return true;
    }
    return insertText(getView, `#${tag}`);
  };

  const insertCallout = async () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = getTexts();
    const raw = await readInput({
      title: texts.titleInsertCallout,
      label: texts.promptCalloutText,
      defaultValue: texts.defaultCallout,
      type: "textarea",
    });
    if (raw === null) {
      return false;
    }
    const content = raw || texts.defaultCallout;
    if (
      invokeCommand(getEditorCommands()?.insertCallout, {
        title: texts.insertCalloutPrefix,
        text: content,
        tone: "info",
      })
    ) {
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
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleInsertBookmark,
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
    if (invokeCommand(getEditorCommands()?.insertBookmark, { href, title })) {
      return true;
    }
    return insertReference(getView, texts.insertBookmarkPrefix, title, href);
  };

  const insertOptionBox = async () => {
    const payload = getViewState(getView);
    if (!payload) {
      return false;
    }
    const texts = getTexts();
    const raw = await readInput({
      title: texts.titleInsertOptionBox,
      label: texts.promptOptionText,
      defaultValue: texts.defaultOptionText,
      type: "textarea",
      required: true,
    });
    if (!raw) {
      return false;
    }
    const items = parseListItemsInput(raw);
    if (invokeCommand(getEditorCommands()?.insertOptionBox, { title: texts.optionBoxTitle, items })) {
      return true;
    }
    const taskListNode = createTaskListNode(payload.state.schema, items);
    if (!taskListNode) {
      return false;
    }
    return replaceSelectionWithNode(getView, taskListNode);
  };

  const insertWebPage = async () => {
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleInsertWebPage,
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
    if (invokeCommand(getEditorCommands()?.insertWebPage, { href, title })) {
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
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleInsertTemplate,
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
    if (invokeCommand(getEditorCommands()?.insertTemplate, { title, summary, items })) {
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
    insertTag,
    insertCallout,
    insertBookmark,
    insertOptionBox,
    insertWebPage,
    insertMention,
    insertTemplate,
  };
};
