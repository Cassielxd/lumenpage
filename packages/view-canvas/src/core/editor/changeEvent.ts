import { Step } from "lumenpage-transform";
import { createChangeSummary } from "./changeSummary";

export const CHANGE_SOURCE_META = "lumenpageChangeSource";

type ChangeEventOptions = {
  source?: string;
  transactions?: readonly any[];
  appendedTransactions?: readonly any[];
};

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

export const createChangeEvent = (tr, oldState, newState, options: ChangeEventOptions = {}) => {
  const summary = createChangeSummary(tr, oldState, newState);
  const source = options.source || getChangeSource(tr);
  const transactions = Array.isArray(options.transactions) ? options.transactions : [tr];
  const appendedTransactions = Array.isArray(options.appendedTransactions)
    ? options.appendedTransactions
    : transactions.slice(1);
  const selection = newState?.selection
    ? {
        from: newState.selection.from,
        to: newState.selection.to,
        anchor: newState.selection.anchor,
        head: newState.selection.head,
      }
    : null;
  const selectionChanged =
    !!oldState?.selection &&
    !!newState?.selection &&
    typeof oldState.selection.eq === "function" &&
    oldState.selection.eq(newState.selection) === false;
  const docChanged =
    summary.docChanged === true || transactions.some((transaction) => transaction?.docChanged === true);

  return {
    transaction: tr,
    state: newState,
    oldState,
    transactions,
    appendedTransactions,
    source,
    docChanged,
    selectionChanged,
    steps: serializeSteps(tr),
    selection,
    summary,
    timestamp: Date.now(),
  };
};
