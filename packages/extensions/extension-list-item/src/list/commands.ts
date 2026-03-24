import { canSplit } from "lumenpage-transform";
import { Selection } from "lumenpage-state";

const isListNodeType = (name) =>
  name === "bulletList" || name === "orderedList" || name === "taskList";

const isListItemType = (name) => name === "listItem" || name === "taskItem";

const findAncestorDepthByType = ($pos, typeName) => {
  if (!$pos || !typeName) {
    return -1;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    if ($pos.node(depth)?.type?.name === typeName) {
      return depth;
    }
  }
  return -1;
};

const findAncestorDepthByTypes = ($pos, typeNames) => {
  if (!$pos || !Array.isArray(typeNames) || typeNames.length === 0) {
    return -1;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    if (isListItemType($pos.node(depth)?.type?.name) && typeNames.includes($pos.node(depth)?.type?.name)) {
      return depth;
    }
  }
  return -1;
};

export const splitListItem = (state, dispatch) => {
  const { selection } = state;
  const { $from, $to } = selection;
  if (!$from?.sameParent?.($to)) {
    return false;
  }
  if (!$from.parent?.isTextblock) {
    return false;
  }

  const itemDepth = findAncestorDepthByTypes($from, ["listItem", "taskItem"]);
  if (itemDepth < 0 || itemDepth - 1 < 0) {
    return false;
  }
  const listNode = $from.node(itemDepth - 1);
  if (!isListNodeType(listNode?.type?.name)) {
    return false;
  }

  const splitPos = $from.pos;
  if (!canSplit(state.doc, splitPos, 2)) {
    return false;
  }
  if (!dispatch) {
    return true;
  }

  let tr = state.tr;
  if (!selection.empty) {
    tr = tr.deleteSelection();
  }
  const mappedPos = tr.mapping.map(splitPos);
  tr = tr.split(mappedPos, 2).scrollIntoView();
  dispatch(tr);
  return true;
};

export const backspaceEmptyListItem = (state, dispatch) => {
  const { selection } = state;
  if (!selection?.empty) {
    return false;
  }
  const { $from } = selection;
  if (!$from?.parent?.isTextblock) {
    return false;
  }
  if ($from.parentOffset !== 0 || $from.parent.content.size !== 0) {
    return false;
  }

  const itemDepth = findAncestorDepthByTypes($from, ["listItem", "taskItem"]);
  if (itemDepth < 0 || itemDepth - 1 < 0) {
    return false;
  }
  const listDepth = itemDepth - 1;
  const listNode = $from.node(listDepth);
  if (!isListNodeType(listNode?.type?.name)) {
    return false;
  }

  const itemIndex = $from.index(listDepth);
  if (itemIndex <= 0) {
    return false;
  }

  const itemStart = $from.before(itemDepth);
  const itemEnd = $from.after(itemDepth);
  if (!dispatch) {
    return true;
  }

  let tr = state.tr.delete(itemStart, itemEnd);
  const prevPos = Math.max(0, tr.mapping.map(itemStart) - 1);
  tr = tr.setSelection(Selection.near(tr.doc.resolve(prevPos), -1)).scrollIntoView();
  dispatch(tr);
  return true;
};

const resolveTaskListItemContext = (state, pos) => {
  if (!state?.doc) {
    return null;
  }
  let $pos = null;
  if (Number.isFinite(pos)) {
    const clamped = Math.max(0, Math.min(state.doc.content.size, Number(pos)));
    try {
      $pos = state.doc.resolve(clamped);
    } catch (_error) {
      return null;
    }
  } else {
    $pos = state.selection?.$from || null;
  }
  if (!$pos) {
    return null;
  }
  const itemDepth = findAncestorDepthByType($pos, "taskItem");
  if (itemDepth < 0) {
    return null;
  }
  const listDepth = itemDepth - 1;
  if (listDepth < 0) {
    return null;
  }
  const listNode = $pos.node(listDepth);
  if (listNode?.type?.name !== "taskList") {
    return null;
  }
  const itemNode = $pos.node(itemDepth);
  const itemPos = $pos.before(itemDepth);
  const itemStart = $pos.start(itemDepth);
  return { $pos, itemNode, itemPos, itemStart };
};

export const toggleTaskItemChecked =
  (pos, options = { onlyWhenNearStart: false }) =>
  (state, dispatch) => {
    const context = resolveTaskListItemContext(state, pos);
    if (!context) {
      return false;
    }

    if (options?.onlyWhenNearStart && Number.isFinite(pos)) {
      const offset = Math.max(0, Number(pos) - context.itemStart);
      if (offset > 1) {
        return false;
      }
    }

    if (!dispatch) {
      return true;
    }
    const checked = context.itemNode?.attrs?.checked === true;
    const nextAttrs = {
      ...(context.itemNode?.attrs || {}),
      checked: !checked,
    };
    const tr = state.tr.setNodeMarkup(context.itemPos, undefined, nextAttrs, context.itemNode.marks);
    dispatch(tr.scrollIntoView());
    return true;
  };
