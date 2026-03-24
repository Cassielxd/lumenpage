import { Node } from "lumenpage-core";

export { headingNodeSpec } from "./heading";
export { defaultHeadingRenderer as headingRenderer } from "lumenpage-render-engine";

export const Heading = Node.create({
  name: "heading",
  priority: 100,
  content: "inline*",
  group: "block",
  addAttributes() {
    return {
      level: {
        default: 1,
        renderHTML: () => ({}),
      },
      align: {
        default: "left",
        parseHTML: (element) => element?.style?.textAlign || "left",
        renderHTML: (attrs) =>
          attrs.align && attrs.align !== "left" ? { style: `text-align:${attrs.align}` } : {},
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
    return [
      { tag: "h1", attrs: { level: 1 } },
      { tag: "h2", attrs: { level: 2 } },
      { tag: "h3", attrs: { level: 3 } },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = Math.max(1, Math.min(3, Number(node?.attrs?.level) || 1));
    return [`h${level}`, HTMLAttributes, 0];
  },
});

export default Heading;
