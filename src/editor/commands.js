import {
  deleteSelection,
  joinBackward,
  joinForward,
  splitBlock,
} from "prosemirror-commands";
import { undo, redo } from "prosemirror-history";

const updateParagraphs = (state, dispatch, updater) => {
  const { from, to } = state.selection;
  let tr = state.tr;
  let changed = false;

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "paragraph") {
      return;
    }

    const nextAttrs = updater(node.attrs || {});
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

export const setParagraphAlign = (align) => (state, dispatch) =>
  updateParagraphs(state, dispatch, (attrs) => ({
    ...attrs,
    align,
  }));

export const setParagraphIndent = (indent) => (state, dispatch) =>
  updateParagraphs(state, dispatch, (attrs) => ({
    ...attrs,
    indent: Math.max(0, indent),
  }));

export const changeParagraphIndent = (delta) => (state, dispatch) =>
  updateParagraphs(state, dispatch, (attrs) => ({
    ...attrs,
    indent: Math.max(0, (attrs.indent || 0) + delta),
  }));

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
