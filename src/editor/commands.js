import {
  deleteSelection,
  joinBackward,
  joinForward,
  splitBlock,
  setBlockType,
} from "prosemirror-commands";
import { undo, redo } from "prosemirror-history";

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

export const setHeadingLevel = (level) => (state, dispatch) => {
  const type = state.schema.nodes.heading;
  if (!type) {
    return false;
  }
  const attrs = { ...getCurrentBlockAttrs(state), level };
  return setBlockType(type, attrs)(state, dispatch);
};

export const setParagraph = () => (state, dispatch) => {
  const type = state.schema.nodes.paragraph;
  if (!type) {
    return false;
  }
  const attrs = { ...getCurrentBlockAttrs(state) };
  return setBlockType(type, attrs)(state, dispatch);
};

export const basicCommands = {
  deleteSelection,
  joinBackward,
  joinForward,
  splitBlock,
  undo,
  redo,
};

export function runCommand(command, state, dispatch) {
  return command(state, dispatch);
}
