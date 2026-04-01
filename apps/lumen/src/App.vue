<template>
  <t-layout :class="['doc-shell', { 'is-high-contrast': debugFlags.highContrast }]">
    <t-header class="topbar">
      <div class="topbar-left">
        <div class="logo">L</div>
        <input
          v-model="docTitle"
          class="title-input title-input-native"
          type="text"
          :placeholder="i18n.app.defaultDocTitle"
        />
        <t-tag size="small" variant="light">{{ permissionLabel }}</t-tag>
        <t-tag
          v-if="debugFlags.collaborationEnabled"
          size="small"
          theme="primary"
          variant="light"
        >
          {{ collaborationState.documentName }}
        </t-tag>
      </div>
      <div class="topbar-right">
        <t-button size="small" theme="primary">{{ i18n.app.share }}</t-button>
        <t-avatar v-if="!debugFlags.collaborationEnabled" size="small">U</t-avatar>
      </div>
    </t-header>

    <EditorMenuBar v-model:active-menu="activeToolbarMenu" :locale="debugFlags.locale" />
    <EditorToolbar
      ref="toolbarRef"
      :editor="editor"
      :editorView="view"
      :locale="debugFlags.locale"
      :active-menu="activeToolbarMenu"
      :session-mode="sessionMode"
      @update:session-mode="handleSessionModeUpdate"
      @toggle-toc="toggleTocPanel"
    />

    <t-content class="doc-content">
      <div
        ref="workspaceRef"
        :class="['doc-workspace', { 'is-side-panel-resizing': isResizingRightSidebar }]"
      >
        <t-content class="doc-main">
          <div class="doc-stage">
            <div ref="editorHost" class="editor-host"></div>
          </div>
        </t-content>
        <t-aside class="doc-side-tabs" :style="{ '--doc-side-panel-width': `${rightSidebarWidth}px` }">
          <button
            type="button"
            class="doc-side-panel-resize-handle"
            aria-label="Resize panel"
            @pointerdown="handleRightSidebarResizeStart"
          ></button>
          <t-tabs
            class="doc-side-tabs-control"
            placement="left"
            theme="card"
            size="medium"
            :value="activeSideTab"
            @change="handleSideTabChange"
          >
            <t-tab-panel value="outline" :label="outlineTabLabel">
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
            </t-tab-panel>

            <t-tab-panel value="comments" :label="commentButtonLabel">
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
                  :locale="debugFlags.locale"
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
            </t-tab-panel>

            <t-tab-panel value="assistant" :label="assistantButtonLabel">
              <div class="doc-side-tab-panel">
                <AiAssistantPanel
                  :locale="debugFlags.locale"
                  :editor="editor"
                  :can-manage="canManageAssistant"
                  @close="closeAssistantPanel"
                />
              </div>
            </t-tab-panel>

            <t-tab-panel value="changes" :label="trackChangesButtonLabel">
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
                  :locale="debugFlags.locale"
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
            </t-tab-panel>
          </t-tabs>
        </t-aside>
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
          v-if="debugFlags.collaborationEnabled"
          :state="collaborationState"
          :locale="debugFlags.locale"
          compact
        />
        <div class="doc-footer-contact">
          <span class="doc-footer-contact-label">{{ footerContactLabel }}</span>
          <a class="doc-footer-contact-link" href="mailto:348040933@qq.com">348040933@qq.com</a>
        </div>
      </div>
      <div class="doc-footer-right">
        <CollaborationPresence
          v-if="debugFlags.collaborationEnabled"
          :state="collaborationState"
          :locale="debugFlags.locale"
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
  </t-layout>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import type { Editor as LumenEditor } from "lumenpage-core";
import { Selection, TextSelection } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import AiAssistantPanel from "./components/AiAssistantPanel.vue";
import CommentsPanel from "./components/CommentsPanel.vue";
import CollaborationPresence from "./components/CollaborationPresence.vue";
import EditorMenuBar from "./components/EditorMenuBar.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import TrackChangesPanel from "./components/TrackChangesPanel.vue";
import {
  createInitialLumenCollaborationState,
  type LumenCollaborationState,
} from "./editor/collaboration";
import { createPlaygroundDebugFlags } from "./editor/config";
import { createPlaygroundI18n } from "./editor/i18n";
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

const debugFlags = createPlaygroundDebugFlags();
const i18n = createPlaygroundI18n(debugFlags.locale);
const docTitle = ref(
  debugFlags.collaborationEnabled ? debugFlags.collaborationDocument : i18n.app.defaultDocTitle
);
const editorHost = ref<HTMLElement | null>(null);
const workspaceRef = ref<HTMLElement | null>(null);
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
const toolbarRef = ref<ToolbarExpose | null>(null);
const activeToolbarMenu = ref<ToolbarMenuKey>("base");
const editor = shallowRef<LumenEditor | null>(null);
const view = shallowRef<CanvasEditorView | null>(null);
const collaborationState = ref<LumenCollaborationState>(
  createInitialLumenCollaborationState(debugFlags)
);
const commentThreads = ref<LumenCommentThread[]>(lumenCommentsStore.listThreads());
const commentsPanelOpen = ref(false);
const activeCommentThreadId = ref<string | null>(null);
const assistantPanelOpen = ref(false);
const trackChangesEnabled = ref(false);
const trackChangeRecords = ref<TrackChangeRecord[]>([]);
const activeTrackChangeId = ref<string | null>(null);
const trackChangesPanelManualOpen = ref(false);
const rightSidebarWidth = ref(360);
const isResizingRightSidebar = ref(false);
const footerStats = ref({
  pageCount: 0,
  currentPage: 0,
  nodeCount: 0,
  pluginCount: 0,
  wordCount: 0,
  selectedWordCount: 0,
  blockType: "",
});
const tocItems = ref<TocOutlineItem[]>([]);
const activeTocId = ref<string | null>(null);
const tocPanelOpen = ref(false);
const outlineTitle = computed(() => (debugFlags.locale === "en-US" ? "Outline" : "目录"));
const tocToggleLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? tocPanelOpen.value
      ? "Hide Outline"
      : "Show Outline"
    : tocPanelOpen.value
      ? "隐藏目录"
      : "显示目录"
);
const sessionMode = ref<EditorSessionMode>(
  debugFlags.permissionMode === "readonly" ? "viewer" : "edit"
);
const isReadonlyPermission = computed(() => debugFlags.permissionMode === "readonly");
const permissionLabel = computed(() => {
  if (isReadonlyPermission.value || sessionMode.value === "viewer") {
    return i18n.app.permissionReadonly;
  }
  if (debugFlags.permissionMode === "comment") {
    return i18n.app.permissionComment;
  }
  return i18n.app.permissionEdit;
});
const commentCount = computed(() => commentThreads.value.length);
const canMutateComments = computed(
  () => !isReadonlyPermission.value && sessionMode.value !== "viewer"
);
const currentCommentUserName = computed(
  () => (debugFlags.collaborationEnabled ? collaborationState.value.userName : "") || "You"
);
const canManageAssistant = computed(
  () => !isReadonlyPermission.value && sessionMode.value !== "viewer"
);
const canMutateTrackChanges = computed(
  () => !isReadonlyPermission.value && sessionMode.value !== "viewer"
);
const commentButtonDisabled = computed(() => !canMutateComments.value);
const commentButtonLabel = computed(() =>
  commentCount.value > 0 ? `${i18n.app.comment} (${commentCount.value})` : i18n.app.comment
);
const assistantButtonLabel = computed(() => (debugFlags.locale === "en-US" ? "AI" : "AI 助手"));
const trackChangeCount = computed(() => trackChangeRecords.value.length);
const trackChangesPanelOpen = computed(
  () => trackChangesPanelManualOpen.value || !!activeTrackChangeId.value
);
const activeSideTab = ref<SideTabKey>("assistant");
const outlineEmptyLabel = computed(() =>
  debugFlags.locale === "en-US" ? "No headings yet." : "暂无目录项"
);
const commentActionLabel = computed(() =>
  debugFlags.locale === "en-US" ? "Add Comment" : "添加评论"
);
const trackChangesActionLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? trackChangesEnabled.value
      ? "Disable Tracking"
      : "Enable Tracking"
    : trackChangesEnabled.value
      ? "关闭修订"
      : "开启修订"
);
const trackChangesStatusLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? trackChangesEnabled.value
      ? "On"
      : "Off"
    : trackChangesEnabled.value
      ? "已开启"
      : "未开启"
);
const outlineTabLabel = computed(() => (debugFlags.locale === "en-US" ? "Outline" : "目录"));
const trackChangesButtonDisabled = computed(
  () => !trackChangesEnabled.value && trackChangeCount.value === 0
);
const trackChangesToggleLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? trackChangesEnabled.value
      ? "Tracking On"
      : "Track Changes"
    : trackChangesEnabled.value
      ? "修订中"
      : "开启修订"
);
const trackChangesButtonLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? trackChangeCount.value > 0
      ? `Changes (${trackChangeCount.value})`
      : "Changes"
    : trackChangeCount.value > 0
      ? `修订 (${trackChangeCount.value})`
      : "修订"
);
const footerPageLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? `Pages ${footerStats.value.pageCount}`
    : `页数 ${footerStats.value.pageCount}`
);
const footerCurrentPageLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? `Page ${footerStats.value.currentPage || 0}`
    : `当前页 ${footerStats.value.currentPage || 0}`
);
const footerWordLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? `Words ${footerStats.value.wordCount}`
    : `字数 ${footerStats.value.wordCount}`
);
const footerSelectionWordLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? `Selected ${footerStats.value.selectedWordCount}`
    : `选中 ${footerStats.value.selectedWordCount}`
);
const resolveBlockTypeLabel = (value: string) => {
  if (debugFlags.locale === "en-US") {
    if (value === "paragraph") return "Paragraph";
    if (value === "heading") return "Heading";
    if (value === "blockquote") return "Blockquote";
    if (value === "codeBlock") return "Code Block";
    if (value === "bulletList") return "Bullet List";
    if (value === "orderedList") return "Ordered List";
    if (value === "taskList") return "Task List";
    if (value === "table") return "Table";
    return value || "Unknown";
  }
  if (value === "paragraph") return "正文";
  if (value === "heading") return "标题";
  if (value === "blockquote") return "引用";
  if (value === "codeBlock") return "代码块";
  if (value === "bulletList") return "无序列表";
  if (value === "orderedList") return "有序列表";
  if (value === "taskList") return "任务列表";
  if (value === "table") return "表格";
  return value || "未知";
};
const footerBlockTypeLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? `Block ${resolveBlockTypeLabel(footerStats.value.blockType)}`
    : `块 ${resolveBlockTypeLabel(footerStats.value.blockType)}`
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
const footerNodeLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? `Nodes ${footerStats.value.nodeCount}`
    : `节点数 ${footerStats.value.nodeCount}`
);
const footerPluginLabel = computed(() =>
  debugFlags.locale === "en-US"
    ? `Plugins ${footerStats.value.pluginCount}`
    : `插件数 ${footerStats.value.pluginCount}`
);
const footerContactLabel = computed(() =>
  debugFlags.locale === "en-US" ? "Contact" : "联系方式"
);
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

type SideTabKey = "outline" | "comments" | "assistant" | "changes";

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
  if (isReadonlyPermission.value && nextMode !== "viewer") {
    return;
  }
  sessionMode.value = nextMode;
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

const setTocPanelEnabled = (enabled: boolean) => {
  if (enabled) {
    clearActiveCommentThread();
    clearActiveTrackChange();
    activeSideTab.value = "outline";
    tocPanelOpen.value = true;
    commentsPanelOpen.value = false;
    assistantPanelOpen.value = false;
    trackChangesPanelManualOpen.value = false;
    setTocOutlineEnabled?.(true);
    return;
  }

  tocPanelOpen.value = false;
  setTocOutlineEnabled?.(false);
  if (activeSideTab.value === "outline") {
    activeSideTab.value = "assistant";
    assistantPanelOpen.value = true;
  }
};

const toggleTocPanel = () => {
  setTocPanelEnabled(!tocPanelOpen.value);
};

const closeCommentsPanel = () => {
  commentsPanelOpen.value = false;
  clearActiveCommentThread();
  if (activeSideTab.value === "comments") {
    openAssistantPanel();
  }
};

const closeAssistantPanel = () => {
  assistantPanelOpen.value = false;
  if (activeSideTab.value === "assistant") {
    setTocPanelEnabled(true);
  }
};

const getNextTrackChangeId = (excludeChangeId?: string | null) =>
  trackChangeRecords.value.find((change) => change.changeId !== excludeChangeId)?.changeId || null;

const closeTrackChangesPanel = () => {
  trackChangesPanelManualOpen.value = false;
  clearActiveTrackChange();
  if (activeSideTab.value === "changes") {
    setTocPanelEnabled(true);
  }
};

const openTrackChangesPanel = (preferredChangeId?: string | null) => {
  clearActiveCommentThread();
  trackChangesPanelManualOpen.value = true;
  commentsPanelOpen.value = false;
  assistantPanelOpen.value = false;
  tocPanelOpen.value = false;
  setTocOutlineEnabled?.(false);
  activeSideTab.value = "changes";
  const nextChangeId =
    preferredChangeId || activeTrackChangeId.value || trackChangeRecords.value[0]?.changeId || null;
  if (nextChangeId && nextChangeId !== activeTrackChangeId.value) {
    activeTrackChangeId.value = nextChangeId;
    activateTrackChangeInEditor?.(nextChangeId);
  }
};

const getNextCommentThreadId = (excludeThreadId?: string | null) =>
  commentThreads.value.find((thread) => thread.id !== excludeThreadId)?.id || null;

const openCommentsPanel = (preferredThreadId?: string | null) => {
  clearActiveTrackChange();
  trackChangesPanelManualOpen.value = false;
  assistantPanelOpen.value = false;
  tocPanelOpen.value = false;
  setTocOutlineEnabled?.(false);
  activeSideTab.value = "comments";
  commentsPanelOpen.value = true;
  const nextThreadId = preferredThreadId || activeCommentThreadId.value || getNextCommentThreadId();
  if (nextThreadId && nextThreadId !== activeCommentThreadId.value) {
    activeCommentThreadId.value = nextThreadId;
    activateCommentThreadInEditor?.(nextThreadId);
  }
};

const normalizeSideTabValue = (value: string | number): SideTabKey => {
  if (value === "outline" || value === "comments" || value === "assistant" || value === "changes") {
    return value;
  }
  return "assistant";
};

const handleSideTabChange = (value: string | number) => {
  const nextTab = normalizeSideTabValue(value);
  if (nextTab === activeSideTab.value) {
    return;
  }
  if (nextTab === "outline") {
    setTocPanelEnabled(true);
    return;
  }
  if (nextTab === "comments") {
    openCommentsPanel(activeCommentThreadId.value);
    return;
  }
  if (nextTab === "changes") {
    openTrackChangesPanel(activeTrackChangeId.value);
    return;
  }
  openAssistantPanel();
};

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

const RIGHT_SIDEBAR_MIN_WIDTH = 280;
const RIGHT_SIDEBAR_MAX_WIDTH = 460;

const clampRightSidebarWidth = (value: number) =>
  Math.min(RIGHT_SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, Math.round(value)));

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

const openAssistantPanel = () => {
  clearActiveCommentThread();
  clearActiveTrackChange();
  trackChangesPanelManualOpen.value = false;
  commentsPanelOpen.value = false;
  tocPanelOpen.value = false;
  setTocOutlineEnabled?.(false);
  activeSideTab.value = "assistant";
  assistantPanelOpen.value = true;
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

const createCommentActionTexts = (locale: "zh-CN" | "en-US") =>
  locale === "en-US"
    ? {
        disabled: "Comments are unavailable in viewer mode.",
        requiresSelection: "Select text first to create a comment.",
        failed: "Failed to create comment anchor.",
        created: "Comment anchor created.",
        replyFailed: "Failed to add comment reply.",
        editFailed: "Failed to update comment message.",
        edited: "Comment message updated.",
        deleteMessageFailed: "Failed to delete comment message.",
        messageRemoved: "Comment message removed.",
        missingAnchor: "Comment anchor no longer exists in the document.",
        removed: "Comment thread removed.",
      }
    : {
        disabled: "\u67e5\u770b\u6a21\u5f0f\u4e0b\u65e0\u6cd5\u8bc4\u8bba\u3002",
        requiresSelection: "\u8bf7\u5148\u9009\u4e2d\u6587\u672c\u518d\u521b\u5efa\u8bc4\u8bba\u3002",
        failed: "\u521b\u5efa\u8bc4\u8bba\u951a\u70b9\u5931\u8d25\u3002",
        created: "\u5df2\u521b\u5efa\u8bc4\u8bba\u951a\u70b9\u3002",
        replyFailed: "\u6dfb\u52a0\u8bc4\u8bba\u56de\u590d\u5931\u8d25\u3002",
        editFailed: "\u66f4\u65b0\u8bc4\u8bba\u6d88\u606f\u5931\u8d25\u3002",
        edited: "\u5df2\u66f4\u65b0\u8bc4\u8bba\u6d88\u606f\u3002",
        deleteMessageFailed: "\u5220\u9664\u8bc4\u8bba\u6d88\u606f\u5931\u8d25\u3002",
        messageRemoved: "\u5df2\u5220\u9664\u8bc4\u8bba\u6d88\u606f\u3002",
        missingAnchor: "\u8bc4\u8bba\u951a\u70b9\u5df2\u4e0d\u5b58\u5728\u4e8e\u6587\u6863\u4e2d\u3002",
        removed: "\u5df2\u5220\u9664\u8bc4\u8bba\u7ebf\u7a0b\u3002",
      };

const createTrackChangeActionTexts = (locale: "zh-CN" | "en-US") =>
  locale === "en-US"
    ? {
        disabled: "Track changes is unavailable in viewer mode.",
        enableFailed: "Failed to update track changes mode.",
        enabled: "Track changes enabled.",
        disabledDone: "Track changes disabled.",
        focusFailed: "Tracked change range no longer exists.",
        acceptFailed: "Failed to accept tracked change.",
        rejectFailed: "Failed to reject tracked change.",
        accepted: "Tracked change accepted.",
        rejected: "Tracked change rejected.",
        acceptAllFailed: "Failed to accept all tracked changes.",
        rejectAllFailed: "Failed to reject all tracked changes.",
        acceptedAll: "All tracked changes accepted.",
        rejectedAll: "All tracked changes rejected.",
      }
    : {
        disabled: "查看模式下无法开启修订。",
        enableFailed: "修订模式切换失败。",
        enabled: "已开启修订模式。",
        disabledDone: "已关闭修订模式。",
        focusFailed: "对应修订已不存在。",
        acceptFailed: "接受修订失败。",
        rejectFailed: "拒绝修订失败。",
        accepted: "已接受修订。",
        rejected: "已拒绝修订。",
        acceptAllFailed: "全部接受失败。",
        rejectAllFailed: "全部拒绝失败。",
        acceptedAll: "已接受全部修订。",
        rejectedAll: "已拒绝全部修订。",
      };

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
  if (debugFlags.collaborationEnabled && !collaborationState.value.synced) {
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
  if (threads.length === 0 && activeSideTab.value !== "comments") {
    commentsPanelOpen.value = false;
  }
  if (activeSideTab.value === "comments") {
    commentsPanelOpen.value = true;
  }
  const hasActiveThread =
    !!activeCommentThreadId.value &&
    threads.some((thread) => thread.id === activeCommentThreadId.value);
  if (!hasActiveThread) {
    activeCommentThreadId.value = null;
    if (commentsPanelOpen.value && threads.length > 0) {
      openCommentsPanel(threads[0]?.id || null);
    }
  }
};

const handleCommentClick = () => {
  const texts = createCommentActionTexts(debugFlags.locale);
  clearActiveTrackChange();
  trackChangesPanelManualOpen.value = false;
  assistantPanelOpen.value = false;
  tocPanelOpen.value = false;
  setTocOutlineEnabled?.(false);
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
  const texts = createCommentActionTexts(debugFlags.locale);
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
  const texts = createCommentActionTexts(debugFlags.locale);
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
  const texts = createCommentActionTexts(debugFlags.locale);
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
  const texts = createCommentActionTexts(debugFlags.locale);
  const removed = lumenCommentsStore.removeMessage(threadId, messageId);
  if (!removed) {
    showToolbarMessage(texts.deleteMessageFailed, "warning");
    return;
  }
  openCommentsPanel(threadId);
  showToolbarMessage(texts.messageRemoved, "success");
};

const handleCommentThreadDelete = (threadId: string) => {
  const texts = createCommentActionTexts(debugFlags.locale);
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
  const texts = createTrackChangeActionTexts(debugFlags.locale);
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
  const texts = createTrackChangeActionTexts(debugFlags.locale);
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
  const texts = createTrackChangeActionTexts(debugFlags.locale);
  if (acceptTrackChangeInEditor?.(changeId) !== true) {
    showToolbarMessage(texts.acceptFailed, "warning");
    return;
  }
  showToolbarMessage(texts.accepted, "success");
};

const handleTrackChangeReject = (changeId: string) => {
  const texts = createTrackChangeActionTexts(debugFlags.locale);
  if (rejectTrackChangeInEditor?.(changeId) !== true) {
    showToolbarMessage(texts.rejectFailed, "warning");
    return;
  }
  showToolbarMessage(texts.rejected, "success");
};

const handleTrackChangesAcceptAll = () => {
  const texts = createTrackChangeActionTexts(debugFlags.locale);
  if (acceptAllTrackChangesInEditor?.() !== true) {
    showToolbarMessage(texts.acceptAllFailed, "warning");
    return;
  }
  showToolbarMessage(texts.acceptedAll, "success");
};

const handleTrackChangesRejectAll = () => {
  const texts = createTrackChangeActionTexts(debugFlags.locale);
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
  window.addEventListener("pointermove", handleRightSidebarResizeMove, { passive: false });
  window.addEventListener("pointerup", handleRightSidebarResizeEnd, { passive: true });
  window.addEventListener("pointercancel", handleRightSidebarResizeEnd, { passive: true });
  if (!editorHost.value) {
    return;
  }
  await nextTick();
  const mounted = mountPlaygroundEditor({
    host: editorHost.value,
    statusElement: toolbarRef.value?.statusEl?.value || null,
    flags: debugFlags,
    onCollaborationStateChange: (state) => {
      collaborationState.value = state;
      if (!state.enabled || state.synced) {
        syncCommentThreads();
      }
    },
    onTocOutlineChange: handleTocOutlineChange,
    tocOutlineEnabled: tocPanelOpen.value,
    onCommentStateChange: ({ activeThreadId }) => {
      const nextThreadId = activeThreadId || null;
      const previousThreadId = activeCommentThreadId.value;
      activeCommentThreadId.value = nextThreadId;
      syncCommentThreads();
      const resolvedThreadId = activeCommentThreadId.value;
      if (
        resolvedThreadId &&
        (!commentsPanelOpen.value || resolvedThreadId !== previousThreadId)
      ) {
        clearActiveTrackChange();
        trackChangesPanelManualOpen.value = false;
        assistantPanelOpen.value = false;
        tocPanelOpen.value = false;
        setTocOutlineEnabled?.(false);
        activeSideTab.value = "comments";
        commentsPanelOpen.value = true;
        return;
      }
      if (!resolvedThreadId && activeSideTab.value !== "comments") {
        commentsPanelOpen.value = false;
      }
    },
    onTrackChangeStateChange: ({ enabled, activeChangeId, changes }) => {
      trackChangesEnabled.value = enabled;
      trackChangeRecords.value = changes;
      const nextActiveChangeId =
        activeChangeId && changes.some((change) => change.changeId === activeChangeId)
          ? activeChangeId
          : null;
      activeTrackChangeId.value = nextActiveChangeId;
      if (nextActiveChangeId) {
        clearActiveCommentThread();
        commentsPanelOpen.value = false;
        assistantPanelOpen.value = false;
        tocPanelOpen.value = false;
        setTocOutlineEnabled?.(false);
        activeSideTab.value = "changes";
        trackChangesPanelManualOpen.value = true;
        return;
      }
      if (trackChangesPanelManualOpen.value && changes.length > 0) {
        const fallbackChangeId = getNextTrackChangeId();
        if (fallbackChangeId) {
          activeTrackChangeId.value = fallbackChangeId;
          activateTrackChangeInEditor?.(fallbackChangeId);
        }
      }
    },
    onStatsChange: handleStatsChange,
  });
  editor.value = mounted.editor;
  view.value = mounted.view;
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
});

watch(
  () => sessionMode.value,
  () => {
    applySessionModeToView();
  }
);

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", handleRightSidebarResizeMove);
  window.removeEventListener("pointerup", handleRightSidebarResizeEnd);
  window.removeEventListener("pointercancel", handleRightSidebarResizeEnd);
  stopRightSidebarResize();
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
  commentsPanelOpen.value = false;
  activeCommentThreadId.value = null;
  assistantPanelOpen.value = false;
  trackChangesEnabled.value = false;
  trackChangeRecords.value = [];
  activeTrackChangeId.value = null;
  trackChangesPanelManualOpen.value = false;
  collaborationState.value = createInitialLumenCollaborationState(debugFlags);
  tocItems.value = [];
  activeTocId.value = null;
  footerStats.value = {
    pageCount: 0,
    currentPage: 0,
    nodeCount: 0,
    pluginCount: 0,
    wordCount: 0,
    selectedWordCount: 0,
    blockType: "",
  };
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

.logo {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #1a73e8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}

.title-input {
  width: 260px;
}

.title-input-native {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2329;
  font-size: 13px;
  line-height: 28px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.title-input-native:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.16);
}

.doc-content {
  position: relative;
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
  min-width: 0;
  min-height: 0;
  height: 100%;
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

.doc-side-tabs {
  position: relative;
  flex: 0 0 var(--doc-side-panel-width, 360px);
  width: var(--doc-side-panel-width, 360px);
  min-width: 0;
  padding: 12px 12px 12px 0;
  background: transparent;
}

.doc-side-tabs-control {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
}

.doc-side-tabs-control :deep(.t-tabs__header.t-is-left) {
  float: none;
  display: flex;
  flex: 0 0 104px;
  height: 100%;
  background: #f8fafc;
}

.doc-side-tabs-control :deep(.t-tabs__nav-container.t-is-left) {
  width: 100%;
  height: 100%;
}

.doc-side-tabs-control :deep(.t-tabs__nav-scroll) {
  height: 100%;
}

.doc-side-tabs-control :deep(.t-tabs__nav-wrap.t-is-vertical) {
  width: 100%;
}

.doc-side-tabs-control :deep(.t-tabs__nav-item.t-is-left) {
  width: 100%;
}

.doc-side-tabs-control :deep(.t-tabs__nav-item-wrapper) {
  width: calc(100% - 12px);
  justify-content: center;
  margin: 6px;
}

.doc-side-tabs-control :deep(.t-tabs__content) {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  background: #ffffff;
}

.doc-side-tabs-control :deep(.t-tab-panel) {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
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
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: hidden;
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

.editor-host .lumenpage-editor {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0 auto;
}

.editor-host .lumenpage-viewport {
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
.doc-shell.is-high-contrast .doc-side-tabs-control,
.doc-shell.is-high-contrast :deep(.menu-bar),
.doc-shell.is-high-contrast :deep(.toolbar) {
  background: #000;
  border-color: #fff;
}

.doc-shell.is-high-contrast .logo {
  background: #fff;
  color: #000;
}

.doc-shell.is-high-contrast .doc-footer-stats,
.doc-shell.is-high-contrast .doc-footer-divider,
.doc-shell.is-high-contrast .doc-footer-contact,
.doc-shell.is-high-contrast .doc-footer-contact-link {
  color: #fff;
}

.doc-shell.is-high-contrast .title-input-native {
  background: #000;
  color: #fff;
  border-color: #fff;
  box-shadow: none;
}

.doc-shell.is-high-contrast .doc-footer-link {
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

  .title-input {
    width: 150px;
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

  .doc-side-tabs {
    display: none;
  }
}
</style>
