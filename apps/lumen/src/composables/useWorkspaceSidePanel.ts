import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import type { TrackChangeRecord } from "lumenpage-extension-track-change";
import type { LumenAnnotationStore } from "../annotation/annotationStore";
import type { LumenCommentThread } from "../editor/commentsStore";

export type SideTabKey =
  | "outline"
  | "comments"
  | "collaboration"
  | "locks"
  | "assistant"
  | "changes"
  | "annotation";

type UseWorkspaceSidePanelOptions = {
  annotationStore: LumenAnnotationStore;
  workspaceRef: Ref<HTMLElement | null>;
  commentThreads: Ref<LumenCommentThread[]>;
  activeCommentThreadId: Ref<string | null>;
  trackChangeRecords: Ref<TrackChangeRecord[]>;
  activeTrackChangeId: Ref<string | null>;
  clearActiveCommentThread: () => void;
  clearActiveTrackChange: () => void;
  setTocOutlineEnabled: (enabled: boolean) => void;
  activateCommentThread: (threadId: string | null) => void;
  activateTrackChange: (changeId: string | null) => void;
};

const RIGHT_SIDEBAR_DEFAULT_WIDTH = 360;
const RIGHT_SIDEBAR_MIN_WIDTH = 280;
const RIGHT_SIDEBAR_MAX_WIDTH = 460;

const clampRightSidebarWidth = (value: number) =>
  Math.min(RIGHT_SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, Math.round(value)));

export const useWorkspaceSidePanel = ({
  annotationStore,
  workspaceRef,
  commentThreads,
  activeCommentThreadId,
  trackChangeRecords,
  activeTrackChangeId,
  clearActiveCommentThread,
  clearActiveTrackChange,
  setTocOutlineEnabled,
  activateCommentThread,
  activateTrackChange,
}: UseWorkspaceSidePanelOptions) => {
  const activeSideTab = ref<SideTabKey | null>(null);
  const rightSidebarWidth = ref(RIGHT_SIDEBAR_DEFAULT_WIDTH);
  const isResizingRightSidebar = ref(false);

  const updateRightSidebarWidthFromPointer = (clientX: number) => {
    const rect = workspaceRef.value?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    rightSidebarWidth.value = clampRightSidebarWidth(rect.right - clientX);
  };

  const stopRightSidebarResize = () => {
    if (!isResizingRightSidebar.value) {
      return;
    }
    isResizingRightSidebar.value = false;
    if (typeof document !== "undefined") {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  };

  const setActiveSideTab = (nextTab: SideTabKey | null) => {
    if (activeSideTab.value === "annotation" && nextTab !== "annotation") {
      annotationStore.setActive(false);
    }
    activeSideTab.value = nextTab;
    setTocOutlineEnabled(nextTab === "outline");
  };

  const setTocPanelEnabled = (enabled: boolean) => {
    if (enabled) {
      clearActiveCommentThread();
      clearActiveTrackChange();
      setActiveSideTab("outline");
      return;
    }
    if (activeSideTab.value === "outline") {
      setActiveSideTab(null);
      return;
    }
    setTocOutlineEnabled(false);
  };

  const toggleTocPanel = () => {
    handleFloatingActionClick("outline");
  };

  const closeCommentsPanel = () => {
    clearActiveCommentThread();
    if (activeSideTab.value === "comments") {
      setActiveSideTab(null);
    }
  };

  const closeAssistantPanel = () => {
    if (activeSideTab.value === "assistant") {
      setActiveSideTab(null);
    }
  };

  const closeDocumentLocksPanel = () => {
    if (activeSideTab.value === "locks") {
      setActiveSideTab(null);
    }
  };

  const closeAnnotationPanel = () => {
    annotationStore.setActive(false);
    if (activeSideTab.value === "annotation") {
      setActiveSideTab(null);
    }
  };

  const getNextTrackChangeId = (excludeChangeId?: string | null) =>
    trackChangeRecords.value.find((change) => change.changeId !== excludeChangeId)?.changeId || null;

  const closeTrackChangesPanel = () => {
    clearActiveTrackChange();
    if (activeSideTab.value === "changes") {
      setActiveSideTab(null);
    }
  };

  const openTrackChangesPanel = (preferredChangeId?: string | null) => {
    clearActiveCommentThread();
    setActiveSideTab("changes");
    const nextChangeId =
      preferredChangeId || activeTrackChangeId.value || trackChangeRecords.value[0]?.changeId || null;
    if (nextChangeId && nextChangeId !== activeTrackChangeId.value) {
      activeTrackChangeId.value = nextChangeId;
      activateTrackChange(nextChangeId);
    }
  };

  const getNextCommentThreadId = (excludeThreadId?: string | null) =>
    commentThreads.value.find((thread) => thread.id !== excludeThreadId)?.id || null;

  const openCommentsPanel = (preferredThreadId?: string | null) => {
    clearActiveTrackChange();
    setActiveSideTab("comments");
    const nextThreadId =
      preferredThreadId || activeCommentThreadId.value || getNextCommentThreadId();
    if (nextThreadId && nextThreadId !== activeCommentThreadId.value) {
      activeCommentThreadId.value = nextThreadId;
      activateCommentThread(nextThreadId);
    }
  };

  const openAssistantPanel = () => {
    clearActiveCommentThread();
    clearActiveTrackChange();
    setActiveSideTab("assistant");
  };

  const openAnnotationPanel = () => {
    clearActiveCommentThread();
    clearActiveTrackChange();
    annotationStore.setActive(true);
    setActiveSideTab("annotation");
  };

  const handleFloatingActionClick = (tab: SideTabKey) => {
    if (tab === "outline") {
      setTocPanelEnabled(activeSideTab.value !== "outline");
      return;
    }
    if (tab === "comments") {
      if (activeSideTab.value === "comments") {
        closeCommentsPanel();
        return;
      }
      openCommentsPanel(activeCommentThreadId.value);
      return;
    }
    if (tab === "changes") {
      if (activeSideTab.value === "changes") {
        closeTrackChangesPanel();
        return;
      }
      openTrackChangesPanel(activeTrackChangeId.value);
      return;
    }
    if (tab === "assistant") {
      if (activeSideTab.value === "assistant") {
        closeAssistantPanel();
        return;
      }
      openAssistantPanel();
      return;
    }
    if (tab === "locks") {
      if (activeSideTab.value === "locks") {
        closeDocumentLocksPanel();
        return;
      }
      clearActiveCommentThread();
      clearActiveTrackChange();
      setActiveSideTab("locks");
      return;
    }
    if (tab === "collaboration") {
      if (activeSideTab.value === "collaboration") {
        setActiveSideTab(null);
        return;
      }
      clearActiveCommentThread();
      clearActiveTrackChange();
      setActiveSideTab("collaboration");
      return;
    }
    if (activeSideTab.value === "annotation" && annotationStore.state.active) {
      closeAnnotationPanel();
      return;
    }
    openAnnotationPanel();
  };

  const handleRightSidebarResizeMove = (event: PointerEvent) => {
    if (!isResizingRightSidebar.value) {
      return;
    }
    event.preventDefault();
    updateRightSidebarWidthFromPointer(event.clientX);
  };

  const handleRightSidebarResizeEnd = () => {
    stopRightSidebarResize();
  };

  const handleRightSidebarResizeStart = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    isResizingRightSidebar.value = true;
    updateRightSidebarWidthFromPointer(event.clientX);
    if (typeof document !== "undefined") {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
  };

  const resetWorkspaceSidePanelState = () => {
    stopRightSidebarResize();
    setActiveSideTab(null);
  };

  onMounted(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.addEventListener("pointermove", handleRightSidebarResizeMove, { passive: false });
    window.addEventListener("pointerup", handleRightSidebarResizeEnd, { passive: true });
    window.addEventListener("pointercancel", handleRightSidebarResizeEnd, { passive: true });
  });

  onBeforeUnmount(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("pointermove", handleRightSidebarResizeMove);
      window.removeEventListener("pointerup", handleRightSidebarResizeEnd);
      window.removeEventListener("pointercancel", handleRightSidebarResizeEnd);
    }
    resetWorkspaceSidePanelState();
  });

  return {
    activeSideTab,
    rightSidebarWidth,
    isResizingRightSidebar,
    setActiveSideTab,
    toggleTocPanel,
    closeCommentsPanel,
    closeAssistantPanel,
    closeDocumentLocksPanel,
    closeAnnotationPanel,
    closeTrackChangesPanel,
    openTrackChangesPanel,
    openCommentsPanel,
    handleFloatingActionClick,
    handleRightSidebarResizeStart,
    stopRightSidebarResize,
    resetWorkspaceSidePanelState,
  };
};
