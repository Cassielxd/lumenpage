import { Step } from "lumenpage-transform";
import { createChangeSummary } from "./changeSummary";

export const CHANGE_SOURCE_META = "lumenpageChangeSource";

export const getChangeSource = (tr, fallback = "local") => {
  const meta = tr?.getMeta?.(CHANGE_SOURCE_META);
  return typeof meta === "string" && meta ? meta : fallback;
};

export const setChangeSource = (tr, source) => {
  if (!tr) {
    return tr;
  }
  tr.setMeta(CHANGE_SOURCE_META, source);
  return tr;
};

export const serializeSteps = (tr) => {
  if (!tr?.steps) {
    return [];
  }
  return tr.steps.map((step) => step.toJSON());
};

export const deserializeSteps = (schema, steps = []) =>
  steps.map((step) => Step.fromJSON(schema, step));

export const createChangeEvent = (tr, oldState, newState, options = {}) => {
  const summary = createChangeSummary(tr, oldState, newState);
  const source = options.source || getChangeSource(tr);
  const selection = newState?.selection
    ? {
        from: newState.selection.from,
        to: newState.selection.to,
        anchor: newState.selection.anchor,
        head: newState.selection.head,
      }
    : null;

  return {
    source,
    docChanged: summary.docChanged === true,
    steps: serializeSteps(tr),
    selection,
    summary,
    timestamp: Date.now(),
  };
};
