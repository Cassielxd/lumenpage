import { getEditorInternalsSections } from "../internals.js";

export const readSomeProp = (view: any, propName: string, f?: (value: any) => any) => {
  const { viewSync } = getEditorInternalsSections(view);
  const propsList = viewSync?.getEditorPropsList?.(view.state) ?? [];
  for (const props of propsList) {
    const value = props?.[propName];
    if (value == null) {
      continue;
    }
    if (typeof f === "function") {
      const result = f(value);
      if (result) {
        return result;
      }
    } else {
      return value;
    }
  }
  return undefined;
};

export const dispatchViewTransaction = (view: any, tr: any) => {
  if (!tr) {
    return;
  }
  const { interactionRuntime } = getEditorInternalsSections(view);
  const dispatchTransaction =
    (typeof view?.dispatchTransaction === "function" ? view.dispatchTransaction : null) ||
    interactionRuntime?.dispatchTransaction;
  if (dispatchTransaction) {
    dispatchTransaction(tr);
  }
};

export const isEndOfTextblock = (view: any, dir = "forward", state = undefined) => {
  const targetState = state || view?.state;
  const selection = targetState?.selection;
  const cursor = selection?.$cursor || selection?.$from;
  if (!cursor) {
    return false;
  }
  const isBackward = dir === "backward" || dir === "left" || dir === "up";
  const isForward = dir === "forward" || dir === "right" || dir === "down";
  if (isBackward) {
    return cursor.parentOffset === 0;
  }
  if (isForward) {
    return cursor.parentOffset === cursor.parent.content.size;
  }
  return false;
};
