/*
 * 文件说明：段落节点渲染配置。
 * 主要职责：负责普通段落的 runs 生成与排版属性。
 */

import { type NodeSpec } from "lumenpage-model";
import { textblockToRuns } from "lumenpage-view-canvas";

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

export const paragraphNodeSpec: NodeSpec = {
  content: "inline*",

  group: "block",

  attrs: {
    id: { default: null },

    align: { default: "left" },

    indent: { default: 0 },
  },

  parseDOM: [
    {
      tag: "p",

      getAttrs: (dom) => {
        const align = dom.style.textAlign || "left";

        const indentValue = dom.style.textIndent || "0";

        const indent = Number.parseFloat(indentValue) || 0;

        return { align, indent, id: readIdAttr(dom) };
      },
    },
  ],

  toDOM(node) {
    const { align, indent, id } = node.attrs;

    const styles = [];

    if (align && align !== "left") {
      styles.push(`text-align:${align}`);
    }

    if (indent) {
      styles.push(`text-indent:${indent}px`);
    }

    const attrs = styles.length > 0 ? { style: styles.join(";") } : {};

    if (id) {
      attrs["data-node-id"] = id;
    }

    return ["p", attrs, 0];
  },
};

export const paragraphRenderer = {
  allowSplit: true,

  toRuns(node, settings) {
    return textblockToRuns(node, settings, node.type.name, null, node.attrs);
  },

  renderLine({ defaultRender, line, pageX, pageTop, layout }) {
    defaultRender(line, pageX, pageTop, layout);
  },
};

