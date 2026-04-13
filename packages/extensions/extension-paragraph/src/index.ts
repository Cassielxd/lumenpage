import { Node } from "lumenpage-core";

export { paragraphNodeSpec } from "./paragraph.js";
export { defaultParagraphRenderer as paragraphRenderer } from "lumenpage-render-engine";

type ParagraphCommands<ReturnType> = {
  setParagraph: () => ReturnType;
  alignLeft: () => ReturnType;
  alignCenter: () => ReturnType;
  alignRight: () => ReturnType;
  alignJustify: () => ReturnType;
  alignDistributed: () => ReturnType;
  indent: () => ReturnType;
  outdent: () => ReturnType;
  setParagraphSpacingBefore: (value: number | null) => ReturnType;
  setParagraphSpacingAfter: (value: number | null) => ReturnType;
  clearParagraphSpacingBefore: () => ReturnType;
  clearParagraphSpacingAfter: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    paragraph: ParagraphCommands<ReturnType>;
  }
}

const updateBlocks = (state, dispatch, updater) => {
  const { from, to } = state.selection;
  let tr = state.tr;
  let changed = false;

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "paragraph" && node.type.name !== "heading") {
      return;
    }

    const nextAttrs = updater(node, node.attrs || {});

    if (!nextAttrs) {
      return;
    }

    const same = Object.keys(nextAttrs).every((key) => node.attrs?.[key] === nextAttrs[key]);

    if (same) {
      return;
    }

    tr = tr.setNodeMarkup(pos, undefined, nextAttrs, node.marks);
    changed = true;
  });

  if (changed && dispatch) {
    dispatch(tr);
  }

  return changed;
};

const setBlockAlign = (align) => (state, dispatch) =>
  updateBlocks(state, dispatch, (_node, attrs) => ({
    ...attrs,
    align,
  }));

const changeParagraphIndent = (delta) => (state, dispatch) =>
  updateBlocks(state, dispatch, (node, attrs) => {
    if (node.type.name !== "paragraph") {
      return null;
    }

    return {
      ...attrs,
      indent: Math.max(0, (attrs.indent || 0) + delta),
    };
  });

const setParagraphSpacing = (key: "spacingBefore" | "spacingAfter", value: number | null) =>
  (state, dispatch) =>
    updateBlocks(state, dispatch, (node, attrs) => {
      if (node.type.name !== "paragraph" && node.type.name !== "heading") {
        return null;
      }

      if (value == null) {
        return {
          ...attrs,
          [key]: null,
        };
      }

      return {
        ...attrs,
        [key]: Math.max(0, value),
      };
    });

export const Paragraph = Node.create({
  name: "paragraph",
  // Keep paragraph ahead of recursive block nodes (for example tables) so
  // createAndFill/deleteSelection can always synthesize a safe default block.
  priority: 1100,
  content: "inline*",
  group: "block",
  addCommands() {
    return {
      setParagraph: () => ({ commands }) => commands.setNode(this.name),
      alignLeft: () => setBlockAlign("left"),
      alignCenter: () => setBlockAlign("center"),
      alignRight: () => setBlockAlign("right"),
      alignJustify: () => setBlockAlign("justify"),
      alignDistributed: () => setBlockAlign("justify"),
      indent: () => changeParagraphIndent(1),
      outdent: () => changeParagraphIndent(-1),
      setParagraphSpacingBefore: (value) => setParagraphSpacing("spacingBefore", value),
      setParagraphSpacingAfter: (value) => setParagraphSpacing("spacingAfter", value),
      clearParagraphSpacingBefore: () => setParagraphSpacing("spacingBefore", null),
      clearParagraphSpacingAfter: () => setParagraphSpacing("spacingAfter", null),
    };
  },
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
});

export default Paragraph;