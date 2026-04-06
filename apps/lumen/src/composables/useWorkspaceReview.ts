import { computed, ref, type ComputedRef, type Ref } from "vue";
import { TextSelection } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import { findCommentAnchorRanges } from "lumenpage-extension-comment";
import type { TrackChangeRecord } from "lumenpage-extension-track-change";
import type { LumenCollaborationState } from "../editor/collaboration";
import { lumenCommentsStore, type LumenCommentThread } from "../editor/commentsStore";
import { showToolbarMessage } from "../editor/toolbarActions/ui/message";
import type { SideTabKey } from "./useWorkspaceSidePanel";

type ReviewActionTexts = Record<string, string>;

type UseWorkspaceReviewOptions = {
  getView: () => CanvasEditorView | null;
  realtimeCollaborationEnabled: ComputedRef<boolean>;
  collaborationState: Ref<LumenCollaborationState>;
  currentCommentUserName: ComputedRef<string>;
  canMutateComments: ComputedRef<boolean>;
  canMutateTrackChanges: ComputedRef<boolean>;
  commentActionTexts: ComputedRef<ReviewActionTexts>;
  trackChangeActionTexts: ComputedRef<ReviewActionTexts>;
  getActiveSideTab: () => SideTabKey | null;
  openCommentsPanel: (preferredThreadId?: string | null) => void;
  openTrackChangesPanel: (preferredChangeId?: string | null) => void;
  setCommentAnchor: (options: { threadId: string; anchorId: string }) => boolean;
  activateCommentThread: (threadId: string | null) => boolean;
  focusCommentThread: (threadId: string) => boolean;
  restoreLastTextSelection: () => boolean;
  removeCommentThread: (threadId: string) => boolean;
  setTrackChangesEnabled: (enabled: boolean) => boolean;
  activateTrackChange: (changeId: string | null) => boolean;
  focusTrackChange: (changeId: string) => boolean;
  acceptTrackChange: (changeId: string) => boolean;
  rejectTrackChange: (changeId: string) => boolean;
  acceptAllTrackChanges: () => boolean;
  rejectAllTrackChanges: () => boolean;
};

export const useWorkspaceReview = ({
  getView,
  realtimeCollaborationEnabled,
  collaborationState,
  currentCommentUserName,
  canMutateComments,
  canMutateTrackChanges,
  commentActionTexts,
  trackChangeActionTexts,
  getActiveSideTab,
  openCommentsPanel,
  openTrackChangesPanel,
  setCommentAnchor,
  activateCommentThread,
  focusCommentThread,
  restoreLastTextSelection,
  removeCommentThread,
  setTrackChangesEnabled,
  activateTrackChange,
  focusTrackChange,
  acceptTrackChange,
  rejectTrackChange,
  acceptAllTrackChanges,
  rejectAllTrackChanges,
}: UseWorkspaceReviewOptions) => {
  const commentThreads = ref<LumenCommentThread[]>(lumenCommentsStore.listThreads());
  const activeCommentThreadId = ref<string | null>(null);
  const trackChangesEnabled = ref(false);
  const trackChangeRecords = ref<TrackChangeRecord[]>([]);
  const activeTrackChangeId = ref<string | null>(null);
  const commentCount = computed(() => commentThreads.value.length);
  const trackChangeCount = computed(() => trackChangeRecords.value.length);

  let isPruningCommentThreads = false;

  const createCommentEntityId = (prefix: string) => {
    const randomUuid =
      typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : null;
    if (randomUuid) {
      return `${prefix}-${randomUuid}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const clearActiveCommentThread = () => {
    const hadActiveThread = !!activeCommentThreadId.value;
    activeCommentThreadId.value = null;
    if (hadActiveThread) {
      activateCommentThread(null);
    }
  };

  const clearActiveTrackChange = () => {
    const hadActiveChange = !!activeTrackChangeId.value;
    activeTrackChangeId.value = null;
    if (hadActiveChange) {
      activateTrackChange(null);
    }
  };

  const getNextCommentThreadId = (excludeThreadId?: string | null) =>
    commentThreads.value.find((thread) => thread.id !== excludeThreadId)?.id || null;

  const getNextTrackChangeId = (excludeChangeId?: string | null) =>
    trackChangeRecords.value.find((change) => change.changeId !== excludeChangeId)?.changeId || null;

  const readSelectedCommentQuote = (currentView: CanvasEditorView) => {
    const state = currentView?.state;
    const from = Number(state?.selection?.from);
    const to = Number(state?.selection?.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return null;
    }
    if (typeof state?.doc?.textBetween !== "function") {
      return null;
    }
    const text = String(state.doc.textBetween(from, to, "\n", "\n") || "").trim();
    return text || null;
  };

  const findSelectedCommentAnchor = (currentView: CanvasEditorView) => {
    const state = currentView?.state;
    const selection = state?.selection;
    const from = Number(selection?.from);
    const to = Number(selection?.to);
    if (!(selection instanceof TextSelection) || selection.empty === true) {
      return null;
    }
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return null;
    }

    const ranges = findCommentAnchorRanges(state);
    if (!Array.isArray(ranges) || ranges.length === 0) {
      return null;
    }

    return (
      ranges.find((range) => range.from === from && range.to === to) ||
      ranges.find((range) => from >= range.from && to <= range.to) ||
      null
    );
  };

  const resolveCommentSelectionView = () => {
    const currentView = getView();
    const selection = currentView?.state?.selection;
    if (currentView && selection instanceof TextSelection && selection.empty !== true) {
      return currentView;
    }
    if (restoreLastTextSelection()) {
      const restoredView = getView();
      const restoredSelection = restoredView?.state?.selection;
      if (
        restoredView &&
        restoredSelection instanceof TextSelection &&
        restoredSelection.empty !== true
      ) {
        return restoredView;
      }
    }
    return currentView ?? null;
  };

  const pruneOrphanCommentThreads = () => {
    if (isPruningCommentThreads) {
      return false;
    }
    const currentView = getView();
    if (!currentView?.state) {
      return false;
    }
    if (realtimeCollaborationEnabled.value && !collaborationState.value.synced) {
      return false;
    }

    const anchorThreadIds = new Set(
      findCommentAnchorRanges(currentView.state)
        .map((range) => range.threadId)
        .filter((threadId): threadId is string => !!threadId),
    );
    const orphanThreadIds = lumenCommentsStore
      .listThreads()
      .filter((thread) => !anchorThreadIds.has(thread.id))
      .map((thread) => thread.id);

    if (orphanThreadIds.length === 0) {
      return false;
    }

    isPruningCommentThreads = true;
    try {
      for (const threadId of orphanThreadIds) {
        lumenCommentsStore.removeThread(threadId);
      }
    } finally {
      isPruningCommentThreads = false;
    }
    return true;
  };

  const syncCommentThreads = () => {
    pruneOrphanCommentThreads();
    const threads = lumenCommentsStore.listThreads();
    commentThreads.value = threads;
    const hasActiveThread =
      !!activeCommentThreadId.value &&
      threads.some((thread) => thread.id === activeCommentThreadId.value);
    if (!hasActiveThread) {
      activeCommentThreadId.value = null;
      if (getActiveSideTab() === "comments" && threads.length > 0) {
        openCommentsPanel(threads[0]?.id || null);
      }
    }
  };

  const handleCommentRuntimeStateChange = ({ activeThreadId }: { activeThreadId: string | null }) => {
    const nextThreadId = activeThreadId || null;
    const previousThreadId = activeCommentThreadId.value;
    activeCommentThreadId.value = nextThreadId;
    syncCommentThreads();
    const resolvedThreadId = activeCommentThreadId.value;
    if (resolvedThreadId && (getActiveSideTab() !== "comments" || resolvedThreadId !== previousThreadId)) {
      openCommentsPanel(resolvedThreadId);
    }
  };

  const handleTrackChangeRuntimeStateChange = ({
    enabled,
    activeChangeId,
    changes,
  }: {
    enabled: boolean;
    activeChangeId: string | null;
    changes: TrackChangeRecord[];
  }) => {
    trackChangesEnabled.value = enabled;
    trackChangeRecords.value = changes;
    const nextActiveChangeId =
      activeChangeId && changes.some((change) => change.changeId === activeChangeId)
        ? activeChangeId
        : null;
    activeTrackChangeId.value = nextActiveChangeId;
    if (nextActiveChangeId) {
      openTrackChangesPanel(nextActiveChangeId);
      return;
    }
    if (getActiveSideTab() === "changes" && changes.length > 0) {
      const fallbackChangeId = getNextTrackChangeId();
      if (fallbackChangeId) {
        activeTrackChangeId.value = fallbackChangeId;
        activateTrackChange(fallbackChangeId);
      }
    }
  };

  const handleCommentClick = () => {
    const texts = commentActionTexts.value;
    const currentView = resolveCommentSelectionView();
    const selection = currentView?.state?.selection;
    const hasSelection =
      !!currentView && selection instanceof TextSelection && selection.empty !== true;

    if (canMutateComments.value && hasSelection) {
      const existingAnchor = findSelectedCommentAnchor(currentView);
      if (existingAnchor) {
        if (!lumenCommentsStore.getThread(existingAnchor.threadId)) {
          const now = new Date().toISOString();
          lumenCommentsStore.upsertThread({
            id: existingAnchor.threadId,
            anchorId: existingAnchor.anchorId,
            quote: readSelectedCommentQuote(currentView),
            messages: [],
            status: "open",
            createdAt: now,
            updatedAt: now,
          });
        }
        openCommentsPanel(existingAnchor.threadId);
        focusCommentThread(existingAnchor.threadId);
        return;
      }

      const threadId = createCommentEntityId("thread");
      const anchorId = createCommentEntityId("anchor");
      const applied = setCommentAnchor({ threadId, anchorId });
      if (!applied) {
        showToolbarMessage(texts.failed, "error");
        return;
      }

      const now = new Date().toISOString();
      lumenCommentsStore.upsertThread({
        id: threadId,
        anchorId,
        quote: readSelectedCommentQuote(currentView),
        messages: [],
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
      activateCommentThread(threadId);
      openCommentsPanel(threadId);
      showToolbarMessage(texts.created, "success");
      return;
    }

    if (!canMutateComments.value) {
      showToolbarMessage(texts.disabled, "warning");
      return;
    }
    showToolbarMessage(texts.requiresSelection, "warning");
  };

  const handleCommentThreadSelect = (threadId: string) => {
    const texts = commentActionTexts.value;
    openCommentsPanel(threadId);
    const focused = focusCommentThread(threadId);
    if (!focused) {
      const activated = activateCommentThread(threadId);
      if (!activated) {
        showToolbarMessage(texts.missingAnchor, "warning");
      }
    }
  };

  const handleCommentThreadResolved = ({
    threadId,
    resolved,
  }: {
    threadId: string;
    resolved: boolean;
  }) => {
    lumenCommentsStore.setResolved(threadId, resolved);
  };

  const handleCommentThreadReply = ({
    threadId,
    body,
  }: {
    threadId: string;
    body: string;
  }) => {
    const texts = commentActionTexts.value;
    const nextMessage = lumenCommentsStore.addMessage(threadId, {
      body,
      authorId: currentCommentUserName.value,
      authorName: currentCommentUserName.value,
    });
    if (!nextMessage) {
      showToolbarMessage(texts.replyFailed, "warning");
      return;
    }
    openCommentsPanel(threadId);
  };

  const handleCommentMessageEdit = ({
    threadId,
    messageId,
    body,
  }: {
    threadId: string;
    messageId: string;
    body: string;
  }) => {
    const texts = commentActionTexts.value;
    const nextMessage = lumenCommentsStore.updateMessage(threadId, messageId, {
      body,
      authorId: currentCommentUserName.value,
      authorName: currentCommentUserName.value,
    });
    if (!nextMessage) {
      showToolbarMessage(texts.editFailed, "warning");
      return;
    }
    openCommentsPanel(threadId);
    showToolbarMessage(texts.edited, "success");
  };

  const handleCommentMessageDelete = ({
    threadId,
    messageId,
  }: {
    threadId: string;
    messageId: string;
  }) => {
    const texts = commentActionTexts.value;
    const removed = lumenCommentsStore.removeMessage(threadId, messageId);
    if (!removed) {
      showToolbarMessage(texts.deleteMessageFailed, "warning");
      return;
    }
    openCommentsPanel(threadId);
    showToolbarMessage(texts.messageRemoved, "success");
  };

  const handleCommentThreadDelete = (threadId: string) => {
    const texts = commentActionTexts.value;
    const nextThreadId = getNextCommentThreadId(threadId);
    removeCommentThread(threadId);
    lumenCommentsStore.removeThread(threadId);
    if (activeCommentThreadId.value === threadId) {
      activeCommentThreadId.value = nextThreadId;
      activateCommentThread(nextThreadId);
    }
    showToolbarMessage(texts.removed, "success");
  };

  const handleTrackChangesToggle = () => {
    const texts = trackChangeActionTexts.value;
    if (!canMutateTrackChanges.value) {
      showToolbarMessage(texts.disabled, "warning");
      return;
    }
    const nextEnabled = !trackChangesEnabled.value;
    const applied = setTrackChangesEnabled(nextEnabled);
    if (!applied) {
      showToolbarMessage(texts.enableFailed, "error");
      return;
    }
    if (nextEnabled) {
      openTrackChangesPanel();
      showToolbarMessage(texts.enabled, "success");
      return;
    }
    showToolbarMessage(texts.disabledDone, "success");
  };

  const handleTrackChangeSelect = (changeId: string) => {
    const texts = trackChangeActionTexts.value;
    openTrackChangesPanel(changeId);
    const focused = focusTrackChange(changeId);
    if (!focused) {
      const activated = activateTrackChange(changeId);
      if (!activated) {
        showToolbarMessage(texts.focusFailed, "warning");
      }
    }
  };

  const handleTrackChangeAccept = (changeId: string) => {
    const texts = trackChangeActionTexts.value;
    if (!acceptTrackChange(changeId)) {
      showToolbarMessage(texts.acceptFailed, "warning");
      return;
    }
    showToolbarMessage(texts.accepted, "success");
  };

  const handleTrackChangeReject = (changeId: string) => {
    const texts = trackChangeActionTexts.value;
    if (!rejectTrackChange(changeId)) {
      showToolbarMessage(texts.rejectFailed, "warning");
      return;
    }
    showToolbarMessage(texts.rejected, "success");
  };

  const handleTrackChangesAcceptAll = () => {
    const texts = trackChangeActionTexts.value;
    if (!acceptAllTrackChanges()) {
      showToolbarMessage(texts.acceptAllFailed, "warning");
      return;
    }
    showToolbarMessage(texts.acceptedAll, "success");
  };

  const handleTrackChangesRejectAll = () => {
    const texts = trackChangeActionTexts.value;
    if (!rejectAllTrackChanges()) {
      showToolbarMessage(texts.rejectAllFailed, "warning");
      return;
    }
    showToolbarMessage(texts.rejectedAll, "success");
  };

  const resetReviewState = () => {
    commentThreads.value = [];
    activeCommentThreadId.value = null;
    trackChangesEnabled.value = false;
    trackChangeRecords.value = [];
    activeTrackChangeId.value = null;
  };

  return {
    commentThreads,
    activeCommentThreadId,
    trackChangesEnabled,
    trackChangeRecords,
    activeTrackChangeId,
    commentCount,
    trackChangeCount,
    clearActiveCommentThread,
    clearActiveTrackChange,
    syncCommentThreads,
    handleCommentRuntimeStateChange,
    handleTrackChangeRuntimeStateChange,
    handleCommentClick,
    handleCommentThreadSelect,
    handleCommentThreadResolved,
    handleCommentThreadReply,
    handleCommentMessageEdit,
    handleCommentMessageDelete,
    handleCommentThreadDelete,
    handleTrackChangesToggle,
    handleTrackChangeSelect,
    handleTrackChangeAccept,
    handleTrackChangeReject,
    handleTrackChangesAcceptAll,
    handleTrackChangesRejectAll,
    resetReviewState,
  };
};
