import { textblockToRuns } from "../core/index";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const paragraphNodeSpec: any = {
  content: "inline*",
  group: "block",
  attrs: {
    id: { default: null },
    align: { default: "left" },
    indent: { default: 0 },
    spacingBefore: { default: null },
    spacingAfter: { default: null },
  },
  parseDOM: [
    {
      tag: "p",
      getAttrs: (dom: HTMLElement) => ({
        id: readIdAttr(dom),
        align: dom.style.textAlign || "left",
        indent: Number.parseFloat(dom.style.textIndent || "0") || 0,
        spacingBefore: Number.parseFloat(dom.style.marginTop || "") || null,
        spacingAfter: Number.parseFloat(dom.style.marginBottom || "") || null,
      }),
    },
  ],
  toDOM(node) {
    const styles: string[] = [];
    const { align, indent, id, spacingBefore, spacingAfter } = node.attrs || {};
    if (align && align !== "left") {
      styles.push(`text-align:${align}`);
    }
    if (indent) {
      styles.push(`text-indent:${indent}px`);
    }
    if (Number.isFinite(spacingBefore)) {
      styles.push(`margin-top:${spacingBefore}px`);
    }
    if (Number.isFinite(spacingAfter)) {
      styles.push(`margin-bottom:${spacingAfter}px`);
    }
    const attrs: Record<string, unknown> = styles.length > 0 ? { style: styles.join(";") } : {};
    if (id) {
      attrs["data-node-id"] = id;
    }
    return ["p", attrs, 0];
  },
};

export const paragraphRenderer = {
  allowSplit: true,
  toRuns(node: any, settings: any) {
    return textblockToRuns(node, settings, node.type.name, node.attrs?.id ?? null, node.attrs);
  },
  renderLine({ defaultRender, line, pageX, pageTop, layout }: any) {
    defaultRender(line, pageX, pageTop, layout);
  },
};


