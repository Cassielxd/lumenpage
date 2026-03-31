import { Selection } from "lumenpage-state";
import { canSplit, joinPoint, liftTarget } from "lumenpage-transform";

const isListNodeType = (name) =>
  name === "bulletList" || name === "orderedList" || name === "taskList";

const isListItemType = (name) => name === "listItem" || name === "taskItem";

const getExpectedItemTypeNameForList = (listTypeName) =>
  listTypeName === "taskList" ? "taskItem" : "listItem";

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

const resolveListItemBackspaceContext = (state) => {
  const { selection } = state || {};
  if (!selection?.empty) {
    return null;
  }

  const { $from } = selection;
  if (!$from?.parent?.isTextblock || $from.parentOffset !== 0) {
    return null;
  }

  const itemDepth = findAncestorDepthByTypes($from, ["listItem", "taskItem"]);
  if (itemDepth < 0 || itemDepth - 1 < 0) {
    return null;
  }

  const listDepth = itemDepth - 1;
  const listNode = $from.node(listDepth);
  if (!isListNodeType(listNode?.type?.name)) {
    return null;
  }

  const itemIndex = $from.index(listDepth);
  if (itemIndex <= 0) {
    return null;
  }

  return {
    $from,
    itemDepth,
  };
};

const convertListItemsForListType = (tr, schema, listPos, listNode, targetListTypeName) => {
  const targetItemTypeName = getExpectedItemTypeNameForList(targetListTypeName);
  const targetItemType = schema.nodes[targetItemTypeName];

  if (!targetItemType) {
    return tr;
  }

  listNode.forEach((child, childOffset) => {
    if (!isListItemType(child.type?.name) || child.type === targetItemType) {
      return;
    }

    const childPos = listPos + 1 + childOffset;
    const nextAttrs =
      targetItemTypeName === "taskItem"
        ? { ...(child.attrs || {}), checked: child.attrs?.checked === true }
        : Object.fromEntries(Object.entries(child.attrs || {}).filter(([key]) => key !== "checked"));

    tr = tr.setNodeMarkup(childPos, targetItemType, nextAttrs, child.marks);
  });

  return tr;
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
  const context = resolveListItemBackspaceContext(state);
  if (!context?.$from || context.$from.parent.content.size !== 0) {
    return false;
  }
  const { $from, itemDepth } = context;

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

export const joinListItemBackward = (state, dispatch) => {
  if (!resolveListItemBackspaceContext(state)) {
    return false;
  }

  try {
    const point = joinPoint(state.doc, state.selection.$from.pos, -1);
    if (point == null) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.join(point, 2).scrollIntoView());
    }

    return true;
  } catch (_error) {
    return false;
  }
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

export const createToggleListCommand = (listTypeName) => ({ state, dispatch, commands }) => {
  const type = state.schema.nodes[listTypeName];

  if (!type) {
    return false;
  }

  const { $from, $to } = state.selection;
  let range = null;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);

    if (!isListItemType(node.type.name)) {
      continue;
    }

    const parent = $from.node(depth - 1);

    if (
      parent &&
      parent.type?.name !== listTypeName &&
      isListNodeType(parent.type?.name)
    ) {
      if (!dispatch) {
        return true;
      }

      const listPos = $from.before(depth - 1);
      const nextAttrs =
        listTypeName === "orderedList"
          ? { ...(parent.attrs || {}), order: Number(parent.attrs?.order) || 1 }
          : { id: parent.attrs?.id ?? null };

      let tr = state.tr.setNodeMarkup(listPos, type, nextAttrs, parent.marks);
      tr = convertListItemsForListType(tr, state.schema, listPos, parent, listTypeName);
      dispatch(tr.scrollIntoView());
      return true;
    }

    if (parent?.type?.name !== listTypeName) {
      continue;
    }

    range = $from.blockRange($to, (current) => isListItemType(current.type.name));
    break;
  }

  if (range) {
    const target = liftTarget(range);

    if (target == null) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.lift(range, target).scrollIntoView());
    }

    return true;
  }

  return commands.wrapIn(type);
};
