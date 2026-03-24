import type { EditorState, Selection, Transaction } from "lumenpage-state";
import type { EditorView } from "lumenpage-view-types";

export type DevToolsTabKey =
  | "state"
  | "history"
  | "plugins"
  | "schema"
  | "structure"
  | "snapshots"
  | "pages";

export type DevToolsOptions = {
  diffWorker?: Worker;
  mount?: HTMLElement | null;
  className?: string;
  defaultOpen?: boolean;
  defaultTab?: DevToolsTabKey;
};

export type DevToolsPluginItem = {
  key: string;
  plugin: any;
  hasState: boolean;
  state: unknown;
};

export type DevToolsHistoryItem = {
  id: string;
  state: EditorState;
  timestamp: number;
  selectionContent: string;
};

export type DevToolsSnapshot = {
  id: string;
  name: string;
  timestamp: number;
  doc: unknown;
};

export type DevToolsHistoryDiff = {
  diff: unknown;
  selection: unknown;
  pending?: boolean;
};

export type SelectionSummary = {
  empty: boolean;
  anchor: number;
  head: number;
  from: number;
  to: number;
  type?: string;
  $from?: Record<string, unknown>;
  $to?: Record<string, unknown>;
};

export type DevToolsController = {
  editorView: EditorView;
  editorState: { value: EditorState };
  isOpen: { value: boolean };
  activeTab: { value: DevToolsTabKey };
  selectedHistoryIndex: { value: number };
  selectedPluginKey: { value: string };
  pluginSearch: { value: string };
  pluginSortAsc: { value: boolean };
  selectionExpanded: { value: boolean };
  selectedStructureNode: { value: any | null };
  history: { value: DevToolsHistoryItem[] };
  historyDiffs: { value: Record<string, DevToolsHistoryDiff> };
  snapshots: { value: DevToolsSnapshot[] };
  open: () => void;
  close: () => void;
  toggleOpen: () => void;
  resetHistory: (state: EditorState) => void;
  handleTransaction: (
    tr: Transaction,
    oldState: EditorState,
    newState: EditorState,
  ) => void;
  rollbackHistory: (item: DevToolsHistoryItem, index: number) => void;
  saveSnapshot: () => void;
  loadSnapshot: (snapshot: DevToolsSnapshot) => void;
  deleteSnapshot: (snapshotId: string) => void;
  destroy: () => void;
};

export type SelectionWithJSON = Selection & {
  jsonID?: string;
};
