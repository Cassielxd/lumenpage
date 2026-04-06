<template>
  <t-layout :class="['doc-shell', { 'is-high-contrast': debugFlags.highContrast }]">
    <WorkspaceTopbar
      :collaboration-enabled="realtimeCollaborationEnabled"
      :collaboration-document-name="collaborationState.documentName"
      :permission-label="permissionLabel"
      :locale-key="localeKey"
      :locale-options="localeOptions"
      :high-contrast="debugFlags.highContrast"
      :share-label="i18n.app.share"
      :backend-session-user="backendSessionUser"
      :manage-account-label="i18n.shareDialog.manageAccount"
      :login-label="i18n.shareDialog.login"
      :register-label="i18n.shareDialog.register"
      :avatar-text="topbarAvatarText"
      :account-popup-visible="accountPopupVisible"
      @locale-change="handleLocaleChange"
      @open-share="openShareDialog"
      @open-account="openAccountDialog"
      @account-popup-visible-change="(visible) => (accountPopupVisible = visible)"
    />

    <EditorMenuBar v-model:active-menu="activeToolbarMenu" :locale="localeKey" />
    <EditorToolbar
      ref="toolbarRef"
      :editor="editor"
      :editorView="view"
      :locale="localeKey"
      :active-menu="activeToolbarMenu"
      :session-mode="sessionMode"
      :can-edit="effectiveCapabilities.canEdit"
      @update:session-mode="handleSessionModeUpdate"
      @toggle-toc="toggleTocPanel"
    />

    <t-content class="doc-content">
      <div
        ref="workspaceRef"
        :class="['doc-workspace', { 'is-side-panel-resizing': isResizingRightSidebar }]"
        :style="{ '--doc-side-panel-width': `${rightSidebarWidth}px` }"
      >
        <WorkspaceCanvasShell
          :editor-view="view"
          :annotation-store="annotationStore"
          :locale="localeKey"
          :high-contrast="debugFlags.highContrast"
          :workspace-loading="workspaceLoading"
          :workspace-error="workspaceError"
          :document-status-loading-label="documentStatusLoadingLabel"
          :document-status-loading-copy="documentStatusLoadingCopy"
          :document-status-error-label="documentStatusErrorLabel"
          :active-side-tab="activeSideTab"
          :annotation-active="annotationStore.state.active"
          :outline-label="outlineTabLabel"
          :comments-label="commentButtonLabel"
          :collaboration-label="collaborationButtonLabel"
          :assistant-label="assistantButtonLabel"
          :changes-label="trackChangesButtonLabel"
          :annotation-label="annotationActionLabel"
          :on-editor-host-change="handleEditorHostChange"
          @select-floating-action="handleFloatingActionClick"
        />
        <WorkspaceRightPanel
          :active-tab="activeSideTab"
          :width="rightSidebarWidth"
          :resizing="isResizingRightSidebar"
          :high-contrast="debugFlags.highContrast"
          :locale="localeKey"
          :editor="editor"
          :annotation-store="annotationStore"
          :toc-items="tocItems"
          :active-toc-id="activeTocId"
          :outline-title="outlineTitle"
          :outline-empty-label="outlineEmptyLabel"
          :comment-action-label="commentActionLabel"
          :comment-button-disabled="commentButtonDisabled"
          :comment-threads="commentThreads"
          :active-comment-thread-id="activeCommentThreadId"
          :can-mutate-comments="canMutateComments"
          :current-comment-user-name="currentCommentUserName"
          :collaboration-state="collaborationState"
          :backend-session-user="backendSessionUser"
          :backend-document="backendDocument"
          :backend-document-access="backendDocumentAccess"
          :effective-permission-mode="effectivePermissionMode"
          :backend-access-bound="backendAccessBound"
          :backend-access-error="backendAccessError"
          :collaboration-token="debugFlags.collaborationToken"
          :collaboration-switching="collaborationSwitching"
          :can-manage-assistant="canManageAssistant"
          :track-changes-enabled="trackChangesEnabled"
          :track-changes-action-label="trackChangesActionLabel"
          :track-changes-status-label="trackChangesStatusLabel"
          :track-change-records="trackChangeRecords"
          :active-track-change-id="activeTrackChangeId"
          :can-mutate-track-changes="canMutateTrackChanges"
          :on-resize-start="handleRightSidebarResizeStart"
          :on-toc-item-click="handleTocItemClick"
          :on-comment-click="handleCommentClick"
          :on-close-comments-panel="closeCommentsPanel"
          :on-comment-thread-select="handleCommentThreadSelect"
          :on-comment-thread-resolved="handleCommentThreadResolved"
          :on-comment-thread-reply="handleCommentThreadReply"
          :on-comment-message-edit="handleCommentMessageEdit"
          :on-comment-message-delete="handleCommentMessageDelete"
          :on-comment-thread-delete="handleCommentThreadDelete"
          :on-collaboration-apply="handleCollaborationApply"
          :on-close-assistant-panel="closeAssistantPanel"
          :on-track-changes-toggle="handleTrackChangesToggle"
          :on-close-track-changes-panel="closeTrackChangesPanel"
          :on-track-change-select="handleTrackChangeSelect"
          :on-track-change-accept="handleTrackChangeAccept"
          :on-track-change-reject="handleTrackChangeReject"
          :on-track-changes-accept-all="handleTrackChangesAcceptAll"
          :on-track-changes-reject-all="handleTrackChangesRejectAll"
        />
      </div>
    </t-content>
    <WorkspaceFooter
      :footer-stat-items="footerStatItems"
      :collaboration-enabled="realtimeCollaborationEnabled"
      :collaboration-state="collaborationState"
      :locale="localeKey"
      :high-contrast="debugFlags.highContrast"
    />
    <ShareWorkspaceDialog
      v-model:visible="shareDialogVisible"
      :locale="localeKey"
      :workspace-enabled="workspaceAccessEnabled"
      :collaboration-state="collaborationState"
      :document="backendDocument"
      :document-access="backendDocumentAccess"
      @request-auth="handleShareAuthRequest"
    />
    <AccountWorkspaceDialog
      v-model:visible="accountDialogVisible"
      :locale="localeKey"
      :collaboration-state="collaborationState"
      :initial-mode="accountDialogMode"
      @session-change="handleAccountSessionChange"
    />
  </t-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import AccountWorkspaceDialog from "./components/AccountWorkspaceDialog.vue";
import EditorMenuBar from "./components/EditorMenuBar.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import ShareWorkspaceDialog from "./components/ShareWorkspaceDialog.vue";
import WorkspaceCanvasShell from "./components/workspace/WorkspaceCanvasShell.vue";
import WorkspaceFooter from "./components/workspace/WorkspaceFooter.vue";
import WorkspaceRightPanel from "./components/workspace/WorkspaceRightPanel.vue";
import WorkspaceTopbar from "./components/workspace/WorkspaceTopbar.vue";
import { createLumenAnnotationStore } from "./annotation/annotationStore";
import { useAnnotationSession } from "./composables/useAnnotationSession";
import { useWorkspaceSidePanel } from "./composables/useWorkspaceSidePanel";
import { useWorkspaceAccess } from "./composables/useWorkspaceAccess";
import { useWorkspaceCapabilities } from "./composables/useWorkspaceCapabilities";
import { useWorkspaceEditorRuntime } from "./composables/useWorkspaceEditorRuntime";
import { useWorkspaceReview } from "./composables/useWorkspaceReview";
import { useWorkspaceShellUi } from "./composables/useWorkspaceShellUi";
import { useWorkspaceSnapshotPersistence } from "./composables/useWorkspaceSnapshotPersistence";
import { resolveStoredShareAccessToken } from "./editor/backendClient";
import {
  createInitialLumenCollaborationState,
  type LumenCollaborationState,
} from "./editor/collaboration";
import { createPlaygroundDebugFlags, type PlaygroundDebugFlags } from "./editor/config";
import {
  coercePlaygroundLocale,
  createPlaygroundI18n,
  type PlaygroundLocale,
} from "./editor/i18n";
import { showToolbarMessage } from "./editor/toolbarActions/ui/message";
import type { ToolbarMenuKey } from "./editor/toolbarCatalog";

const debugFlags = reactive(createPlaygroundDebugFlags()) as PlaygroundDebugFlags;
const { locale: globalLocale, t } = useI18n();
const route = useRoute();
globalLocale.value = debugFlags.locale;
const localeKey = computed<PlaygroundLocale>(() => coercePlaygroundLocale(globalLocale.value));
const i18n = computed(() => createPlaygroundI18n(localeKey.value));
const routeDocumentId = computed(() => {
  const raw = route.params.documentId;
  return typeof raw === "string" ? raw.trim() : "";
});
const routeShareToken = computed(() =>
  routeDocumentId.value ? resolveStoredShareAccessToken(routeDocumentId.value) : ""
);
const realtimeCollaborationEnabled = computed(() => debugFlags.collaborationEnabled);
const workspaceAccessEnabled = computed(
  () => routeDocumentId.value.length > 0 || realtimeCollaborationEnabled.value
);
const editorHost = ref<HTMLElement | null>(null);
const workspaceRef = ref<HTMLElement | null>(null);
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
const toolbarRef = ref<ToolbarExpose | null>(null);
const activeToolbarMenu = ref<ToolbarMenuKey>("base");
const annotationStore = createLumenAnnotationStore();
const collaborationState = ref<LumenCollaborationState>(
  createInitialLumenCollaborationState(debugFlags)
);
const {
  backendUrl,
  shareDialogVisible,
  accountDialogVisible,
  accountDialogMode,
  accountPopupVisible,
  backendSessionUser,
  backendDocument,
  backendDocumentAccess,
  backendAccessError,
  backendAccessBound,
  workspaceLoading,
  workspaceError,
  handleAccountSessionChange,
  openShareDialog,
  openAccountDialog,
  handleShareAuthRequest,
  loadWorkspace,
  resetWorkspaceAccessState,
} = useWorkspaceAccess({
  debugFlags,
  locale: localeKey,
  workspaceAccessEnabled,
  realtimeCollaborationEnabled,
  routeDocumentId,
  routeShareToken,
  flushPendingSnapshotSave: () => flushWorkspaceSnapshotSave(),
  messages: {
    shareDialogLoadFailed: computed(() => i18n.value.shareDialog.loadFailed),
    shareDialogEnsureFailed: computed(() => i18n.value.shareDialog.ensureFailed),
    shareLandingLoadFailed: computed(() => i18n.value.shareLanding.loadFailed),
  },
  applyRuntime: (runtimeFlags: PlaygroundDebugFlags, snapshotBase64?: string | null) =>
    mountOrRemountPlaygroundEditor(runtimeFlags, snapshotBase64 ?? null),
  clearRuntime: () => {
    clearMountedEditorRuntime();
  },
});
const {
  sessionMode,
  collaborationSwitching,
  effectiveCapabilities,
  effectivePermissionMode,
  canWriteLocalSnapshot,
  permissionLabel,
  canMutateComments,
  currentCommentUserName,
  canManageAssistant,
  canMutateTrackChanges,
  topbarAvatarText,
  trackChangesCountLabel,
  handleCollaborationApply,
  handleSessionModeUpdate,
} = useWorkspaceCapabilities({
  debugFlags,
  i18n,
  translate: (key, params) => String(t(key, params)),
  routeDocumentId,
  workspaceAccessEnabled,
  realtimeCollaborationEnabled,
  backendSessionUser,
  backendDocumentAccess,
  backendAccessBound,
  collaborationState,
  flushPendingSnapshotSave: () => flushWorkspaceSnapshotSave(),
  loadWorkspace,
});
const {
  flushWorkspaceSnapshotSave,
  scheduleWorkspaceSnapshotSave,
  setSnapshotDocument,
  resetWorkspaceSnapshotPersistence,
} = useWorkspaceSnapshotPersistence({
  backendUrl,
  routeDocumentId,
  routeShareToken,
  realtimeCollaborationEnabled,
  backendDocumentId: computed(() => String(backendDocument.value?.id || "").trim()),
  canWriteSnapshot: canWriteLocalSnapshot,
  saveFailedMessage: computed(() => i18n.value.shareDialog.ensureFailed),
  onSaveError: (message) => {
    showToolbarMessage(message, "error");
  },
});
const commentButtonDisabled = computed(() => !canMutateComments.value);
const commentActionTexts = computed(() => i18n.value.commentActions);
const trackChangeActionTexts = computed(() => i18n.value.trackChangeActions);

const { restoreAnnotationSession, syncAnnotationAuthor } = useAnnotationSession({
  annotationStore,
  currentCommentUserName,
  realtimeCollaborationEnabled,
  collaborationUserColor: computed(() => collaborationState.value.userColor || null),
  routeDocumentId,
  backendDocumentField: computed(() => backendDocument.value?.field || null),
  fallbackDocumentName: debugFlags.collaborationDocument,
  fallbackField: debugFlags.collaborationField,
});

const {
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
} = useWorkspaceReview({
  getView: () => view.value,
  realtimeCollaborationEnabled,
  collaborationState,
  currentCommentUserName,
  canMutateComments,
  canMutateTrackChanges,
  commentActionTexts,
  trackChangeActionTexts,
  getActiveSideTab: () => activeSideTab.value,
  openCommentsPanel: (preferredThreadId) => openCommentsPanel(preferredThreadId),
  openTrackChangesPanel: (preferredChangeId) => openTrackChangesPanel(preferredChangeId),
  setCommentAnchor: (options) => setCommentAnchor(options),
  activateCommentThread: (threadId) => activateCommentThread(threadId),
  focusCommentThread: (threadId) => focusCommentThread(threadId),
  removeCommentThread: (threadId) => removeCommentThread(threadId),
  setTrackChangesEnabled: (enabled) => setTrackChangesEnabled(enabled),
  activateTrackChange: (changeId) => activateTrackChange(changeId),
  focusTrackChange: (changeId) => focusTrackChange(changeId),
  acceptTrackChange: (changeId) => acceptTrackChange(changeId),
  rejectTrackChange: (changeId) => rejectTrackChange(changeId),
  acceptAllTrackChanges: () => acceptAllTrackChanges(),
  rejectAllTrackChanges: () => rejectAllTrackChanges(),
});
const {
  localeOptions,
  tocItems,
  activeTocId,
  outlineTitle,
  commentButtonLabel,
  assistantButtonLabel,
  outlineEmptyLabel,
  commentActionLabel,
  trackChangesActionLabel,
  trackChangesStatusLabel,
  outlineTabLabel,
  collaborationButtonLabel,
  annotationActionLabel,
  documentStatusLoadingLabel,
  documentStatusLoadingCopy,
  documentStatusErrorLabel,
  trackChangesButtonLabel,
  footerStatItems,
  handleLocaleChange,
  handleTocOutlineChange,
  handleStatsChange,
  handleTocItemClick,
  resetWorkspaceShellUiState,
} = useWorkspaceShellUi({
  localeKey,
  globalLocale,
  i18n,
  translate: (key, params) => String(t(key, params)),
  getView: () => view.value,
  commentCount,
  trackChangeCount,
  trackChangesEnabled,
  trackChangesCountLabel,
});

const handleEditorHostChange = (value: HTMLElement | null) => {
  editorHost.value = value;
};

const {
  activeSideTab,
  rightSidebarWidth,
  isResizingRightSidebar,
  toggleTocPanel,
  closeCommentsPanel,
  closeAssistantPanel,
  closeTrackChangesPanel,
  openTrackChangesPanel,
  openCommentsPanel,
  handleFloatingActionClick,
  handleRightSidebarResizeStart,
  resetWorkspaceSidePanelState,
} = useWorkspaceSidePanel({
  annotationStore,
  workspaceRef,
  commentThreads,
  activeCommentThreadId,
  trackChangeRecords,
  activeTrackChangeId,
  clearActiveCommentThread,
  clearActiveTrackChange,
  setTocOutlineEnabled: (enabled) => {
    setTocOutlineEnabled(enabled);
  },
  activateCommentThread: (threadId) => {
    activateCommentThread(threadId);
  },
  activateTrackChange: (changeId) => {
    activateTrackChange(changeId);
  },
});
const {
  editor,
  view,
  clearMountedEditorRuntime,
  mountOrRemountPlaygroundEditor,
  setTocOutlineEnabled,
  setCommentAnchor,
  activateCommentThread,
  focusCommentThread,
  removeCommentThread,
  setTrackChangesEnabled,
  activateTrackChange,
  focusTrackChange,
  acceptTrackChange,
  rejectTrackChange,
  acceptAllTrackChanges,
  rejectAllTrackChanges,
} = useWorkspaceEditorRuntime({
  editorHost,
  getStatusElement: () => toolbarRef.value?.statusEl?.value || null,
  effectivePermissionMode,
  sessionMode,
  annotationStore,
  restoreAnnotationSession,
  syncAnnotationAuthor,
  setSnapshotDocument,
  resetWorkspaceSnapshotPersistence,
  resetRuntimeState: () => {
    resetReviewState();
    resetWorkspaceShellUiState();
  },
  syncCommentThreads,
  setCollaborationState: (state) => {
    collaborationState.value = state;
  },
  isTocOutlineEnabled: () => activeSideTab.value === "outline",
  onCollaborationStateChange: (state) => {
    collaborationState.value = state;
    if (!state.enabled || state.synced) {
      syncCommentThreads();
    }
  },
  onTocOutlineChange: handleTocOutlineChange,
  onCommentStateChange: handleCommentRuntimeStateChange,
  onTrackChangeStateChange: handleTrackChangeRuntimeStateChange,
  onDocumentChange: ({ docChanged }) => {
    if (docChanged) {
      scheduleWorkspaceSnapshotSave();
    }
  },
  onStatsChange: handleStatsChange,
});

onBeforeUnmount(() => {
  void flushWorkspaceSnapshotSave();
  resetWorkspaceSidePanelState();
  clearMountedEditorRuntime();
  annotationStore.useLocalStore({ clear: true });
  resetWorkspaceAccessState();
  collaborationState.value = createInitialLumenCollaborationState(debugFlags);
});
</script>

<style scoped>
.doc-shell {
  height: 100vh;
  width: 100%;
  background: #f5f6f8;
  color: #1f2329;
  display: flex;
  flex-direction: column;
}

.doc-content {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  padding: 0;
  overflow: hidden;
  background: #f5f6f8;
}

.doc-workspace {
  position: relative;
  display: flex;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  background: transparent;
}

:deep(.menu-bar) {
  background: #ffffff;
  border-bottom: 1px solid #eceff1;
}

:deep(.menu-trigger) {
  color: #202124;
}

:deep(.toolbar) {
  background: #ffffff;
  border-bottom: 1px solid #eceff1;
}

:deep(.toolbar .icon-btn:hover) {
  background: #e8f0fe !important;
}

.doc-shell.is-high-contrast {
  background: #000;
  color: #fff;
}

.doc-shell.is-high-contrast :deep(.menu-bar),
.doc-shell.is-high-contrast :deep(.toolbar) {
  background: #000;
  border-color: #fff;
}

.doc-shell.is-high-contrast :deep(.menu-trigger) {
  color: #fff;
}
</style>
