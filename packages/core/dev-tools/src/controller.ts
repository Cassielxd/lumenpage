import { prettyPrint } from "html";
import { DOMSerializer } from "lumenpage-model";
import { Selection, type EditorState, type Transaction } from "lumenpage-state";
import type { EditorView } from "lumenpage-view-types";
import { nanoid } from "nanoid";
import { ref, shallowRef } from "vue";
import { JsonDiffMain } from "./state/json-diff-main.js";
import { JsonDiffWorker } from "./state/json-diff-worker.js";
import type {
  DevToolsController,
  DevToolsHistoryDiff,
  DevToolsHistoryItem,
  DevToolsOptions,
  DevToolsPluginItem,
  DevToolsSnapshot,
  SelectionSummary,
  SelectionWithJSON,
} from "./types.js";
import subscribeOnUpdates from "./utils/subscribe-on-updates.js";

const SNAPSHOTS_KEY = "lumenpage-dev-tools-snapshots";
const HISTORY_LIMIT = 200;

export function createDevToolsController(
  editorView: EditorView,
  options: DevToolsOptions = {},
): DevToolsController {
  const editorState = shallowRef(editorView.state as EditorState);
  const isOpen = ref(options.defaultOpen ?? false);
  const activeTab = ref(options.defaultTab ?? "state");
  const selectedHistoryIndex = ref(0);
  const selectedPluginKey = ref("");
  const pluginSearch = ref("");
  const pluginSortAsc = ref(true);
  const selectionExpanded = ref(false);
  const selectedStructureNode = ref<any | null>(null);
  const history = shallowRef<DevToolsHistoryItem[]>([]);
  const historyDiffs = shallowRef<Record<string, DevToolsHistoryDiff>>({});
  const snapshots = shallowRef<DevToolsSnapshot[]>(loadSnapshots());

  const diffEngine = Promise.resolve(
    options.diffWorker
      ? new JsonDiffWorker(options.diffWorker)
      : new JsonDiffMain(),
  );

  let unsubscribe: (() => void) | null = null;
  let rafId = 0;
  let lastState = editorView.state as EditorState;
  let destroyed = false;

  const setEditorState = (nextState: EditorState) => {
    editorState.value = nextState;
    if (!selectedPluginKey.value && nextState.plugins?.length) {
      selectedPluginKey.value = getPluginKey(nextState.plugins[0]);
    }
  };

  const resetHistory = (state: EditorState) => {
    history.value = [createHistoryEntry(state)];
    historyDiffs.value = {};
    selectedHistoryIndex.value = 0;
  };

  const handleTransaction = async (
    tr: Transaction,
    oldState: EditorState,
    newState: EditorState,
  ) => {
    if (destroyed) {
      return;
    }

    setEditorState(newState);

    if ((tr as any)?.getMeta?.("_skip-dev-tools-history_")) {
      return;
    }

    const entry = createHistoryEntry(newState);
    history.value = [entry, ...history.value].slice(0, HISTORY_LIMIT);
    selectedHistoryIndex.value = 0;
    historyDiffs.value = {
      ...historyDiffs.value,
      [entry.id]: { diff: null, selection: null, pending: true },
    };

    const engine = await diffEngine;
    const [docDiff, selectionDiff] = await Promise.all([
      engine.diff({
        id: entry.id,
        a: oldState.doc.toJSON(),
        b: newState.doc.toJSON(),
      }),
      engine.diff({
        id: `${entry.id}-selection`,
        a: summarizeSelection(oldState.selection),
        b: summarizeSelection(newState.selection),
      }),
    ]);

    if (destroyed) {
      return;
    }

    historyDiffs.value = {
      ...historyDiffs.value,
      [entry.id]: {
        diff: docDiff.delta ?? null,
        selection: selectionDiff.delta ?? null,
        pending: false,
      },
    };
  };

  const rollbackHistory = (item: DevToolsHistoryItem, index: number) => {
    const state = item.state;
    const EditorStateCtor = state.constructor as typeof EditorState;
    const nextState = EditorStateCtor.create({
      schema: state.schema,
      plugins: state.plugins,
      doc: state.schema.nodeFromJSON(state.doc.toJSON()),
    });
    (editorView as any).updateState?.(nextState);
    (editorView as any).focus?.();
    (editorView as any).dom?.focus?.();
    const selection = Selection.fromJSON(
      (editorView.state as EditorState).doc,
      state.selection.toJSON(),
    );
    const tr = (editorView.state as EditorState).tr
      .setSelection(selection)
      .setMeta("addToHistory", false)
      .setMeta("_skip-dev-tools-history_", true);
    dispatchTransaction(editorView, tr);
    setEditorState(editorView.state as EditorState);
    selectedHistoryIndex.value = index;
  };

  const saveSnapshot = () => {
    const state = editorState.value;
    if (!state) {
      return;
    }
    const snapshotName =
      typeof window !== "undefined"
        ? window.prompt("Enter snapshot name", `${Date.now()}`)
        : `${Date.now()}`;
    if (!snapshotName) {
      return;
    }
    const snapshot: DevToolsSnapshot = {
      id: nanoid(),
      name: snapshotName,
      timestamp: Date.now(),
      doc: state.doc.toJSON(),
    };
    snapshots.value = [snapshot, ...snapshots.value];
    persistSnapshots(snapshots.value);
  };

  const loadSnapshot = (snapshot: DevToolsSnapshot) => {
    const state = editorState.value;
    if (!state) {
      return;
    }
    const EditorStateCtor = state.constructor as typeof EditorState;
    const nextState = EditorStateCtor.create({
      schema: state.schema,
      plugins: state.plugins,
      doc: state.schema.nodeFromJSON(snapshot.doc),
    });
    (editorView as any).updateState?.(nextState);
    setEditorState(nextState);
    resetHistory(nextState);
  };

  const deleteSnapshot = (snapshotId: string) => {
    snapshots.value = snapshots.value.filter((item) => item.id !== snapshotId);
    persistSnapshots(snapshots.value);
  };

  const open = () => {
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
  };

  const toggleOpen = () => {
    isOpen.value = !isOpen.value;
  };

  setEditorState(editorView.state as EditorState);
  resetHistory(editorView.state as EditorState);

  unsubscribe = subscribeOnUpdates(editorView, handleTransaction);

  const syncStateLoop = () => {
    if (destroyed) {
      return;
    }
    const nextState = editorView.state as EditorState;
    if (nextState !== lastState) {
      lastState = nextState;
      setEditorState(nextState);
    }
    rafId = window.requestAnimationFrame(syncStateLoop);
  };
  rafId = window.requestAnimationFrame(syncStateLoop);

  return {
    editorView,
    editorState,
    isOpen,
    activeTab,
    selectedHistoryIndex,
    selectedPluginKey,
    pluginSearch,
    pluginSortAsc,
    selectionExpanded,
    selectedStructureNode,
    history,
    historyDiffs,
    snapshots,
    open,
    close,
    toggleOpen,
    resetHistory,
    handleTransaction,
    rollbackHistory,
    saveSnapshot,
    loadSnapshot,
    deleteSnapshot,
    destroy: () => {
      destroyed = true;
      unsubscribe?.();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    },
  };
}

export function getStateSummary(state: EditorState) {
  return {
    docSize: state.doc.content.size,
    childCount: state.doc.childCount,
    selection: summarizeSelection(state.selection),
    activeMarks: getActiveMarks(state),
  };
}

export function summarizeSelection(selection: SelectionWithJSON): SelectionSummary {
  return {
    type: selection.jsonID,
    empty: selection.empty,
    anchor: selection.anchor,
    head: selection.head,
    from: selection.from,
    to: selection.to,
    $from: selection.$from
      ? {
          depth: selection.$from.depth,
          pos: selection.$from.pos,
          textOffset: selection.$from.textOffset,
          parent: selection.$from.parent?.toJSON?.(),
        }
      : undefined,
    $to: selection.$to
      ? {
          depth: selection.$to.depth,
          pos: selection.$to.pos,
          textOffset: selection.$to.textOffset,
          parent: selection.$to.parent?.toJSON?.(),
        }
      : undefined,
  };
}

export function getActiveMarks(state: EditorState) {
  const selection = state.selection;
  let marks: readonly any[] = [];

  if (selection.empty) {
    marks = selection.$from.marks();
  } else {
    state.doc.nodesBetween(selection.from, selection.to, (node) => {
      marks = marks.concat(node.marks);
    });
  }

  return marks
    .reduce<any[]>((acc, mark) => {
      if (!acc.includes(mark)) {
        acc.push(mark);
      }
      return acc;
    }, [])
    .map((mark) => mark.toJSON?.() ?? mark);
}

export function getPlugins(state: EditorState, search = ""): DevToolsPluginItem[] {
  const query = search.trim().toLowerCase();
  return (state.plugins ?? [])
    .map((plugin) => {
      const key = getPluginKey(plugin);
      const pluginState =
        typeof plugin.getState === "function" ? plugin.getState(state) : undefined;
      return {
        key,
        plugin,
        hasState: pluginState !== undefined && pluginState !== null,
        state: pluginState,
      };
    })
    .filter((item) => (!query ? true : item.key.toLowerCase().includes(query)));
}

export function getSchemaSummary(state: EditorState) {
  return {
    nodes: Object.fromEntries(
      Object.entries((state.schema as any).nodes ?? {}).map(
        ([key, value]: [string, any]) => [key, simplifySchemaSpec(value?.spec)],
      ),
    ),
    marks: Object.fromEntries(
      Object.entries((state.schema as any).marks ?? {}).map(
        ([key, value]: [string, any]) => [key, simplifySchemaSpec(value?.spec)],
      ),
    ),
  };
}

function simplifySchemaSpec(spec: Record<string, unknown> | undefined) {
  if (!spec || typeof spec !== "object") {
    return spec ?? null;
  }
  const ignore = new Set(["schema", "contentExpr", "parseDOM", "toDOM"]);
  const seen = new WeakMap<object, string>();

  const visit = (value: unknown, path: string): unknown => {
    if (
      value == null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (typeof value === "function") {
      return `[Function ${value.name || "anonymous"}]`;
    }
    if (typeof value === "symbol") {
      return value.toString();
    }
    if (typeof value !== "object") {
      return String(value);
    }
    const existingPath = seen.get(value as object);
    if (existingPath) {
      return `[Circular -> ${existingPath}]`;
    }
    seen.set(value as object, path);

    if (Array.isArray(value)) {
      return value.map((item, index) => visit(item, `${path}[${index}]`));
    }

    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (ignore.has(key)) {
        continue;
      }
      output[key] = visit(entry, `${path}.${key}`);
    }
    return output;
  };

  return visit(spec, "$");
}

export function getStructureTree(state: EditorState) {
  return walkNode(state.doc, 0);
}

function walkNode(node: any, startPos: number): Record<string, unknown> {
  const item: Record<string, unknown> = {
    type: node.type?.name ?? "unknown",
    start: startPos,
    end: startPos + node.nodeSize,
    size: node.nodeSize,
  };
  if (node.text) {
    item.text = node.text;
  }
  if (node.attrs && Object.keys(node.attrs).length) {
    item.attrs = node.attrs;
  }
  if (node.marks?.length) {
    item.marks = node.marks.map((mark: any) => mark.toJSON?.() ?? mark);
  }
  if (node.content?.childCount) {
    let childOffset = startPos + 1;
    item.children = [];
    node.forEach((child: any) => {
      (item.children as unknown[]).push(walkNode(child, childOffset));
      childOffset += child.nodeSize;
    });
  }
  return item;
}

export function getPaginationData(editorView: EditorView) {
  const view = editorView as any;
  const direct =
    typeof view.getPaginationInfo === "function" ? view.getPaginationInfo() : null;
  if (direct) {
    return direct;
  }
  const layout = view?._internals?.getLayout?.() ?? null;
  const settings = view?._internals?.settings ?? null;
  const scrollArea = view?._internals?.dom?.scrollArea ?? null;
  if (!layout || !settings || !scrollArea) {
    return null;
  }
  return {
    pageCount: layout.pages?.length ?? 0,
    totalHeight: layout.totalHeight ?? 0,
    pageWidth: layout.pageWidth ?? settings.pageWidth ?? 0,
    pageHeight: layout.pageHeight ?? settings.pageHeight ?? 0,
    pageGap: layout.pageGap ?? settings.pageGap ?? 0,
    margin: layout.margin ?? settings.margin ?? null,
    scrollTop: scrollArea.scrollTop ?? 0,
    viewportHeight: scrollArea.clientHeight ?? 0,
    pages: (layout.pages ?? []).map((page: any, index: number) => ({
      index,
      lineCount: page?.lines?.length ?? 0,
      rootIndexMin: Number.isFinite(page?.rootIndexMin) ? page.rootIndexMin : null,
      rootIndexMax: Number.isFinite(page?.rootIndexMax) ? page.rootIndexMax : null,
    })),
  };
}

export function formatData(value: unknown) {
  return JSON.stringify(normalizeValue(value), null, 2);
}

function normalizeValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (depth > 5) {
    return "[MaxDepth]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => normalizeValue(item, depth + 1, seen));
  }
  if (typeof Element !== "undefined" && value instanceof Element) {
    return `<${value.tagName.toLowerCase()}>`;
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) {
      return "[Circular]";
    }
    seen.add(value as object);
    const candidate = value as any;
    if (typeof candidate.toJSON === "function") {
      try {
        return normalizeValue(candidate.toJSON(), depth + 1, seen);
      } catch {
        return `[${candidate.constructor?.name ?? "Object"}]`;
      }
    }
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(candidate)) {
      output[key] = normalizeValue(entry, depth + 1, seen);
    }
    return output;
  }
  return String(value);
}

function createHistoryEntry(state: EditorState): DevToolsHistoryItem {
  const serializer = DOMSerializer.fromSchema(state.schema);
  const domFragment = serializer.serializeFragment(state.selection.content().content);
  const chunks: string[] = [];
  let child = domFragment?.firstChild ?? null;
  while (child) {
    chunks.push((child as HTMLElement).outerHTML ?? child.textContent ?? "");
    child = child.nextSibling;
  }
  return {
    id: nanoid(),
    state,
    timestamp: Date.now(),
    selectionContent: prettyPrint(chunks.join("\n"), {
      max_char: 60,
      indent_size: 2,
    }),
  };
}

function loadSnapshots(): DevToolsSnapshot[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSnapshots(snapshots: DevToolsSnapshot[]) {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

function dispatchTransaction(editorView: EditorView, tr: Transaction) {
  const view = editorView as any;
  if (typeof view.dispatchTransaction === "function") {
    view.dispatchTransaction(tr);
    return;
  }
  if (typeof view.dispatch === "function") {
    view.dispatch(tr);
  }
}

function getPluginKey(plugin: any) {
  return plugin?.key ?? plugin?.spec?.key ?? plugin?.constructor?.name ?? "plugin";
}
