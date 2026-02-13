/*
 * 文件说明：标题节点渲染适配。
 * 主要职责：根据标题级别设置字体大小与行高，并生成 runs。
 */

import { textblockToRuns } from "lumenpage-core";

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

export const headingNodeSpec = {
  content: "inline*",

  group: "block",

  attrs: {
    id: { default: null },

    level: { default: 1 },

    align: { default: "left" },
  },

  parseDOM: [
    {
      tag: "h1",

      getAttrs: (dom) => ({
        id: readIdAttr(dom),

        level: 1,

        align: dom.style.textAlign || "left",
      }),
    },

    {
      tag: "h2",

      getAttrs: (dom) => ({
        id: readIdAttr(dom),

        level: 2,

        align: dom.style.textAlign || "left",
      }),
    },

    {
      tag: "h3",

      getAttrs: (dom) => ({
        id: readIdAttr(dom),

        level: 3,

        align: dom.style.textAlign || "left",
      }),
    },
  ],

  toDOM(node) {
    const level = Math.max(1, Math.min(3, Number(node.attrs.level) || 1));

    const align = node.attrs.align || "left";

    const attrs = align !== "left" ? { style: `text-align:${align}` } : {};

    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }

    return [`h${level}`, attrs, 0];
  },
};

const getHeadingStyle = (level, baseFont) => {
  const match = /(\d+(?:\.\d+)?)px\s+(.*)/.exec(baseFont);

  const baseSize = match ? Number.parseFloat(match[1]) : 16;

  const family = match ? match[2] : "Arial";

  const scale = level === 1 ? 1.6 : level === 2 ? 1.35 : 1.2;

  const size = Math.max(12, Math.round(baseSize * scale));

  return {
    font: `bold ${size}px ${family}`,

    lineHeight: Math.max(size + 8, size * 1.2),
  };
};

export const headingRenderer = {
  allowSplit: true,

  toRuns(node, settings) {
    const level = Math.max(1, Math.min(3, Number(node.attrs?.level) || 1));

    const { font, lineHeight } = getHeadingStyle(level, settings.font);

    const runs = textblockToRuns(node, { ...settings, font }, node.type.name, null, node.attrs);

    return { ...runs, blockAttrs: { ...node.attrs, lineHeight } };
  },

  renderLine({ defaultRender, line, pageX, pageTop, layout }) {
    defaultRender(line, pageX, pageTop, layout);
  },
};
