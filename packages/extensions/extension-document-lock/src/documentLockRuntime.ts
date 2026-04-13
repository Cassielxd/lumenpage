import { Extension } from "lumenpage-core";

import {
  DocumentLockMark,
  findDocumentLockRanges,
  findDocumentLockRangesAtPos,
  isDocumentLockNode,
  isDocumentLockableNode,
} from "./documentLockMark.js";
import {
  DocumentLockPluginKey,
  createDocumentLockPlugin,
  getDocumentLockPluginState,
} from "./documentLockPlugin.js";
import {
  DOCUMENT_LOCK_META,
  DOCUMENT_LOCK_NODE_ATTR,
  DOCUMENT_LOCK_NODE_TYPES,
  createDefaultDocumentLockOptions,
  markDocumentLockTransaction,
  type DocumentLockOptions,
} from "./types.js";

type DocumentLockRuntimeCommandMethods<ReturnType> = {
  lockSelection: () => ReturnType;
  unlockSelection: () => ReturnType;
  clearAllDocumentLocks: () => ReturnType;
  setDocumentLocking: (enabled: boolean) => ReturnType;
  toggleDocumentLocking: () => ReturnType;
  setDocumentLockMarkersVisible: (visible: boolean) => ReturnType;
  toggleDocumentLockMarkersVisible: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    documentLockRuntime: DocumentLockRuntimeCommandMethods<ReturnType>;
  }
}

const getDocumentLockMarkType = (state: any) => state?.schema?.marks?.documentLock || null;

const collectDocumentLockNodeEntries = (state: any, from: number, to: number) => {
  if (!state?.doc?.nodesBetween || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return [];
  }

  const entries: Array<{ from: number; to: number; pos: number; node: any }> = [];
  const seen = new Set<number>();
  state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (!isDocumentLockableNode(node)) {
      return;
    }

    const nodeFrom = Number(pos);
    const nodeTo = Number(pos + node.nodeSize);
    if (!Number.isFinite(nodeFrom) || !Number.isFinite(nodeTo) || nodeTo <= nodeFrom) {
      return;
    }
    if (nodeTo <= from || nodeFrom >= to || seen.has(nodeFrom)) {
      return;
    }

    seen.add(nodeFrom);
    entries.push({
      from: nodeFrom,
      to: nodeTo,
      pos: nodeFrom,
      node,
    });
    return false;
  });

  return entries;
};

const setDocumentLockNodeFlag = (tr: any, entries: Array<{ pos: number; node: any }>, locked: boolean) => {
  let nextTr = tr;
  for (const entry of [...entries].sort((left, right) => right.pos - left.pos)) {
    if (!entry?.node || !Number.isFinite(entry?.pos)) {
      continue;
    }
    if ((entry.node.attrs?.[DOCUMENT_LOCK_NODE_ATTR] === true) === locked) {
      continue;
    }
    nextTr = nextTr.setNodeMarkup(
      entry.pos,
      undefined,
      {
        ...entry.node.attrs,
        [DOCUMENT_LOCK_NODE_ATTR]: locked,
      },
      entry.node.marks
    );
  }
  return nextTr;
};

const createLockSelectionCommand =
  () =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = getDocumentLockMarkType(state);
    const from = Number(state?.selection?.from);
    const to = Number(state?.selection?.to);
    const lockableNodes = collectDocumentLockNodeEntries(state, from, to).filter(
      (entry) => entry?.node?.attrs?.[DOCUMENT_LOCK_NODE_ATTR] !== true
    );
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return false;
    }
    if (!type && lockableNodes.length === 0) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    let tr = state.tr;
    if (type) {
      tr = tr.addMark(from, to, type.create());
    }
    tr = setDocumentLockNodeFlag(tr, lockableNodes, true);
    const nextTr = markDocumentLockTransaction(tr, { refresh: true });
    if (nextTr.steps.length === 0) {
      return false;
    }
    dispatch(nextTr.scrollIntoView());
    return true;
  };

const createUnlockSelectionCommand =
  () =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = getDocumentLockMarkType(state);
    if (!type || !state?.tr) {
      return false;
    }

    const selection = state.selection;
    const ranges =
      selection?.empty === true
        ? findDocumentLockRangesAtPos(state, Number(selection.from))
        : findDocumentLockRanges(state).filter(
            (range) => range.from < Number(selection.to) && range.to > Number(selection.from)
          );

    if (ranges.length === 0) {
      return false;
    }
    if (!dispatch) {
      return true;
    }

    let tr = state.tr;
    for (const range of [...ranges].sort((left, right) => right.from - left.from)) {
      if (range.kind === "mark") {
        tr = tr.removeMark(range.from, range.to, type.create());
        continue;
      }
      const node = tr.doc.nodeAt(range.from);
      if (!node || !isDocumentLockNode(node)) {
        continue;
      }
      tr = setDocumentLockNodeFlag(tr, [{ pos: range.from, node }], false);
    }
    dispatch(markDocumentLockTransaction(tr, { refresh: true }).scrollIntoView());
    return true;
  };

const createClearAllDocumentLocksCommand =
  () =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = getDocumentLockMarkType(state);
    if (!type || !state?.tr) {
      return false;
    }

    const ranges = findDocumentLockRanges(state);
    if (ranges.length === 0) {
      return false;
    }
    if (!dispatch) {
      return true;
    }

    let tr = state.tr;
    for (const range of [...ranges].sort((left, right) => right.from - left.from)) {
      if (range.kind === "mark") {
        tr = tr.removeMark(range.from, range.to, type.create());
        continue;
      }
      const node = tr.doc.nodeAt(range.from);
      if (!node || !isDocumentLockNode(node)) {
        continue;
      }
      tr = setDocumentLockNodeFlag(tr, [{ pos: range.from, node }], false);
    }
    dispatch(markDocumentLockTransaction(tr, { refresh: true }).scrollIntoView());
    return true;
  };

const createSetDocumentLockingCommand =
  (enabled: boolean) =>
  (state: any, dispatch?: (tr: any) => void) => {
    if (!state?.tr) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    const tr = state.tr
      .setMeta(DOCUMENT_LOCK_META, { enabled, skipEnforcement: true })
      .setMeta("addToHistory", false);
    dispatch(tr);
    return true;
  };

const createToggleDocumentLockingCommand =
  () =>
  (state: any, dispatch?: (tr: any) => void) =>
    createSetDocumentLockingCommand(getDocumentLockPluginState(state).enabled !== true)(state, dispatch);

const createSetDocumentLockMarkersVisibleCommand =
  (visible: boolean) =>
  (state: any, dispatch?: (tr: any) => void) => {
    if (!state?.tr) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    const tr = state.tr
      .setMeta(DOCUMENT_LOCK_META, { showMarkers: visible, skipEnforcement: true })
      .setMeta("addToHistory", false);
    dispatch(tr);
    return true;
  };

const createToggleDocumentLockMarkersVisibleCommand =
  () =>
  (state: any, dispatch?: (tr: any) => void) =>
    createSetDocumentLockMarkersVisibleCommand(
      getDocumentLockPluginState(state).showMarkers !== true
    )(state, dispatch);

export const DocumentLockRuntime = Extension.create<DocumentLockOptions>({
  name: "documentLockRuntime",
  priority: 1000,
  addOptions() {
    return createDefaultDocumentLockOptions();
  },
  addCommands() {
    return {
      lockSelection: () => createLockSelectionCommand(),
      unlockSelection: () => createUnlockSelectionCommand(),
      clearAllDocumentLocks: () => createClearAllDocumentLocksCommand(),
      setDocumentLocking: (enabled: boolean) => createSetDocumentLockingCommand(enabled),
      toggleDocumentLocking: () => createToggleDocumentLockingCommand(),
      setDocumentLockMarkersVisible: (visible: boolean) =>
        createSetDocumentLockMarkersVisibleCommand(visible),
      toggleDocumentLockMarkersVisible: () => createToggleDocumentLockMarkersVisibleCommand(),
    };
  },
  addPlugins() {
    return [createDocumentLockPlugin(this.options)];
  },
});

export const DocumentLock = Extension.create<DocumentLockOptions>({
  name: "documentLocks",
  priority: 1000,
  addOptions() {
    return createDefaultDocumentLockOptions();
  },
  addGlobalAttributes() {
    return [
      {
        types: [...DOCUMENT_LOCK_NODE_TYPES],
        attributes: {
          [DOCUMENT_LOCK_NODE_ATTR]: {
            default: false,
            parseHTML: (element) => element?.getAttribute?.("data-document-lock") === "true",
            renderHTML: (attributes) =>
              attributes?.[DOCUMENT_LOCK_NODE_ATTR] === true
                ? { "data-document-lock": "true" }
                : null,
          },
        },
      },
    ];
  },
  addExtensions() {
    return [
      DocumentLockMark.configure(this.options),
      DocumentLockRuntime.configure(this.options),
    ];
  },
});

export default DocumentLock;
