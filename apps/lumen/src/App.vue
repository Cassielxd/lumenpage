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
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import type { Editor as LumenEditor } from "lumenpage-core";
import { NodeSelection, Selection, TextSelection } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";
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
import { useWorkspaceSnapshotPersistence } from "./composables/useWorkspaceSnapshotPersistence";
import { resolveStoredShareAccessToken } from "./editor/backendClient";
import {
  createInitialLumenCollaborationState,
  type LumenCollaborationState,
} from "./editor/collaboration";
import {
  createPlaygroundDebugFlags,
  setPlaygroundCollaborationSettings,
  type PlaygroundCollaborationSettings,
  type PlaygroundDebugFlags,
} from "./editor/config";
import {
  PLAYGROUND_LOCALE_OPTIONS,
  coercePlaygroundLocale,
  createPlaygroundI18n,
  setPlaygroundLocale,
  type PlaygroundLocale,
} from "./editor/i18n";
import { lumenCommentsStore, type LumenCommentThread } from "./editor/commentsStore";
import { mountPlaygroundEditor } from "./editor/editorMount";
import { showToolbarMessage } from "./editor/toolbarActions/ui/message";
import {
  findHeadingPosById,
  type TocOutlineItem,
  type TocOutlineSnapshot,
} from "./editor/tocOutlinePlugin";
import type { ToolbarMenuKey } from "./editor/toolbarCatalog";
import type { EditorSessionMode } from "./editor/sessionMode";
import { findCommentAnchorRanges } from "lumenpage-extension-comment";
import type { TrackChangeRecord } from "lumenpage-extension-track-change";

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
const localeOptions = computed(() =>
  PLAYGROUND_LOCALE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label[localeKey.value],
  }))
);
const editorHost = ref<HTMLElement | null>(null);
const workspaceRef = ref<HTMLElement | null>(null);
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
type PendingRuntimeContext = {
  flags: PlaygroundDebugFlags;
  snapshotBase64: string | null;
};
const toolbarRef = ref<ToolbarExpose | null>(null);
const activeToolbarMenu = ref<ToolbarMenuKey>("base");
const editor = shallowRef<LumenEditor | null>(null);
const view = shallowRef<CanvasEditorView | null>(null);
const annotationStore = createLumenAnnotationStore();
const collaborationState = ref<LumenCollaborationState>(
  createInitialLumenCollaborationState(debugFlags)
);
const collaborationSwitching = ref(false);
const pendingRuntime = ref<PendingRuntimeContext | null>(null);
const commentThreads = ref<LumenCommentThread[]>(lumenCommentsStore.listThreads());
const activeCommentThreadId = ref<string | null>(null);
const trackChangesEnabled = ref(false);
const trackChangeRecords = ref<TrackChangeRecord[]>([]);
const activeTrackChangeId = ref<string | null>(null);
const createInitialFooterStats = () => ({
  pageCount: 0,
  currentPage: 0,
  nodeCount: 0,
  pluginCount: 0,
  wordCount: 0,
  selectedWordCount: 0,
  blockType: "",
});
const footerStats = ref(createInitialFooterStats());
const tocItems = ref<TocOutlineItem[]>([]);
const activeTocId = ref<string | null>(null);
const outlineTitle = computed(() => i18n.value.shell.outline);
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
const sessionMode = ref<EditorSessionMode>(
  debugFlags.permissionMode === "readonly" ? "viewer" : "edit"
);
const buildPermissionCapabilities = (permissionMode: "full" | "comment" | "readonly") => ({
  canView: true,
  canComment: permissionMode === "full" || permissionMode === "comment",
  canEdit: permissionMode === "full",
  canManage: permissionMode === "full",
  permissionMode,
});
const effectiveCapabilities = computed(() => {
  if (backendDocumentAccess.value?.capabilities) {
    return backendDocumentAccess.value.capabilities;
  }
  if (routeDocumentId.value.length > 0 && !realtimeCollaborationEnabled.value) {
    return buildPermissionCapabilities("readonly");
  }
  if (workspaceAccessEnabled.value && (backendAccessBound.value || backendSessionUser.value)) {
    return buildPermissionCapabilities("readonly");
  }
  return buildPermissionCapabilities(debugFlags.permissionMode);
});
const effectivePermissionMode = computed(() => effectiveCapabilities.value.permissionMode);
const canWriteLocalSnapshot = computed(
  () => effectiveCapabilities.value.canEdit || effectiveCapabilities.value.canComment
);
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
const isReadonlyPermission = computed(() => effectivePermissionMode.value === "readonly");
const permissionLabel = computed(() => {
  if (isReadonlyPermission.value || sessionMode.value === "viewer") {
    return i18n.value.app.permissionReadonly;
  }
  if (effectivePermissionMode.value === "comment") {
    return i18n.value.app.permissionComment;
  }
  return i18n.value.app.permissionEdit;
});
const commentCount = computed(() => commentThreads.value.length);
const canMutateComments = computed(() => effectiveCapabilities.value.canComment && sessionMode.value !== "viewer");
const currentCommentUserName = computed(
  () =>
    String(backendSessionUser.value?.displayName || "").trim() ||
    (realtimeCollaborationEnabled.value ? collaborationState.value.userName : "") ||
    i18n.value.shell.you
);
const canManageAssistant = computed(() => effectiveCapabilities.value.canEdit && sessionMode.value !== "viewer");
const canMutateTrackChanges = computed(
  () => effectiveCapabilities.value.canEdit && sessionMode.value !== "viewer"
);
const commentButtonDisabled = computed(() => !canMutateComments.value);
const commentButtonLabel = computed(() =>
  commentCount.value > 0
    ? `${i18n.value.app.comment} (${commentCount.value})`
    : i18n.value.app.comment
);
const assistantButtonLabel = computed(() => i18n.value.shell.assistant);
const trackChangeCount = computed(() => trackChangeRecords.value.length);
const outlineEmptyLabel = computed(() => i18n.value.shell.outlineEmpty);
const commentActionLabel = computed(() => i18n.value.shell.addComment);
const trackChangesActionLabel = computed(() =>
  trackChangesEnabled.value
    ? i18n.value.shell.trackChangesDisable
    : i18n.value.shell.trackChangesEnable
);
const trackChangesStatusLabel = computed(() =>
  trackChangesEnabled.value
    ? i18n.value.shell.trackChangesEnabled
    : i18n.value.shell.trackChangesDisabled
);
const outlineTabLabel = computed(() => i18n.value.shell.outline);
const collaborationButtonLabel = computed(() => i18n.value.collaborationPanel.title);
const annotationActionLabel = computed(() => i18n.value.annotationPanel.title);
const documentStatusLoadingLabel = computed(() => i18n.value.documentCenter.loading);
const documentStatusLoadingCopy = computed(() => i18n.value.documentCenter.description);
const documentStatusErrorLabel = computed(() => i18n.value.shareLanding.loadFailed);
const trackChangesButtonLabel = computed(() =>
  trackChangeCount.value > 0
    ? t("shell.trackChangesCount", { count: trackChangeCount.value })
    : i18n.value.shell.trackChanges
);
const footerPageLabel = computed(() => t("shell.totalPages", { count: footerStats.value.pageCount }));
const footerCurrentPageLabel = computed(() =>
  t("shell.currentPage", { count: footerStats.value.currentPage || 0 })
);
const footerWordLabel = computed(() => t("shell.words", { count: footerStats.value.wordCount }));
const footerSelectionWordLabel = computed(() =>
  t("shell.selectedWords", { count: footerStats.value.selectedWordCount })
);
const resolveBlockTypeLabel = (value: string) => {
  if (value === "paragraph") return i18n.value.shell.blockTypeParagraph;
  if (value === "heading") return i18n.value.shell.blockTypeHeading;
  if (value === "blockquote") return i18n.value.shell.blockTypeBlockquote;
  if (value === "codeBlock") return i18n.value.shell.blockTypeCodeBlock;
  if (value === "bulletList") return i18n.value.shell.blockTypeBulletList;
  if (value === "orderedList") return i18n.value.shell.blockTypeOrderedList;
  if (value === "taskList") return i18n.value.shell.blockTypeTaskList;
  if (value === "table") return i18n.value.shell.blockTypeTable;
  return value || i18n.value.shell.blockTypeUnknown;
};
const footerBlockTypeLabel = computed(() =>
  t("shell.block", { type: resolveBlockTypeLabel(footerStats.value.blockType) })
);
const footerStatItems = computed(() => {
  const items = [footerCurrentPageLabel.value, footerPageLabel.value, footerWordLabel.value];
  if (footerStats.value.selectedWordCount > 0) {
    items.push(footerSelectionWordLabel.value);
  }
  if (footerStats.value.blockType) {
    items.push(footerBlockTypeLabel.value);
  }
  return items;
});
const footerNodeLabel = computed(() => t("shell.nodes", { count: footerStats.value.nodeCount }));
const footerPluginLabel = computed(() => t("shell.plugins", { count: footerStats.value.pluginCount }));
const footerContactLabel = computed(() => i18n.value.shell.contact);
const commentActionTexts = computed(() => i18n.value.commentActions);
const trackChangeActionTexts = computed(() => i18n.value.trackChangeActions);
const topbarAvatarText = computed(() => {
  const seed =
    String(backendSessionUser.value?.displayName || "").trim() ||
    (realtimeCollaborationEnabled.value
      ? String(collaborationState.value.userName || "").trim()
      : "") ||
    i18n.value.shell.you;
  return seed.slice(0, 1).toUpperCase() || "U";
});
let detachEditor: null | (() => void) = null;
let setTocOutlineEnabled: null | ((enabled: boolean) => void) = null;
let detachCommentStore: null | (() => void) = null;
let setCommentAnchorInEditor: null | ((options: { threadId: string; anchorId: string }) => boolean) = null;
let activateCommentThreadInEditor: null | ((threadId: string | null) => boolean) = null;
let focusCommentThreadInEditor: null | ((threadId: string) => boolean) = null;
let removeCommentThreadInEditor: null | ((threadId: string) => boolean) = null;
let isPruningCommentThreads = false;
let setTrackChangesEnabledInEditor: null | ((enabled: boolean) => boolean) = null;
let activateTrackChangeInEditor: null | ((changeId: string | null) => boolean) = null;
let focusTrackChangeInEditor: null | ((changeId: string) => boolean) = null;
let acceptTrackChangeInEditor: null | ((changeId: string) => boolean) = null;
let rejectTrackChangeInEditor: null | ((changeId: string) => boolean) = null;
let acceptAllTrackChangesInEditor: null | (() => boolean) = null;
let rejectAllTrackChangesInEditor: null | (() => boolean) = null;

type LumenSelectionSnapshot = {
  from: number;
  to: number;
  empty: boolean;
  type: string | null;
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

const clearMountedEditorRuntime = () => {
  resetWorkspaceSnapshotPersistence();
  detachEditor?.();
  detachEditor = null;
  setTocOutlineEnabled = null;
  detachCommentStore?.();
  detachCommentStore = null;
  setCommentAnchorInEditor = null;
  activateCommentThreadInEditor = null;
  focusCommentThreadInEditor = null;
  removeCommentThreadInEditor = null;
  setTrackChangesEnabledInEditor = null;
  activateTrackChangeInEditor = null;
  focusTrackChangeInEditor = null;
  acceptTrackChangeInEditor = null;
  rejectTrackChangeInEditor = null;
  acceptAllTrackChangesInEditor = null;
  rejectAllTrackChangesInEditor = null;
  editor.value = null;
  view.value = null;
  syncDebugHandles();
  commentThreads.value = [];
  activeCommentThreadId.value = null;
  trackChangesEnabled.value = false;
  trackChangeRecords.value = [];
  activeTrackChangeId.value = null;
  tocItems.value = [];
  activeTocId.value = null;
  footerStats.value = createInitialFooterStats();
};

const attachMountedEditor = (
  mounted: ReturnType<typeof mountPlaygroundEditor>,
  runtimeFlags: typeof debugFlags,
) => {
  editor.value = mounted.editor;
  view.value = mounted.view;
  setSnapshotDocument(mounted.collaborationDocument);
  if (runtimeFlags.collaborationEnabled) {
    annotationStore.useCollaborationStore(mounted.collaborationDocument, runtimeFlags.collaborationField);
  } else {
    annotationStore.useLocalStore();
  }
  syncDebugHandles();
  setTocOutlineEnabled = mounted.setTocOutlineEnabled;
  setCommentAnchorInEditor = mounted.setCommentAnchor;
  activateCommentThreadInEditor = mounted.activateCommentThread;
  focusCommentThreadInEditor = mounted.focusCommentThread;
  removeCommentThreadInEditor = mounted.removeCommentThread;
  setTrackChangesEnabledInEditor = mounted.setTrackChangesEnabled;
  activateTrackChangeInEditor = mounted.activateTrackChange;
  focusTrackChangeInEditor = mounted.focusTrackChange;
  acceptTrackChangeInEditor = mounted.acceptTrackChange;
  rejectTrackChangeInEditor = mounted.rejectTrackChange;
  acceptAllTrackChangesInEditor = mounted.acceptAllTrackChanges;
  rejectAllTrackChangesInEditor = mounted.rejectAllTrackChanges;
  detachCommentStore = lumenCommentsStore.subscribe(syncCommentThreads) || null;
  syncCommentThreads();
  applySessionModeToView();
  detachEditor = mounted.destroy;
};

const createEditorCallbacks = () => ({
  onCollaborationStateChange: (state: LumenCollaborationState) => {
    collaborationState.value = state;
    if (!state.enabled || state.synced) {
      syncCommentThreads();
    }
  },
  onTocOutlineChange: handleTocOutlineChange,
  tocOutlineEnabled: activeSideTab.value === "outline",
  onCommentStateChange: ({ activeThreadId }: { activeThreadId: string | null }) => {
    const nextThreadId = activeThreadId || null;
    const previousThreadId = activeCommentThreadId.value;
    activeCommentThreadId.value = nextThreadId;
    syncCommentThreads();
    const resolvedThreadId = activeCommentThreadId.value;
    if (resolvedThreadId && (activeSideTab.value !== "comments" || resolvedThreadId !== previousThreadId)) {
      openCommentsPanel(resolvedThreadId);
      return;
    }
  },
  onTrackChangeStateChange: ({
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
    if (activeSideTab.value === "changes" && changes.length > 0) {
      const fallbackChangeId = getNextTrackChangeId();
      if (fallbackChangeId) {
        activeTrackChangeId.value = fallbackChangeId;
        activateTrackChangeInEditor?.(fallbackChangeId);
      }
    }
  },
  onDocumentChange: ({ docChanged }: { docChanged: boolean }) => {
    if (docChanged) {
      scheduleWorkspaceSnapshotSave();
    }
  },
  onStatsChange: handleStatsChange,
});

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

const mountOrRemountPlaygroundEditor = async (
  runtimeFlags: typeof debugFlags,
  snapshotBase64: string | null = null,
) => {
  pendingRuntime.value = {
    flags: runtimeFlags,
    snapshotBase64,
  };
  collaborationState.value = createInitialLumenCollaborationState(runtimeFlags);
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
    statusElement: toolbarRef.value?.statusEl?.value || null,
    flags: runtimeFlags,
    initialCollaborationSnapshot: decodeSnapshotBase64(snapshotBase64),
    resolvePermissionMode: () => effectivePermissionMode.value,
    ...createEditorCallbacks(),
  });
  attachMountedEditor(mounted, runtimeFlags);
  pendingRuntime.value = null;
  return true;
};

const handleCollaborationApply = async (settings: {
  enabled: boolean;
  collaborationUrl: string;
  collaborationDocument: string;
  collaborationField: string;
  collaborationToken: string;
  collaborationUserName: string;
  collaborationUserColor: string;
}) => {
  if (collaborationSwitching.value) {
    return;
  }
  collaborationSwitching.value = true;
  await flushWorkspaceSnapshotSave();
  const nextSettings = setPlaygroundCollaborationSettings({
    collaborationEnabled: settings.enabled,
    collaborationUrl: settings.collaborationUrl,
    collaborationDocument: settings.collaborationDocument,
    collaborationField: settings.collaborationField,
    collaborationToken: settings.collaborationToken,
    collaborationUserName: settings.collaborationUserName,
    collaborationUserColor: settings.collaborationUserColor,
  } satisfies PlaygroundCollaborationSettings);
  Object.assign(debugFlags, nextSettings);
  try {
    await loadWorkspace({ withCollabTicket: true });
  } finally {
    collaborationSwitching.value = false;
  }
};

const remountPlaygroundEditor = async (runtimeFlags: typeof debugFlags) => {
  await mountOrRemountPlaygroundEditor(runtimeFlags);
};

const applySessionModeToView = () => {
  const currentView = view.value;
  if (!currentView) {
    return;
  }
  currentView.setProps({
    editable: () => !isReadonlyPermission.value && sessionMode.value !== "viewer",
  });
};

const handleSessionModeUpdate = (nextMode: EditorSessionMode) => {
  if (effectivePermissionMode.value === "readonly" && nextMode !== "viewer") {
    return;
  }
  sessionMode.value = nextMode;
};

const handleLocaleChange = (value: string | number) => {
  const nextLocale = coercePlaygroundLocale(value);
  if (nextLocale === localeKey.value) {
    return;
  }
  globalLocale.value = nextLocale;
  setPlaygroundLocale(nextLocale);
};

const clearActiveCommentThread = () => {
  const hadActiveThread = !!activeCommentThreadId.value;
  activeCommentThreadId.value = null;
  if (hadActiveThread) {
    activateCommentThreadInEditor?.(null);
  }
};

const clearActiveTrackChange = () => {
  const hadActiveChange = !!activeTrackChangeId.value;
  activeTrackChangeId.value = null;
  if (hadActiveChange) {
    activateTrackChangeInEditor?.(null);
  }
};

const getNextTrackChangeId = (excludeChangeId?: string | null) =>
  trackChangeRecords.value.find((change) => change.changeId !== excludeChangeId)?.changeId || null;

const handleTocOutlineChange = (snapshot: TocOutlineSnapshot) => {
  tocItems.value = Array.isArray(snapshot?.items) ? snapshot.items : [];
  activeTocId.value = snapshot?.activeId || null;
};

const handleStatsChange = (stats: {
  pageCount: number;
  currentPage: number;
  nodeCount: number;
  pluginCount: number;
  wordCount: number;
  selectedWordCount: number;
  blockType: string;
}) => {
  footerStats.value = {
    pageCount: Math.max(0, Number(stats?.pageCount) || 0),
    currentPage: Math.max(0, Number(stats?.currentPage) || 0),
    nodeCount: Math.max(0, Number(stats?.nodeCount) || 0),
    pluginCount: Math.max(0, Number(stats?.pluginCount) || 0),
    wordCount: Math.max(0, Number(stats?.wordCount) || 0),
    selectedWordCount: Math.max(0, Number(stats?.selectedWordCount) || 0),
    blockType: String(stats?.blockType || ""),
  };
};

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
    setTocOutlineEnabled?.(enabled);
  },
  activateCommentThread: (threadId) => {
    activateCommentThreadInEditor?.(threadId);
  },
  activateTrackChange: (changeId) => {
    activateTrackChangeInEditor?.(changeId);
  },
});
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

const createCommentEntityId = (prefix: string) => {
  const randomUuid =
    typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : null;
  if (randomUuid) {
    return `${prefix}-${randomUuid}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

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

  const exactMatch =
    ranges.find((range) => range.from === from && range.to === to) ||
    ranges.find((range) => from >= range.from && to <= range.to);

  return exactMatch || null;
};

const pruneOrphanCommentThreads = () => {
  if (isPruningCommentThreads) {
    return false;
  }
  const currentView = view.value;
  if (!currentView?.state) {
    return false;
  }
  if (realtimeCollaborationEnabled.value && !collaborationState.value.synced) {
    return false;
  }

  const anchorThreadIds = new Set(
    findCommentAnchorRanges(currentView.state)
      .map((range) => range.threadId)
      .filter((threadId): threadId is string => !!threadId)
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
    if (activeSideTab.value === "comments" && threads.length > 0) {
      openCommentsPanel(threads[0]?.id || null);
    }
  }
};

const handleCommentClick = () => {
  const texts = commentActionTexts.value;
  const currentView = view.value;
  const selection = currentView?.state?.selection;
  const hasSelection = !!currentView && selection instanceof TextSelection && selection.empty !== true;

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
      focusCommentThreadInEditor?.(existingAnchor.threadId);
      return;
    }

    const threadId = createCommentEntityId("thread");
    const anchorId = createCommentEntityId("anchor");
    const applied = setCommentAnchorInEditor?.({ threadId, anchorId }) === true;
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
    activateCommentThreadInEditor?.(threadId);
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
  const focused = focusCommentThreadInEditor?.(threadId) === true;
  if (!focused) {
    const activated = activateCommentThreadInEditor?.(threadId) === true;
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
  removeCommentThreadInEditor?.(threadId);
  lumenCommentsStore.removeThread(threadId);
  if (activeCommentThreadId.value === threadId) {
    activeCommentThreadId.value = nextThreadId;
    activateCommentThreadInEditor?.(nextThreadId);
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
  const applied = setTrackChangesEnabledInEditor?.(nextEnabled) === true;
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
  const focused = focusTrackChangeInEditor?.(changeId) === true;
  if (!focused) {
    const activated = activateTrackChangeInEditor?.(changeId) === true;
    if (!activated) {
      showToolbarMessage(texts.focusFailed, "warning");
    }
  }
};

const handleTrackChangeAccept = (changeId: string) => {
  const texts = trackChangeActionTexts.value;
  if (acceptTrackChangeInEditor?.(changeId) !== true) {
    showToolbarMessage(texts.acceptFailed, "warning");
    return;
  }
  showToolbarMessage(texts.accepted, "success");
};

const handleTrackChangeReject = (changeId: string) => {
  const texts = trackChangeActionTexts.value;
  if (rejectTrackChangeInEditor?.(changeId) !== true) {
    showToolbarMessage(texts.rejectFailed, "warning");
    return;
  }
  showToolbarMessage(texts.rejected, "success");
};

const handleTrackChangesAcceptAll = () => {
  const texts = trackChangeActionTexts.value;
  if (acceptAllTrackChangesInEditor?.() !== true) {
    showToolbarMessage(texts.acceptAllFailed, "warning");
    return;
  }
  showToolbarMessage(texts.acceptedAll, "success");
};

const handleTrackChangesRejectAll = () => {
  const texts = trackChangeActionTexts.value;
  if (rejectAllTrackChangesInEditor?.() !== true) {
    showToolbarMessage(texts.rejectAllFailed, "warning");
    return;
  }
  showToolbarMessage(texts.rejectedAll, "success");
};

const handleTocItemClick = (item: TocOutlineItem) => {
  const currentView = view.value;
  if (!currentView?.state?.doc || !currentView?.state?.tr || !item?.id) {
    return;
  }
  const pos = findHeadingPosById(currentView.state.doc, item.id);
  if (!Number.isFinite(pos)) {
    return;
  }
  try {
    const tr = currentView.state.tr.setSelection(TextSelection.create(currentView.state.doc, Number(pos)));
    currentView.dispatch(tr.scrollIntoView());
    // Keep current focus state to avoid caret jumping to document tail after TOC jump.
  } catch (_error) {
    // noop
  }
};

onMounted(async () => {
  await loadWorkspace({ withCollabTicket: true });
});

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
  { immediate: true }
);

watch(
  () => sessionMode.value,
  () => {
    applySessionModeToView();
  }
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
  }
);

watch(
  () => routeDocumentId.value,
  (nextDocumentId, previousDocumentId) => {
    if (!nextDocumentId || nextDocumentId === previousDocumentId) {
      return;
    }
    void (async () => {
      await flushWorkspaceSnapshotSave();
      await loadWorkspace({ withCollabTicket: true });
    })();
  }
);

onBeforeUnmount(() => {
  void flushWorkspaceSnapshotSave();
  resetWorkspaceSidePanelState();
  clearMountedEditorRuntime();
  annotationStore.useLocalStore({ clear: true });
  resetWorkspaceAccessState();
  collaborationState.value = createInitialLumenCollaborationState(debugFlags);
  footerStats.value = createInitialFooterStats();
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
