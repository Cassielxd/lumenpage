import { type NodeSpec } from "lumenpage-model";
import { containerOffsetMapping } from "./offsetMapping.js";

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

const parseListItemChecked = (dom) => {
  const checkedAttr = String(dom?.getAttribute?.("data-checked") || "")
    .trim()
    .toLowerCase();
  if (checkedAttr === "true" || checkedAttr === "1" || checkedAttr === "yes") {
    return true;
  }
  if (checkedAttr === "false" || checkedAttr === "0" || checkedAttr === "no") {
    return false;
  }
  if (dom?.classList?.contains?.("is-checked")) {
    return true;
  }
  const checkbox = dom?.querySelector?.("input[type=checkbox]");
  if (checkbox && checkbox.checked === true) {
    return true;
  }
  return false;
};

const parseTaskListAttrs = (dom) => ({ id: readIdAttr(dom) });
const isTaskListDom = (dom) =>
  dom?.hasAttribute?.("data-task-list") ||
  dom?.getAttribute?.("data-type") === "taskList" ||
  dom?.getAttribute?.("data-type") === "task-list";

export const listNodeSpecs: Record<string, NodeSpec> = {
  bulletList: {
    group: "block",
    content: "listItem+",
    attrs: {
      id: { default: null },
    },
    offsetMapping: containerOffsetMapping,
    parseDOM: [
      {
        tag: "ul",
        getAttrs: (dom) => (isTaskListDom(dom) ? false : { id: readIdAttr(dom) }),
      },
    ],
    toDOM(node) {
      const attrs: Record<string, unknown> = {};
      if (node.attrs?.id) {
        attrs["data-node-id"] = node.attrs.id;
      }
      return ["ul", attrs, 0];
    },
  },

  orderedList: {
    group: "block",
    content: "listItem+",
    attrs: {
      id: { default: null },
      order: { default: 1 },
    },
    offsetMapping: containerOffsetMapping,
    parseDOM: [
      {
        tag: "ol",
        getAttrs: (dom) => {
          const start = dom.getAttribute("start");
          const order = start ? Number.parseInt(start, 10) || 1 : 1;
          return { order, id: readIdAttr(dom) };
        },
      },
    ],
    toDOM(node) {
      const attrs: Record<string, unknown> = {};
      if (node.attrs?.order && node.attrs.order !== 1) {
        attrs.start = node.attrs.order;
      }
      if (node.attrs?.id) {
        attrs["data-node-id"] = node.attrs.id;
      }
      return ["ol", attrs, 0];
    },
  },

  taskList: {
    group: "block",
    content: "taskItem+",
    attrs: {
      id: { default: null },
    },
    offsetMapping: containerOffsetMapping,
    parseDOM: [
      { tag: "ul[data-task-list]", getAttrs: parseTaskListAttrs },
      { tag: "ul[data-type=taskList]", getAttrs: parseTaskListAttrs },
      { tag: "ul[data-type=task-list]", getAttrs: parseTaskListAttrs },
    ],
    toDOM(node) {
      const attrs: Record<string, unknown> = {
        "data-task-list": "true",
        "data-type": "taskList",
      };
      if (node.attrs?.id) {
        attrs["data-node-id"] = node.attrs.id;
      }
      return ["ul", attrs, 0];
    },
  },

  listItem: {
    content: "block+",
    attrs: {},
    offsetMapping: containerOffsetMapping,
    parseDOM: [{ tag: "li" }],
    toDOM() {
      return ["li", 0];
    },
  },

  taskItem: {
    content: "block+",
    attrs: {
      checked: { default: false },
    },
    offsetMapping: containerOffsetMapping,
    parseDOM: [
      {
        tag: "li",
        getAttrs: (dom) => ({
          checked: parseListItemChecked(dom),
        }),
      },
    ],
    toDOM(node) {
      const attrs: Record<string, unknown> = {};
      if (node.attrs?.checked === true) {
        attrs["data-checked"] = "true";
        attrs.class = "is-checked";
      }
      return ["li", attrs, 0];
    },
  },
};
