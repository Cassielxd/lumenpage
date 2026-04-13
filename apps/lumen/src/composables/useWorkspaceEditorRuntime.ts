import { nextTick, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from "vue";
import type { Editor as LumenEditor } from "lumenpage-core";
import { NodeSelection, Selection, TextSelection } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import type { TrackChangeRecord } from "lumenpage-extension-track-change";
import type { LumenAnnotationStore } from "../annotation/annotationStore";
import {
  createInitialLumenCollaborationState,
  type LumenCollaborationState,
} from "../editor/collaboration";
import { lumenCommentsStore } from "../editor/commentsStore";
import { mountPlaygroundEditor } from "../editor/editorMount";
import type { PlaygroundDebugFlags } from "../editor/config";
import type { PlaygroundPermissionMode } from "../editor/permissionPlugin";
import type { EditorSessionMode } from "../editor/sessionMode";
import type { TocOutlineSnapshot } from "../editor/tocOutlinePlugin";

type CommentStateSnapshot = {
  activeThreadId: string | null;
};

type TrackChangeStateSnapshot = {
  enabled: boolean;
  activeChangeId: string | null;
  changes: TrackChangeRecord[];
};

type DocumentLockStateSnapshot = {
  enabled: boolean;
  showMarkers: boolean;
  lockedRangeCount: number;
};

type EditorStatsSnapshot = {
  pageCount: number;
  currentPage: number;
  nodeCount: number;
  pluginCount: number;
  wordCount: number;
  selectedWordCount: number;
  blockType: string;
};

type PendingRuntimeContext = {
  flags: PlaygroundDebugFlags;
  snapshotBase64: string | null;
};

type LumenSelectionSnapshot = {
  from: number;
  to: number;
  empty: boolean;
  type: string | null;
};

type LumenTextSelectionSnapshot = {
  from: number;
  to: number;
};

type LumenTestApi = {
  forceRender: () => boolean;
  getSelection: () => LumenSelectionSnapshot | null;
  setJSON: (docJson: unknown) => boolean;
  setSelection: (from: number, to: number) => boolean;
};

type LumenDebugWindow = Window & {
  __lumenView?: CanvasEditorView | null;
  __lumenTestApi?: LumenTestApi | null;
};

type UseWorkspaceEditorRuntimeOptions = {
  editorHost: Ref<HTMLElement | null>;
  getStatusElement: () => HTMLElement | null;
  effectivePermissionMode: ComputedRef<PlaygroundPermissionMode>;
  sessionMode: Ref<EditorSessionMode>;
  annotationStore: LumenAnnotationStore;
  restoreAnnotationSession: () => void;
  syncAnnotationAuthor: () => void;
  setSnapshotDocument: (document: unknown | null) => void;
  resetWorkspaceSnapshotPersistence: () => void;
  resetRuntimeState: () => void;
  syncCommentThreads: () => void;
  setCollaborationState: (state: LumenCollaborationState) => void;
  isTocOutlineEnabled: () => boolean;
  onCollaborationStateChange?: ((state: LumenCollaborationState) => void) | null;
  onTocOutlineChange?: ((snapshot: TocOutlineSnapshot) => void) | null;
  onCommentStateChange?: ((snapshot: CommentStateSnapshot) => void) | null;
  onDocumentLockStateChange?: ((snapshot: DocumentLockStateSnapshot) => void) | null;
  onTrackChangeStateChange?: ((snapshot: TrackChangeStateSnapshot) => void) | null;
  onDocumentChange?: ((snapshot: { docChanged: boolean }) => void) | null;
  onStatsChange?: ((stats: EditorStatsSnapshot) => void) | null;
};

const clampSelectionPos = (doc: CanvasEditorView["state"]["doc"] | null | undefined, pos: number) => {
  const contentSize = Number(doc?.content?.size);
  if (!Number.isFinite(contentSize)) {
    return 0;
  }
  return Math.max(0, Math.min(contentSize, Math.floor(pos)));
};

const readSelectionSnapshot = (currentView: CanvasEditorView | null): LumenSelectionSnapshot | null => {
  const selection = currentView?.state?.selection;
  if (!selection) {
    return null;
  }
  const jsonType = selection.toJSON?.()?.type ?? null;
  return {
    from: Number(selection.from),
    to: Number(selection.to),
    empty: selection.empty === true,
    type:
      selection instanceof NodeSelection
        ? "NodeSelection"
        : selection instanceof TextSelection
          ? "TextSelection"
          : jsonType === "all"
            ? "AllSelection"
            : jsonType === "node"
              ? "NodeSelection"
              : jsonType === "text"
                ? "TextSelection"
                : jsonType,
  };
};

const readTextSelectionSnapshot = (
  currentView: CanvasEditorView | null,
): LumenTextSelectionSnapshot | null => {
  const selection = currentView?.state?.selection;
  const from = Number(selection?.from);
  const to = Number(selection?.to);
  if (!(selection instanceof TextSelection) || selection.empty === true) {
    return null;
  }
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return null;
  }
  return {
    from,
    to,
  };
};

const setViewSelection = (currentView: CanvasEditorView | null, from: number, to: number) => {
  const doc = currentView?.state?.doc;
  const tr = currentView?.state?.tr;
  if (!doc || !tr) {
    return false;
  }
  const anchor = clampSelectionPos(doc, from);
  const head = clampSelectionPos(doc, to);
  try {
    const nextSelection =
      anchor === head
        ? Selection.near(doc.resolve(head), 1)
        : TextSelection.create(doc, Math.min(anchor, head), Math.max(anchor, head));
    currentView.dispatch(tr.setSelection(nextSelection).scrollIntoView());
    return true;
  } catch (_error) {
    return false;
  }
};

const decodeSnapshotBase64 = (value: string | null | undefined) => {
  if (value == null || typeof window === "undefined") {
    return null;
  }
  const normalized = String(value).trim();
  if (!normalized) {
    return new Uint8Array(0);
  }
  try {
    const binary = window.atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch (_error) {
    return null;
  }
};

export const useWorkspaceEditorRuntime = ({
  editorHost,
  getStatusElement,
  effectivePermissionMode,
  sessionMode,
  annotationStore,
  restoreAnnotationSession,
  syncAnnotationAuthor,
  setSnapshotDocument,
  resetWorkspaceSnapshotPersistence,
  resetRuntimeState,
  syncCommentThreads,
  setCollaborationState,
  isTocOutlineEnabled,
  onCollaborationStateChange,
  onTocOutlineChange,
  onCommentStateChange,
  onDocumentLockStateChange,
  onTrackChangeStateChange,
  onDocumentChange,
  onStatsChange,
}: UseWorkspaceEditorRuntimeOptions) => {
  const editor = shallowRef<LumenEditor | null>(null);
  const view = shallowRef<CanvasEditorView | null>(null);
  const pendingRuntime = shallowRef<PendingRuntimeContext | null>(null);
  const documentLockState = shallowRef<DocumentLockStateSnapshot>({
    enabled: true,
    showMarkers: true,
    lockedRangeCount: 0,
  });

  let detachEditor: null | (() => void) = null;
  let detachCommentStore: null | (() => void) = null;
  let detachSelectionTracking: null | (() => void) = null;
  let setTocOutlineEnabledHandle: null | ((enabled: boolean) => void) = null;
  let setCommentAnchorHandle: null | ((options: { threadId: string; anchorId: string }) => boolean) = null;
  let activateCommentThreadHandle: null | ((threadId: string | null) => boolean) = null;
  let focusCommentThreadHandle: null | ((threadId: string) => boolean) = null;
  let removeCommentThreadHandle: null | ((threadId: string) => boolean) = null;
  let lockSelectionHandle: null | (() => boolean) = null;
  let unlockSelectionHandle: null | (() => boolean) = null;
  let clearAllDocumentLocksHandle: null | (() => boolean) = null;
  let setDocumentLockingEnabledHandle: null | ((enabled: boolean) => boolean) = null;
  let setDocumentLockMarkersVisibleHandle: null | ((visible: boolean) => boolean) = null;
  let setTrackChangesEnabledHandle: null | ((enabled: boolean) => boolean) = null;
  let activateTrackChangeHandle: null | ((changeId: string | null) => boolean) = null;
  let focusTrackChangeHandle: null | ((changeId: string) => boolean) = null;
  let acceptTrackChangeHandle: null | ((changeId: string) => boolean) = null;
  let rejectTrackChangeHandle: null | ((changeId: string) => boolean) = null;
  let acceptAllTrackChangesHandle: null | (() => boolean) = null;
  let rejectAllTrackChangesHandle: null | (() => boolean) = null;
  let lastTextSelectionSnapshot: LumenTextSelectionSnapshot | null = null;

  const applySessionModeToView = () => {
    const currentView = view.value;
    if (!currentView) {
      return;
    }
    currentView.setProps({
      editable: () =>
        effectivePermissionMode.value !== "readonly" && sessionMode.value !== "viewer",
    });
  };

  const syncDebugHandles = () => {
    if (typeof window === "undefined") {
      return;
    }
    const debugWindow = window as LumenDebugWindow;
    const currentView = view.value;
    debugWindow.__lumenView = currentView ?? null;
    debugWindow.__lumenTestApi = currentView
      ? {
          forceRender: () => {
            currentView.forceRender();
            return true;
          },
          getSelection: () => readSelectionSnapshot(currentView),
          setJSON: (docJson: unknown) => currentView.setJSON(docJson),
          setSelection: (from: number, to: number) => setViewSelection(currentView, from, to),
        }
      : null;
  };

  const syncLastTextSelectionSnapshot = (currentView: CanvasEditorView | null) => {
    const nextSelection = readTextSelectionSnapshot(currentView);
    if (nextSelection) {
      lastTextSelectionSnapshot = nextSelection;
    }
  };

  const restoreLastTextSelection = () => {
    if (!lastTextSelectionSnapshot || !view.value) {
      return false;
    }
    const restored = setViewSelection(
      view.value,
      lastTextSelectionSnapshot.from,
      lastTextSelectionSnapshot.to,
    );
    if (restored) {
      view.value.focus();
    }
    return restored;
  };

  const clearMountedEditorRuntime = () => {
    resetWorkspaceSnapshotPersistence();
    detachEditor?.();
    detachEditor = null;
    detachCommentStore?.();
    detachCommentStore = null;
    detachSelectionTracking?.();
    detachSelectionTracking = null;
    setTocOutlineEnabledHandle = null;
    setCommentAnchorHandle = null;
    activateCommentThreadHandle = null;
    focusCommentThreadHandle = null;
    removeCommentThreadHandle = null;
    lockSelectionHandle = null;
    unlockSelectionHandle = null;
    clearAllDocumentLocksHandle = null;
    setDocumentLockingEnabledHandle = null;
    setDocumentLockMarkersVisibleHandle = null;
    setTrackChangesEnabledHandle = null;
    activateTrackChangeHandle = null;
    focusTrackChangeHandle = null;
    acceptTrackChangeHandle = null;
    rejectTrackChangeHandle = null;
    acceptAllTrackChangesHandle = null;
    rejectAllTrackChangesHandle = null;
    lastTextSelectionSnapshot = null;
    documentLockState.value = {
      enabled: true,
      showMarkers: true,
      lockedRangeCount: 0,
    };
    editor.value = null;
    view.value = null;
    syncDebugHandles();
    resetRuntimeState();
  };

  const attachMountedEditor = (
    mounted: ReturnType<typeof mountPlaygroundEditor>,
    runtimeFlags: PlaygroundDebugFlags,
  ) => {
    editor.value = mounted.editor;
    view.value = mounted.view;
    setSnapshotDocument(mounted.snapshotDocument);
    if (mounted.snapshotDocument) {
      annotationStore.useCollaborationStore(
        mounted.snapshotDocument,
        runtimeFlags.collaborationField,
      );
    } else {
      annotationStore.useLocalStore();
    }
    syncDebugHandles();
    setTocOutlineEnabledHandle = mounted.setTocOutlineEnabled;
    setCommentAnchorHandle = mounted.setCommentAnchor;
    activateCommentThreadHandle = mounted.activateCommentThread;
    focusCommentThreadHandle = mounted.focusCommentThread;
    removeCommentThreadHandle = mounted.removeCommentThread;
    lockSelectionHandle = mounted.lockSelection;
    unlockSelectionHandle = mounted.unlockSelection;
    clearAllDocumentLocksHandle = mounted.clearAllDocumentLocks;
    setDocumentLockingEnabledHandle = mounted.setDocumentLockingEnabled;
    setDocumentLockMarkersVisibleHandle = mounted.setDocumentLockMarkersVisible;
    setTrackChangesEnabledHandle = mounted.setTrackChangesEnabled;
    activateTrackChangeHandle = mounted.activateTrackChange;
    focusTrackChangeHandle = mounted.focusTrackChange;
    acceptTrackChangeHandle = mounted.acceptTrackChange;
    rejectTrackChangeHandle = mounted.rejectTrackChange;
    acceptAllTrackChangesHandle = mounted.acceptAllTrackChanges;
    rejectAllTrackChangesHandle = mounted.rejectAllTrackChanges;
    syncLastTextSelectionSnapshot(mounted.view);
    const handleSelectionUpdate = () => {
      syncLastTextSelectionSnapshot(view.value);
    };
    mounted.editor.on("selectionUpdate", handleSelectionUpdate);
    detachSelectionTracking = () => {
      mounted.editor.off("selectionUpdate", handleSelectionUpdate);
    };
    detachCommentStore = lumenCommentsStore.subscribe(syncCommentThreads) || null;
    syncCommentThreads();
    applySessionModeToView();
    detachEditor = mounted.destroy;
  };

  const mountOrRemountPlaygroundEditor = async (
    runtimeFlags: PlaygroundDebugFlags,
    snapshotBase64: string | null = null,
  ) => {
    pendingRuntime.value = {
      flags: runtimeFlags,
      snapshotBase64,
    };
    setCollaborationState(createInitialLumenCollaborationState(runtimeFlags));
    syncAnnotationAuthor();
    clearMountedEditorRuntime();
    if (!runtimeFlags.collaborationEnabled) {
      restoreAnnotationSession();
    }
    await nextTick();
    if (!editorHost.value) {
      return false;
    }
    const mounted = mountPlaygroundEditor({
      host: editorHost.value,
      statusElement: getStatusElement(),
      flags: runtimeFlags,
      initialCollaborationSnapshot: decodeSnapshotBase64(snapshotBase64),
      resolvePermissionMode: () => effectivePermissionMode.value,
      onCollaborationStateChange: onCollaborationStateChange || undefined,
      onTocOutlineChange: onTocOutlineChange || undefined,
      tocOutlineEnabled: isTocOutlineEnabled(),
      onCommentStateChange: onCommentStateChange || undefined,
      onDocumentLockStateChange: (snapshot) => {
        documentLockState.value = { ...snapshot };
        onDocumentLockStateChange?.(snapshot);
      },
      onTrackChangeStateChange: onTrackChangeStateChange || undefined,
      onDocumentChange: onDocumentChange || undefined,
      onStatsChange: onStatsChange || undefined,
    });
    attachMountedEditor(mounted, runtimeFlags);
    pendingRuntime.value = null;
    return true;
  };

  watch(
    () => effectivePermissionMode.value,
    (nextMode, previousMode) => {
      if (nextMode === "readonly") {
        sessionMode.value = "viewer";
      } else if ((previousMode == null || previousMode === "readonly") && sessionMode.value === "viewer") {
        sessionMode.value = "edit";
      }
      applySessionModeToView();
    },
    { immediate: true },
  );

  watch(
    () => sessionMode.value,
    () => {
      applySessionModeToView();
    },
  );

  watch(
    () => editorHost.value,
    (host) => {
      if (!host || !pendingRuntime.value || view.value) {
        return;
      }
      void mountOrRemountPlaygroundEditor(
        pendingRuntime.value.flags,
        pendingRuntime.value.snapshotBase64,
      );
    },
  );

  return {
    editor: editor as ShallowRef<LumenEditor | null>,
    view: view as ShallowRef<CanvasEditorView | null>,
    clearMountedEditorRuntime,
    mountOrRemountPlaygroundEditor,
    setTocOutlineEnabled: (enabled: boolean) => {
      setTocOutlineEnabledHandle?.(enabled);
    },
    setCommentAnchor: (options: { threadId: string; anchorId: string }) =>
      setCommentAnchorHandle?.(options) === true,
    activateCommentThread: (threadId: string | null) =>
      activateCommentThreadHandle?.(threadId) === true,
    focusCommentThread: (threadId: string) =>
      focusCommentThreadHandle?.(threadId) === true,
    restoreLastTextSelection,
    removeCommentThread: (threadId: string) =>
      removeCommentThreadHandle?.(threadId) === true,
    lockSelection: () => lockSelectionHandle?.() === true,
    unlockSelection: () => unlockSelectionHandle?.() === true,
    clearAllDocumentLocks: () => clearAllDocumentLocksHandle?.() === true,
    documentLockState,
    setDocumentLockingEnabled: (enabled: boolean) =>
      setDocumentLockingEnabledHandle?.(enabled) === true,
    setDocumentLockMarkersVisible: (visible: boolean) =>
      setDocumentLockMarkersVisibleHandle?.(visible) === true,
    setTrackChangesEnabled: (enabled: boolean) =>
      setTrackChangesEnabledHandle?.(enabled) === true,
    activateTrackChange: (changeId: string | null) =>
      activateTrackChangeHandle?.(changeId) === true,
    focusTrackChange: (changeId: string) =>
      focusTrackChangeHandle?.(changeId) === true,
    acceptTrackChange: (changeId: string) =>
      acceptTrackChangeHandle?.(changeId) === true,
    rejectTrackChange: (changeId: string) =>
      rejectTrackChangeHandle?.(changeId) === true,
    acceptAllTrackChanges: () => acceptAllTrackChangesHandle?.() === true,
    rejectAllTrackChanges: () => rejectAllTrackChangesHandle?.() === true,
  };
};
