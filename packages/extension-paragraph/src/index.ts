import { Node } from "lumenpage-core";
import { paragraphRenderer } from "./paragraph";

export { paragraphNodeSpec, paragraphRenderer } from "./paragraph";

export const Paragraph = Node.create({
  name: "paragraph",
  priority: 100,
  content: "inline*",
  group: "block",
  addAttributes() {
    return {
      align: {
        default: "left",
        parseHTML: (element) => element?.style?.textAlign || "left",
        renderHTML: (attrs) =>
          attrs.align && attrs.align !== "left" ? { style: `text-align:${attrs.align}` } : {},
      },
      indent: {
        default: 0,
        parseHTML: (element) => Number.parseFloat(element?.style?.textIndent || "0") || 0,
        renderHTML: (attrs) =>
          Number(attrs.indent) ? { style: `text-indent:${Number(attrs.indent)}px` } : {},
      },
      spacingBefore: {
        default: null,
        parseHTML: (element) => Number.parseFloat(element?.style?.marginTop || "") || null,
        renderHTML: (attrs) =>
          Number.isFinite(attrs.spacingBefore) ? { style: `margin-top:${attrs.spacingBefore}px` } : {},
      },
      spacingAfter: {
        default: null,
        parseHTML: (element) => Number.parseFloat(element?.style?.marginBottom || "") || null,
        renderHTML: (attrs) =>
          Number.isFinite(attrs.spacingAfter)
            ? { style: `margin-bottom:${attrs.spacingAfter}px` }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "p" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["p", HTMLAttributes, 0];
  },
  layout() {
    return {
      renderer: paragraphRenderer,
      pagination: paragraphRenderer?.pagination,
    };
  },
});

export default Paragraph;
