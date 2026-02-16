

import { Schema } from "lumenpage-model";
import { paragraphNodeSpec } from "lumenpage-node-paragraph";
import { blockquoteNodeSpec } from "lumenpage-node-blockquote";
import { headingNodeSpec } from "lumenpage-node-heading";
import { codeBlockNodeSpec } from "lumenpage-node-code-block";
import {
  getTableTextLength,
  serializeTableToText,
  tableNodeSpecs,
} from "lumenpage-node-table";
import { listNodeSpecs, serializeListToText } from "lumenpage-node-list";
import { imageNodeSpec, serializeImageToText } from "lumenpage-node-image";
import { horizontalRuleNodeSpec } from "lumenpage-node-horizontal-rule";
import { hardBreakNodeSpec } from "lumenpage-node-hard-break";
import { videoNodeSpec, serializeVideoToText } from "lumenpage-node-video";

export { serializeTableToText, getTableTextLength };

export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },

    blockquote: blockquoteNodeSpec,

    code_block: codeBlockNodeSpec,

    horizontal_rule: horizontalRuleNodeSpec,

    paragraph: paragraphNodeSpec,

    heading: headingNodeSpec,

    ...listNodeSpecs,

    ...tableNodeSpecs,

    image: imageNodeSpec,

    video: videoNodeSpec,

    hard_break: hardBreakNodeSpec,

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
  let result = "";

  const serializeBlock = (node) => {
    if (node.type.name === "table") {
      return serializeTableToText(node);
    }

    if (node.type.name === "bullet_list" || node.type.name === "ordered_list") {
      return serializeListToText(node);
    }

    if (node.type.name === "image") {
      return serializeImageToText();
    }

    if (node.type.name === "video") {
      return serializeVideoToText();
    }

    if (node.type.name === "horizontal_rule") {
      return "----";
    }

    return node.textBetween(0, node.content.size, "\n");
  };

  doc.forEach((node, _pos, index) => {
    result += serializeBlock(node);

    if (index < doc.childCount - 1) {
      result += "\n";
    }
  });

  return result;
}
