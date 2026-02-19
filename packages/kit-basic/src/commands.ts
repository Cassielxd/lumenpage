import {
  chainCommands,
  createParagraphNear,
  deleteSelection,
  joinBackward,
  joinForward,
  liftEmptyBlock,
  newlineInCode,
  splitBlock,
  setBlockType,
  toggleMark,
  wrapIn,
} from "lumenpage-commands";

import type { Command } from "lumenpage-state";

import { undo, redo } from "lumenpage-history";
import { liftTarget } from "lumenpage-transform";

const getCurrentBlockAttrs = (state) => {
  const parent = state.selection.$from.parent;

  return parent?.attrs ? { ...parent.attrs } : {};
};

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

    const keys = Object.keys(nextAttrs);

    const same = keys.every((key) => node.attrs?.[key] === nextAttrs[key]);

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

export const setBlockAlign = (align) => (state, dispatch) =>
  updateBlocks(state, dispatch, (_node, attrs) => ({
    ...attrs,

    align,
  }));

export const setParagraphIndent = (indent) => (state, dispatch) =>
  updateBlocks(state, dispatch, (node, attrs) => {
    if (node.type.name !== "paragraph") {
      return null;
    }

    return { ...attrs, indent: Math.max(0, indent) };
  });

export const changeParagraphIndent = (delta) => (state, dispatch) =>
  updateBlocks(state, dispatch, (node, attrs) => {
    if (node.type.name !== "paragraph") {
      return null;
    }

    return { ...attrs, indent: Math.max(0, (attrs.indent || 0) + delta) };
  });

export const setParagraphSpacing = (
  key: "spacingBefore" | "spacingAfter",
  value: number | null
) =>
  (state, dispatch) =>
    updateBlocks(state, dispatch, (node, attrs) => {
      if (node.type.name !== "paragraph" && node.type.name !== "heading") {
        return null;
      }
      if (value == null) {
        return { ...attrs, [key]: null };
      }
      const next = Math.max(0, value);
      return { ...attrs, [key]: next };
    });

const resolveBlockAttrs = (state, nodeName, attrs) => {
  const base = getCurrentBlockAttrs(state);

  if (nodeName === "heading" && typeof attrs === "number") {
    return { ...base, level: attrs };
  }

  if (attrs && typeof attrs === "object") {
    return { ...base, ...attrs };
  }

  return base;
};

export const setBlockTypeByName = (nodeName, attrs = null) => (state, dispatch) => {
  const type = state.schema.nodes[nodeName];

  if (!type) {
    return false;
  }

  const resolvedAttrs = resolveBlockAttrs(state, nodeName, attrs);

  return setBlockType(type, resolvedAttrs)(state, dispatch);
};

export const setHeadingLevel = (level) => (state, dispatch) => {
  const type = state.schema.nodes.heading;

  if (!type) {
    return false;
  }

  const attrs = { ...getCurrentBlockAttrs(state), level };

  return setBlockType(type, attrs)(state, dispatch);
};

export const setParagraph = () => (state, dispatch) => {
  return setBlockTypeByName("paragraph")(state, dispatch);
};

export const basicCommands: Record<string, Command> = {
  deleteSelection,

  joinBackward,

  joinForward,

  splitBlock,

  enter: chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock),

  undo,

  redo,
};

export const createViewCommands = () => {
  const wrapInNode = (nodeName) => (state, dispatch, view) => {
    const type = state.schema.nodes[nodeName];
    if (!type) {
      return false;
    }
    return wrapIn(type)(state, dispatch, view);
  };

  const toggleMarkByName = (markName, attrs = null) => (state, dispatch, view) => {
    const type = state.schema.marks[markName];
    if (!type) {
      return false;
    }
    return toggleMark(type, attrs)(state, dispatch, view);
  };

  const insertNode = (nodeName, attrs = null) => (state, dispatch) => {
    const type = state.schema.nodes[nodeName];
    if (!type) {
      return false;
    }
    const node = type.create(attrs || undefined);
    const tr = state.tr.replaceSelectionWith(node);
    if (dispatch) {
      dispatch(tr.scrollIntoView());
    }
    return true;
  };

  const toggleCodeBlock = () => (state, dispatch, view) => {
    const type = state.schema.nodes.code_block;
    if (!type) {
      return false;
    }
    const { $from, $to } = state.selection;
    if ($from?.parent?.type === type) {
      return setParagraph()(state, dispatch);
    }
    const command = setBlockType(type);
    if (command(state, dispatch, view)) {
      return true;
    }
    const range = $from?.blockRange?.($to);
    if (!range) {
      return false;
    }
    const target = liftTarget(range);
    if (target == null) {
      return false;
    }
    if (dispatch) {
      const tr = state.tr.lift(range, target);
      dispatch(tr.scrollIntoView());
    }
    return setBlockType(type)(state, dispatch, view);
  };

  return {
    undo: basicCommands.undo,
    redo: basicCommands.redo,
    setBlockType: (nodeName, attrs) => setBlockTypeByName(nodeName, attrs),
    setParagraph: setParagraph(),
    setHeading: (level) => setHeadingLevel(level),
    alignLeft: setBlockAlign("left"),
    alignCenter: setBlockAlign("center"),
    alignRight: setBlockAlign("right"),
    toggleBold: toggleMarkByName("strong"),
    toggleItalic: toggleMarkByName("em"),
    toggleUnderline: toggleMarkByName("underline"),
    toggleStrike: toggleMarkByName("strike"),
    toggleInlineCode: toggleMarkByName("code"),
    toggleLink: (attrs) => toggleMarkByName("link", attrs),
    toggleBlockquote: wrapInNode("blockquote"),
    toggleCodeBlock: toggleCodeBlock(),
    insertHorizontalRule: insertNode("horizontal_rule"),
    toggleBulletList: wrapInNode("bullet_list"),
    toggleOrderedList: wrapInNode("ordered_list"),
    indent: changeParagraphIndent(1),
    outdent: changeParagraphIndent(-1),
    insertImage: (attrs) => insertNode("image", attrs),
    insertVideo: (attrs) => insertNode("video", attrs),
    setParagraphSpacingBefore: (value) => setParagraphSpacing("spacingBefore", value),
    setParagraphSpacingAfter: (value) => setParagraphSpacing("spacingAfter", value),
    clearParagraphSpacingBefore: () => setParagraphSpacing("spacingBefore", null),
    clearParagraphSpacingAfter: () => setParagraphSpacing("spacingAfter", null),
  };
};

export function runCommand(command, state, dispatch) {
  return command(state, dispatch);
}





