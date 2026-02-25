import { Schema } from "lumenpage-model";
import { docToOffsetText } from "lumenpage-view-canvas";
import {
  paragraphNodeSpec,
  blockquoteNodeSpec,
  headingNodeSpec,
  codeBlockNodeSpec,
  horizontalRuleNodeSpec,
  hardBreakNodeSpec,
  pageBreakNodeSpec,
} from "lumenpage-node-basic";
import {
  getTableTextLength,
  serializeTableToText,
  tableNodeSpecs,
} from "lumenpage-node-table";
import { listNodeSpecs } from "lumenpage-node-list";
import { imageNodeSpec, videoNodeSpec } from "lumenpage-node-media";
import { sanitizeLinkHref } from "lumenpage-link";

export { serializeTableToText, getTableTextLength };

const normalizeStyleColor = (value: string | null | undefined) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const normalizeStyleFontFamily = (value: string | null | undefined) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  // Drop style-breaking separators; keep a plain font-family list string.
  return text.replace(/[{};]/g, "").trim() || null;
};

const normalizeStyleFontSize = (value: string | null | undefined) => {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
};

const normalizeTextStyleAttrs = (attrs: {
  color?: string | null;
  background?: string | null;
  fontSize?: number | null;
  fontFamily?: string | null;
}) => {
  const color = normalizeStyleColor(attrs.color);
  const background = normalizeStyleColor(attrs.background);
  const fontFamily = normalizeStyleFontFamily(attrs.fontFamily);
  const fontSize = Number.isFinite(attrs.fontSize as number) ? Math.round(Number(attrs.fontSize)) : null;
  if (!color && !background && !fontFamily && !fontSize) {
    return null;
  }
  return {
    color,
    background,
    fontSize: fontSize && fontSize > 0 ? fontSize : null,
    fontFamily,
  };
};

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

// Workspace default schema.
export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },

    paragraph: withIdAttr(paragraphNodeSpec),
    heading: withIdAttr(headingNodeSpec),
    blockquote: withIdAttr(blockquoteNodeSpec),
    code_block: withIdAttr(codeBlockNodeSpec),
    horizontal_rule: withIdAttr(horizontalRuleNodeSpec),
    page_break: withIdAttr(pageBreakNodeSpec),
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
          getAttrs: (dom) => {
            const safeHref = sanitizeLinkHref(dom.getAttribute("href"));
            if (!safeHref) {
              return false;
            }
            return {
              href: safeHref,
              title: dom.getAttribute("title"),
            };
          },
        },
      ],
      toDOM(node) {
        const attrs = { href: sanitizeLinkHref(node.attrs.href) || "#", title: node.attrs.title };
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

    subscript: {
      parseDOM: [
        { tag: "sub" },
        {
          style: "vertical-align",
          getAttrs: (value) => (String(value || "").toLowerCase() === "sub" ? {} : false),
        },
      ],
      toDOM() {
        return ["sub", 0];
      },
    },

    superscript: {
      parseDOM: [
        { tag: "sup" },
        {
          style: "vertical-align",
          getAttrs: (value) => (String(value || "").toLowerCase() === "super" ? {} : false),
        },
      ],
      toDOM() {
        return ["sup", 0];
      },
    },

    text_style: {
      attrs: {
        color: { default: null },
        background: { default: null },
        fontSize: { default: null },
        fontFamily: { default: null },
      },
      parseDOM: [
        {
          tag: "span",
          getAttrs: (dom) => {
            const color = normalizeStyleColor(dom.style.color);
            const background = normalizeStyleColor(dom.style.backgroundColor);
            const fontSize = normalizeStyleFontSize(dom.style.fontSize);
            const fontFamily = normalizeStyleFontFamily(dom.style.fontFamily);
            return normalizeTextStyleAttrs({ color, background, fontSize, fontFamily }) || false;
          },
        },
      ],
      toDOM(node) {
        const attrs = normalizeTextStyleAttrs({
          color: node.attrs?.color,
          background: node.attrs?.background,
          fontSize: node.attrs?.fontSize,
          fontFamily: node.attrs?.fontFamily,
        });
        if (!attrs) {
          return ["span", 0];
        }
        const styles: string[] = [];
        if (attrs.color) {
          styles.push(`color:${attrs.color}`);
        }
        if (attrs.background) {
          styles.push(`background-color:${attrs.background}`);
        }
        if (attrs.fontFamily) {
          styles.push(`font-family:${attrs.fontFamily}`);
        }
        if (attrs.fontSize) {
          styles.push(`font-size:${attrs.fontSize}px`);
        }
        return ["span", { style: styles.join(";") }, 0];
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



