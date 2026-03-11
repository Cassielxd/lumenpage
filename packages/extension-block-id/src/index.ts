import { Extension } from "lumenpage-core";
import { createBlockIdPlugin, createBlockIdTransaction } from "lumenpage-view-canvas";

const readIdAttr = (element: any) => element?.getAttribute?.("data-node-id") || null;

const BLOCK_ID_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "pageBreak",
  "bulletList",
  "orderedList",
  "taskList",
  "listItem",
  "taskItem",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "image",
  "video",
] as const;

export const BlockIdExtension = Extension.create({
  name: "block-id",
  priority: 950,
  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_ID_TYPES],
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => readIdAttr(element),
            renderHTML: (attrs) => (attrs.id ? { "data-node-id": attrs.id } : {}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [createBlockIdPlugin()];
  },
  addStateTransforms() {
    return [
      (state: any) => {
        const tr = createBlockIdTransaction(state);
        return tr ? state.apply(tr) : state;
      },
    ];
  },
});

export const createBlockIdExtension = () => BlockIdExtension;

export const BlockId = BlockIdExtension;
