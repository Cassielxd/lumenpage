

import { Schema } from "lumenpage-model";
import { docToOffsetText } from "lumenpage-view-canvas";
import { paragraphNodeSpec } from "lumenpage-node-paragraph";
import { blockquoteNodeSpec } from "lumenpage-node-blockquote";
import { headingNodeSpec } from "lumenpage-node-heading";
import { codeBlockNodeSpec } from "lumenpage-node-code-block";
import {
  getTableTextLength,
  serializeTableToText,
  tableNodeSpecs,
} from "lumenpage-node-table";
import { listNodeSpecs } from "lumenpage-node-list";
import { imageNodeSpec } from "lumenpage-node-image";
import { horizontalRuleNodeSpec } from "lumenpage-node-horizontal-rule";
import { hardBreakNodeSpec } from "lumenpage-node-hard-break";
import { videoNodeSpec } from "lumenpage-node-video";

export { serializeTableToText, getTableTextLength };

const withIdAttr = (spec) => ({
  ...spec,
  attrs: {
    id: { default: null },
    ...(spec?.attrs || {}),
  },
});

const withIdAttrsForRecord = (specs) => {
  const next = {};
  for (const [name, spec] of Object.entries(specs || {})) {
    next[name] = withIdAttr(spec);
  }
  return next;
};

export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },

    paragraph: withIdAttr(paragraphNodeSpec),

    heading: withIdAttr(headingNodeSpec),

    blockquote: withIdAttr(blockquoteNodeSpec),

    code_block: withIdAttr(codeBlockNodeSpec),

    horizontal_rule: withIdAttr(horizontalRuleNodeSpec),

    ...withIdAttrsForRecord(listNodeSpecs),

    ...withIdAttrsForRecord(tableNodeSpecs),

    image: withIdAttr(imageNodeSpec),

    video: withIdAttr(videoNodeSpec),

    hard_break: withIdAttr(hardBreakNodeSpec),

    text: { group: "inline" },
  },

  marks: {
    strong: {
      parseDOM: [
        { tag: "strong" },

        { tag: "b" },

        {
          style: "font-weight",

          getAttrs: (value) => (value === "bold" ? {} : false),
        },
      ],

      toDOM() {
        return ["strong", 0];
      },
    },

    em: {
      parseDOM: [
        { tag: "em" },

        { tag: "i" },

        {
          style: "font-style",

          getAttrs: (value) => (value === "italic" ? {} : false),
        },
      ],

      toDOM() {
        return ["em", 0];
      },
    },

    underline: {
      parseDOM: [
        { tag: "u" },

        {
          style: "text-decoration",

          getAttrs: (value) => (value && value.includes("underline") ? {} : false),
        },
      ],

      toDOM() {
        return ["u", 0];
      },
    },

    link: {
      attrs: {
        href: {},
        title: { default: null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: "a[href]",
          getAttrs: (dom) => ({
            href: dom.getAttribute("href"),
            title: dom.getAttribute("title"),
          }),
        },
      ],
      toDOM(node) {
        const attrs = { href: node.attrs.href, title: node.attrs.title };
        if (!attrs.title) {
          delete attrs.title;
        }
        return ["a", attrs, 0];
      },
    },

    code: {
      parseDOM: [{ tag: "code" }],
      toDOM() {
        return ["code", 0];
      },
    },

    strike: {
      parseDOM: [
        { tag: "s" },
        { tag: "del" },
        { tag: "strike" },
        {
          style: "text-decoration",
          getAttrs: (value) => (value && value.includes("line-through") ? {} : false),
        },
      ],
      toDOM() {
        return ["s", 0];
      },
    },
  },
});

export function createDocFromText(text = "") {
  const lines = text.split("\n");

  const blocks = lines.map((line) =>
    schema.node("paragraph", null, line ? schema.text(line) : undefined)
  );

  if (blocks.length === 0) {
    return schema.node("doc", null, [schema.node("paragraph")]);
  }

  return schema.node("doc", null, blocks);
}

export function docToText(doc) {
  return docToOffsetText(doc);
}
