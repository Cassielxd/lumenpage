<template>
  <t-layout :class="['doc-shell', { 'is-high-contrast': debugFlags.highContrast }]">
    <WorkspaceTopbar
      :collaboration-enabled="realtimeCollaborationEnabled"
      :collaboration-document-name="collaborationState.documentName"
      :permission-label="permissionLabel"
      :locale-key="localeKey"
      :locale-options="localeOptions"
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
        <t-content class="doc-main">
          <WorkspaceStage
            v-if="!workspaceError"
            :editor-view="view"
            :editor-host="editorHost"
            :annotation-store="annotationStore"
            :locale="localeKey"
          >
            <template #editor-host>
              <div ref="editorHost" class="editor-host"></div>
            </template>
          </WorkspaceStage>
          <div v-if="workspaceLoading || workspaceError" class="doc-workspace-status">
            <div class="doc-workspace-status-card">
              <span class="doc-workspace-status-title">
                {{ workspaceLoading ? documentStatusLoadingLabel : documentStatusErrorLabel }}
              </span>
              <p class="doc-workspace-status-copy">
                {{ workspaceLoading ? documentStatusLoadingCopy : workspaceError }}
              </p>
            </div>
          </div>
          <template v-if="!workspaceLoading && !workspaceError">
            <WorkspaceFloatingActions
              :active-side-tab="activeSideTab"
              :annotation-active="annotationStore.state.active"
              :outline-label="outlineTabLabel"
              :comments-label="commentButtonLabel"
              :collaboration-label="collaborationButtonLabel"
              :assistant-label="assistantButtonLabel"
              :changes-label="trackChangesButtonLabel"
              :annotation-label="annotationActionLabel"
              @select="handleFloatingActionClick"
            />
          </template>
        </t-content>
        <WorkspaceSidePanel
          :active-tab="activeSideTab"
          :width="rightSidebarWidth"
          @resize-start="handleRightSidebarResizeStart"
        >
          <template #outline>
            <div class="doc-side-tab-panel doc-side-tab-panel-outline">
              <div class="doc-side-tab-header">
                <div class="doc-side-tab-heading">
                  <span class="doc-side-tab-title">{{ outlineTitle }}</span>
                  <span class="doc-side-tab-summary">{{ tocItems.length }}</span>
                </div>
              </div>
              <div v-if="tocItems.length === 0" class="doc-side-tab-empty">
                {{ outlineEmptyLabel }}
              </div>
              <div v-else class="doc-outline-list">
                <button
                  v-for="item in tocItems"
                  :key="item.id"
                  type="button"
                  class="doc-outline-item"
                  :class="{ 'is-active': item.id === activeTocId }"
                  :style="{ '--toc-level': String(item.level) }"
                  @click="handleTocItemClick(item)"
                >
                  <span class="doc-outline-item-text">{{ item.text }}</span>
                </button>
              </div>
            </div>
          </template>

          <template #comments>
            <div class="doc-side-tab-panel">
              <div class="doc-side-tab-actions">
                <t-button
                  size="small"
                  variant="outline"
                  :disabled="commentButtonDisabled"
                  @mousedown.prevent
                  @click="handleCommentClick"
                >
                  {{ commentActionLabel }}
                </t-button>
              </div>
              <CommentsPanel
                :locale="localeKey"
                :threads="commentThreads"
                :active-thread-id="activeCommentThreadId"
                :can-manage="canMutateComments"
                :current-user-name="currentCommentUserName"
                @close="closeCommentsPanel"
                @select="handleCommentThreadSelect"
                @toggle-resolved="handleCommentThreadResolved"
                @reply="handleCommentThreadReply"
                @edit-message="handleCommentMessageEdit"
                @delete-message="handleCommentMessageDelete"
                @delete="handleCommentThreadDelete"
              />
            </div>
          </template>

          <template #collaboration>
            <div class="doc-side-tab-panel">
              <CollaborationPanel
                :locale="localeKey"
                :state="collaborationState"
                :backend-user="backendSessionUser"
                :document="backendDocument"
                :access="backendDocumentAccess"
                :effective-permission-mode="effectivePermissionMode"
                :backend-managed="backendAccessBound"
                :access-error="backendAccessError"
                :collaboration-token="debugFlags.collaborationToken"
                :busy="collaborationSwitching"
                @apply="handleCollaborationApply"
              />
            </div>
          </template>

          <template #assistant>
            <div class="doc-side-tab-panel">
              <AiAssistantPanel
                :locale="localeKey"
                :editor="editor"
                :can-manage="canManageAssistant"
                @close="closeAssistantPanel"
              />
            </div>
          </template>

          <template #changes>
            <div class="doc-side-tab-panel">
              <div class="doc-side-tab-actions">
                <t-button
                  size="small"
                  variant="outline"
                  :theme="trackChangesEnabled ? 'success' : 'default'"
                  :disabled="!canMutateTrackChanges"
                  @mousedown.prevent
                  @click="handleTrackChangesToggle"
                >
                  {{ trackChangesActionLabel }}
                </t-button>
                <t-tag
                  size="small"
                  variant="light"
                  :theme="trackChangesEnabled ? 'success' : 'default'"
                >
                  {{ trackChangesStatusLabel }}
                </t-tag>
              </div>
              <TrackChangesPanel
                :locale="localeKey"
                :changes="trackChangeRecords"
                :active-change-id="activeTrackChangeId"
                :enabled="trackChangesEnabled"
                :can-manage="canMutateTrackChanges"
                @close="closeTrackChangesPanel"
                @select="handleTrackChangeSelect"
                @accept="handleTrackChangeAccept"
                @reject="handleTrackChangeReject"
                @accept-all="handleTrackChangesAcceptAll"
                @reject-all="handleTrackChangesRejectAll"
              />
            </div>
          </template>

          <template #annotation>
            <div class="doc-side-tab-panel">
              <AnnotationToolbar :locale="localeKey" :store="annotationStore" />
            </div>
          </template>
        </WorkspaceSidePanel>
      </div>
    </t-content>
    <t-footer class="doc-footer">
      <div v-if="false" class="doc-footer-stats">
        <template v-for="(item, index) in footerStatItems" :key="`${index}-${item}`">
          <span v-if="index > 0" class="doc-footer-divider">|</span>
          <span class="doc-footer-stat">{{ item }}</span>
        </template>
        <span>{{ footerNodeLabel }}</span>
        <span>{{ footerPluginLabel }}</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-divider">·</span>
      </div>
      <div class="doc-footer-stats">
        <template v-for="(item, index) in footerStatItems" :key="`footer-${index}-${item}`">
          <span v-if="index > 0" class="doc-footer-divider">|</span>
          <span class="doc-footer-stat">{{ item }}</span>
        </template>
      </div>
      <div v-if="false" class="doc-footer-right">
        <CollaborationPresence
          v-if="realtimeCollaborationEnabled"
          :state="collaborationState"
          :locale="localeKey"
          compact
        />
        <div class="doc-footer-contact">
          <span class="doc-footer-contact-label">{{ footerContactLabel }}</span>
          <a class="doc-footer-contact-link" href="mailto:348040933@qq.com">348040933@qq.com</a>
        </div>
      </div>
      <div class="doc-footer-right">
        <CollaborationPresence
          v-if="realtimeCollaborationEnabled"
          :state="collaborationState"
          :locale="localeKey"
          compact
        />
        <a
          class="doc-footer-link"
          href="https://github.com/Cassielxd/lumenpage"
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub
        </a>
        <a class="doc-footer-link" href="mailto:348040933@qq.com">348040933@qq.com</a>
      </div>
    </t-footer>
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
import AiAssistantPanel from "./components/AiAssistantPanel.vue";
import AnnotationToolbar from "./components/AnnotationToolbar.vue";
import AccountWorkspaceDialog from "./components/AccountWorkspaceDialog.vue";
import CommentsPanel from "./components/CommentsPanel.vue";
import CollaborationPanel from "./components/CollaborationPanel.vue";
import CollaborationPresence from "./components/CollaborationPresence.vue";
import EditorMenuBar from "./components/EditorMenuBar.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import ShareWorkspaceDialog from "./components/ShareWorkspaceDialog.vue";
import TrackChangesPanel from "./components/TrackChangesPanel.vue";
import WorkspaceFloatingActions from "./components/workspace/WorkspaceFloatingActions.vue";
import WorkspaceSidePanel from "./components/workspace/WorkspaceSidePanel.vue";
import WorkspaceStage from "./components/workspace/WorkspaceStage.vue";
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
  footerNodeLabel,
  footerPluginLabel,
  footerContactLabel,
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

const {
  activeSideTab,
  rightSidebarWidth,
  isResizingRightSidebar,
  toggleTocPanel,
  closeCommentsPanel,
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

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 52px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #dfe1e5;
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-right {
  justify-content: flex-end;
}

.brand {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  flex-shrink: 0;
}

.brand-logo {
  width: 164px;
  height: 48px;
  display: block;
  overflow: visible;
}

.brand-logo-mark {
  filter: drop-shadow(0 10px 20px rgba(148, 184, 255, 0.16));
}

.brand-logo-frame {
  fill: url(#lumenBrandFrame);
  stroke: rgba(99, 136, 213, 0.28);
  stroke-width: 1;
}

.brand-logo-panel {
  fill: url(#lumenBrandPanel);
}

.brand-logo-glow {
  fill: url(#lumenBrandGlow);
}

.brand-logo-spine {
  fill: rgba(79, 143, 247, 0.16);
}

.brand-logo-page {
  fill: url(#lumenBrandSurface);
}

.brand-logo-fold {
  fill: url(#lumenBrandFold);
}

.brand-logo-rule {
  fill: none;
  stroke: rgba(37, 99, 235, 0.64);
  stroke-linecap: round;
  stroke-width: 1.7;
}

.brand-logo-wordmark {
  fill: #1846a3;
  font-size: 15.5px;
  font-weight: 800;
  letter-spacing: 0.01em;
  font-family:
    "Segoe UI",
    "PingFang SC",
    "Microsoft YaHei UI",
    sans-serif;
}

.topbar-locale {
  width: 132px;
}

.topbar-avatar-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.topbar-account-menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 220px;
  padding: 4px;
}

.topbar-account-menu-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.topbar-account-menu-name {
  font-size: 13px;
  line-height: 1.4;
  font-weight: 700;
  color: #0f172a;
}

.topbar-account-menu-email {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
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

.doc-main {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: transparent;
}

.doc-workspace-status {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  pointer-events: none;
}

.doc-workspace-status-card {
  max-width: 420px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(14px);
}

.doc-workspace-status-title {
  display: block;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
}

.doc-workspace-status-copy {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #475569;
}

.doc-side-tabs {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--doc-side-panel-width, 360px);
  min-width: 0;
  padding: 12px 12px 12px 0;
  background: transparent;
  z-index: 8;
}

.doc-floating-actions {
  position: absolute;
  top: 50%;
  right: 18px;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  z-index: 9;
  pointer-events: auto;
}

.doc-floating-actions.has-side-panel {
  right: calc(var(--doc-side-panel-width, 360px) + 14px);
}

.doc-floating-action {
  min-width: 86px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.94);
  color: #334155;
  border-radius: 999px;
  padding: 10px 14px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(14px);
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}

.doc-floating-action:hover {
  transform: translateX(-2px);
  border-color: rgba(37, 99, 235, 0.28);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.16);
}

.doc-floating-action.is-active {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.34);
  color: #1d4ed8;
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.18);
}

.doc-floating-action-label {
  display: block;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.doc-side-panel-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
}

.doc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 32px;
  padding: 0 16px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
}

.doc-footer-stats {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  line-height: 1;
  color: #6b7280;
}

.doc-footer-stat {
  white-space: nowrap;
}

.doc-footer-divider {
  color: #c0c4cc;
}

.doc-footer-right {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
}

.doc-footer-contact {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  line-height: 1;
  color: #6b7280;
  white-space: nowrap;
}

.doc-footer-contact-link {
  color: #2563eb;
  text-decoration: none;
}

.doc-footer-link {
  color: #2563eb;
  font-size: 12px;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}

.doc-footer-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.doc-footer-contact-link:hover {
  text-decoration: underline;
}

.doc-side-tab-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: #ffffff;
}

.doc-side-tab-panel-outline {
  padding: 14px 12px 12px;
}

.doc-side-tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 10px;
}

.doc-side-tab-heading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.doc-side-tab-title {
  color: #111827;
}

.doc-side-tab-summary {
  color: #64748b;
  font-weight: 600;
}

.doc-side-tab-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 0;
  flex-wrap: wrap;
}

.doc-side-tab-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
  padding: 24px 12px;
}

.doc-outline-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.doc-outline-item {
  width: 100%;
  border: 0;
  background: transparent;
  color: #1f2937;
  text-align: left;
  display: block;
  padding: 6px 8px;
  padding-left: calc(8px + (var(--toc-level, 1) - 1) * 14px);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.35;
}

.doc-outline-item:hover {
  background: #eff6ff;
}

.doc-outline-item.is-active {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

.doc-outline-item-text {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.doc-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: hidden;
}

.doc-ruler-shell {
  display: flex;
  align-items: stretch;
  flex: 0 0 28px;
  min-height: 28px;
}

.doc-ruler-corner {
  position: relative;
  flex: 0 0 28px;
  width: 28px;
  border-right: 1px solid rgba(203, 213, 225, 0.8);
  border-bottom: 1px solid rgba(203, 213, 225, 0.8);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
}

.doc-ruler-corner::after {
  content: "";
  position: absolute;
  left: 7px;
  top: 7px;
  width: 10px;
  height: 10px;
  border-left: 1px solid rgba(100, 116, 139, 0.42);
  border-top: 1px solid rgba(100, 116, 139, 0.42);
}

.doc-stage-body {
  position: relative;
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
}

.doc-side-panel-resize-handle {
  position: absolute;
  top: 0;
  left: -6px;
  bottom: 0;
  width: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  z-index: 2;
}

.doc-side-panel-resize-handle::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 44px;
  border-radius: 999px;
  transform: translate(-50%, -50%);
  background: rgba(148, 163, 184, 0.55);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.doc-side-tabs:hover .doc-side-panel-resize-handle::after,
.doc-workspace.is-side-panel-resizing .doc-side-panel-resize-handle::after {
  opacity: 1;
}

.doc-side-tab-panel :deep(.doc-comments),
.doc-side-tab-panel :deep(.doc-annotation-toolbar),
.doc-side-tab-panel :deep(.doc-collaboration-panel),
.doc-side-tab-panel :deep(.doc-ai-assistant),
.doc-side-tab-panel :deep(.doc-track-changes) {
  flex: 1;
  min-height: 0;
}

.editor-host {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
}

.editor-host :deep(.lumenpage-editor) {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0 auto;
}

.editor-host :deep(.lumenpage-viewport) {
  width: 100%;
  height: 100%;
}

.editor-host :deep(.lumenpage-scroll-area) {
  background:
    radial-gradient(
        circle at 24px 24px,
        rgba(148, 163, 184, 0.06) 0,
        rgba(148, 163, 184, 0.06) 2px,
        transparent 2px
      )
      0 0 / 36px 36px,
    linear-gradient(180deg, #f7f8fb 0%, #eef1f6 100%);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.editor-host :deep(.lumenpage-scroll-area::-webkit-scrollbar) {
  width: 0;
  height: 0;
  display: none;
}

.editor-host :deep(.page-canvas) {
  border-radius: 6px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.08),
    0 10px 24px rgba(15, 23, 42, 0.12);
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

.doc-shell.is-high-contrast .topbar,
.doc-shell.is-high-contrast .doc-footer,
.doc-shell.is-high-contrast .doc-stage,
.doc-shell.is-high-contrast .doc-side-panel-card,
.doc-shell.is-high-contrast :deep(.menu-bar),
.doc-shell.is-high-contrast :deep(.toolbar) {
  background: #000;
  border-color: #fff;
}

.doc-shell.is-high-contrast .brand-logo-mark {
  filter: none;
}

.doc-shell.is-high-contrast .brand-logo-frame {
  fill: #fff;
}

.doc-shell.is-high-contrast .brand-logo-panel,
.doc-shell.is-high-contrast .brand-logo-spine {
  fill: rgba(0, 0, 0, 0.12);
}

.doc-shell.is-high-contrast .brand-logo-page {
  fill: #000;
}

.doc-shell.is-high-contrast .brand-logo-fold {
  fill: rgba(0, 0, 0, 0.28);
}

.doc-shell.is-high-contrast .brand-logo-rule {
  stroke: rgba(0, 0, 0, 0.76);
}

.doc-shell.is-high-contrast .brand-logo-wordmark {
  fill: #000;
}

.doc-shell.is-high-contrast .topbar-account-menu-name {
  color: #ffffff;
}

.doc-shell.is-high-contrast .topbar-account-menu-email {
  color: rgba(255, 255, 255, 0.72);
}

.doc-shell.is-high-contrast .doc-ruler-corner {
  background: #000;
  border-color: rgba(255, 255, 255, 0.36);
}

.doc-shell.is-high-contrast .doc-ruler-corner::after {
  border-color: rgba(255, 255, 255, 0.52);
}

.doc-shell.is-high-contrast .doc-footer-stats,
.doc-shell.is-high-contrast .doc-footer-divider,
.doc-shell.is-high-contrast .doc-footer-contact,
.doc-shell.is-high-contrast .doc-footer-contact-link {
  color: #fff;
}

.doc-shell.is-high-contrast .doc-footer-link {
  color: #fff;
}

.doc-shell.is-high-contrast .doc-floating-action {
  background: rgba(0, 0, 0, 0.92);
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
}

.doc-shell.is-high-contrast .doc-floating-action.is-active {
  background: #fff;
  color: #000;
  border-color: #fff;
}

.doc-shell.is-high-contrast .doc-side-tab-panel,
.doc-shell.is-high-contrast .doc-side-tab-title,
.doc-shell.is-high-contrast .doc-outline-item {
  color: #fff;
}

.doc-shell.is-high-contrast .doc-outline-item:hover,
.doc-shell.is-high-contrast .doc-outline-item.is-active {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.doc-shell.is-high-contrast .editor-host :deep(.lumenpage-scroll-area) {
  background: #000;
}

.doc-shell.is-high-contrast .editor-host :deep(.page-canvas) {
  border-color: #fff;
  box-shadow: none;
}

@media (max-width: 1024px) {
  .doc-side-tabs {
    width: min(320px, var(--doc-side-panel-width));
    flex-basis: min(320px, var(--doc-side-panel-width));
  }
}

@media (max-width: 768px) {
  .topbar {
    padding: 0 10px;
  }

  .doc-content {
    padding: 0;
  }

  .doc-footer {
    padding: 0 10px;
  }

  .doc-footer-contact-label {
    display: none;
  }

  .doc-footer-right {
    gap: 8px;
  }

  .doc-ruler-shell {
    display: none;
  }

  .doc-floating-actions {
    right: 12px;
    gap: 8px;
  }

  .doc-floating-action {
    min-width: 72px;
    padding: 8px 12px;
  }

  .brand-logo {
    width: 144px;
    height: 42px;
  }

  .doc-side-tabs {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(320px, calc(100vw - 72px));
    flex-basis: auto;
    padding: 12px;
  }

  .doc-side-panel-resize-handle {
    display: none;
  }
}
</style>
