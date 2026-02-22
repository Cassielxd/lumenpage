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
import { backspaceEmptyListItem, splitListItem } from "lumenpage-node-list";
import {
  addTableRowAfter,
  addTableRowBefore,
  deleteTableRow,
  addTableColumnAfter,
  addTableColumnBefore,
  deleteTableColumn,
  goToNextTableCell,
  goToPreviousTableCell,
  enterTableCellSelection,
  deleteTableCellSelection,
  preventDeleteBackwardAtTableCellBoundary,
  preventDeleteForwardAtTableCellBoundary,
  mergeTableCellRight,
  splitTableCell,
  selectCurrentAndNextTableCell,
  selectCurrentAndBelowTableCell,
  mergeSelectedTableCells,
} from "lumenpage-node-table";
export {
  addTableRowAfter,
  addTableRowBefore,
  deleteTableRow,
  addTableColumnAfter,
  addTableColumnBefore,
  deleteTableColumn,
  goToNextTableCell,
  goToPreviousTableCell,
  enterTableCellSelection,
  deleteTableCellSelection,
  preventDeleteBackwardAtTableCellBoundary,
  preventDeleteForwardAtTableCellBoundary,
  mergeTableCellRight,
  splitTableCell,
  selectCurrentAndNextTableCell,
  selectCurrentAndBelowTableCell,
  mergeSelectedTableCells,
};

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

const insertTextCommand =
  (text: string): Command =>
  (state, dispatch) => {
    if (!dispatch) {
      return true;
    }
    const tr = state.tr.insertText(text, state.selection.from, state.selection.to);
    dispatch(tr);
    return true;
  };

export const createCanvasEditorKeymap = () => ({
  "Mod-z": undo,
  "Shift-Mod-z": redo,
  "Mod-y": redo,
  "Shift-Mod-l": setBlockAlign("left"),
  "Shift-Mod-c": setBlockAlign("center"),
  "Shift-Mod-e": setBlockAlign("center"),
  "Shift-Mod-r": setBlockAlign("right"),
  Enter: chainCommands(enterTableCellSelection, splitListItem),
  Backspace: chainCommands(
    deleteTableCellSelection,
    preventDeleteBackwardAtTableCellBoundary,
    backspaceEmptyListItem
  ),
  Delete: chainCommands(deleteTableCellSelection, preventDeleteForwardAtTableCellBoundary),
  "Mod-Backspace": chainCommands(
    deleteTableCellSelection,
    preventDeleteBackwardAtTableCellBoundary
  ),
  "Mod-Delete": chainCommands(deleteTableCellSelection, preventDeleteForwardAtTableCellBoundary),
  Tab: chainCommands(goToNextTableCell, insertTextCommand("  ")),
  "Shift-Tab": goToPreviousTableCell,
});

export const createViewCommands = () => {
  const toggleList = (nodeName) => (state, dispatch, view) => {
    const type = state.schema.nodes[nodeName];
    if (!type) {
      return false;
    }
    const { $from, $to } = state.selection;
    let range = null;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== "list_item") {
        continue;
      }
      const parent = $from.node(depth - 1);
      if (
        parent &&
        parent.type?.name !== nodeName &&
        (parent.type?.name === "bullet_list" || parent.type?.name === "ordered_list")
      ) {
        if (!dispatch) {
          return true;
        }
        const listPos = $from.before(depth - 1);
        const nextAttrs =
          nodeName === "ordered_list"
            ? { ...(parent.attrs || {}), order: Number(parent.attrs?.order) || 1 }
            : { id: parent.attrs?.id ?? null };
        const tr = state.tr.setNodeMarkup(listPos, type, nextAttrs, parent.marks);
        dispatch(tr.scrollIntoView());
        return true;
      }
      if (parent?.type?.name !== nodeName) {
        continue;
      }
      range = $from.blockRange($to, (n) => n.type.name === "list_item");
      break;
    }
    if (range) {
      const target = liftTarget(range);
      if (target == null) {
        return false;
      }
      if (dispatch) {
        const tr = state.tr.lift(range, target);
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    return wrapIn(type)(state, dispatch, view);
  };
  const wrapInNode = (nodeName) => (state, dispatch, view) => {
    const type = state.schema.nodes[nodeName];
    if (!type) {
      return false;
    }
    return wrapIn(type)(state, dispatch, view);
  };

  const toggleWrapNode = (nodeName) => (state, dispatch, view) => {
    const type = state.schema.nodes[nodeName];
    if (!type) {
      return false;
    }
    const { $from, $to } = state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node?.type !== type) {
        continue;
      }
      const range = $from.blockRange($to, (n) => n.type === type);
      if (!range) {
        break;
      }
      const target = liftTarget(range);
      if (target == null) {
        break;
      }
      if (dispatch) {
        const tr = state.tr.lift(range, target);
        dispatch(tr.scrollIntoView());
      }
      return true;
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
    toggleBlockquote: toggleWrapNode("blockquote"),
    toggleCodeBlock: toggleCodeBlock(),
    insertHorizontalRule: insertNode("horizontal_rule"),
    toggleBulletList: toggleList("bullet_list"),
    toggleOrderedList: toggleList("ordered_list"),
    indent: changeParagraphIndent(1),
    outdent: changeParagraphIndent(-1),
    insertImage: (attrs) => insertNode("image", attrs),
    insertVideo: (attrs) => insertNode("video", attrs),
    setParagraphSpacingBefore: (value) => setParagraphSpacing("spacingBefore", value),
    setParagraphSpacingAfter: (value) => setParagraphSpacing("spacingAfter", value),
    clearParagraphSpacingBefore: () => setParagraphSpacing("spacingBefore", null),
    clearParagraphSpacingAfter: () => setParagraphSpacing("spacingAfter", null),
    addTableRowAfter,
    addTableRowBefore,
    deleteTableRow,
    addTableColumnAfter,
    addTableColumnBefore,
    deleteTableColumn,
    goToNextTableCell,
    goToPreviousTableCell,
    mergeTableCellRight,
    splitTableCell,
    selectTableCellsRight: selectCurrentAndNextTableCell,
    selectTableCellsDown: selectCurrentAndBelowTableCell,
    mergeSelectedTableCells,
  };
};

export function runCommand(command, state, dispatch) {
  return command(state, dispatch);
}





