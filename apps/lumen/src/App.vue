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
        <t-tag size="small" theme="success" variant="light">{{ i18n.app.saved }}</t-tag>
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
        <t-button size="small" variant="outline" @click="toggleTocPanel">
          {{ tocToggleLabel }}
        </t-button>
        <t-button
          size="small"
          variant="outline"
          :disabled="commentButtonDisabled"
          @mousedown.prevent
          @click="handleCommentClick"
        >
          {{ commentButtonLabel }}
        </t-button>
        <t-button
          size="small"
          variant="outline"
          :theme="trackChangesEnabled ? 'success' : 'default'"
          :disabled="!canMutateTrackChanges"
          @mousedown.prevent
          @click="handleTrackChangesToggle"
        >
          {{ trackChangesToggleLabel }}
        </t-button>
        <t-button
          size="small"
          variant="outline"
          :disabled="trackChangesButtonDisabled"
          @mousedown.prevent
          @click="handleTrackChangesPanelToggle"
        >
          {{ trackChangesButtonLabel }}
        </t-button>
        <t-button size="small" theme="primary">{{ i18n.app.share }}</t-button>
        <t-avatar v-if="!debugFlags.collaborationEnabled" size="small">U</t-avatar>
      </div>
    </t-header>

    <EditorMenuBar v-model:active-menu="activeToolbarMenu" :locale="debugFlags.locale" />
    <EditorToolbar
      ref="toolbarRef"
      :editorView="view"
      :locale="debugFlags.locale"
      :active-menu="activeToolbarMenu"
      :session-mode="sessionMode"
      @update:session-mode="handleSessionModeUpdate"
      @toggle-toc="toggleTocPanel"
    />

    <t-content class="doc-content">
      <t-layout class="doc-workspace">
        <t-aside v-if="tocPanelOpen && tocItems.length > 0" class="doc-outline">
          <div class="doc-outline-header">
            <span>{{ outlineTitle }}</span>
            <button type="button" class="doc-outline-close" @click="closeTocPanel">×</button>
          </div>
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
        </t-aside>
        <t-content class="doc-main">
          <div class="doc-stage">
            <div ref="editorHost" class="editor-host"></div>
          </div>
        </t-content>
        <t-aside v-if="rightSidebarOpen" class="doc-side-panel">
          <TrackChangesPanel
            v-if="trackChangesPanelOpen"
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
          <CommentsPanel
            v-else-if="commentsPanelOpen"
            :locale="debugFlags.locale"
            :threads="commentThreads"
            :active-thread-id="activeCommentThreadId"
            :can-manage="canMutateComments"
            @close="closeCommentsPanel"
            @select="handleCommentThreadSelect"
            @toggle-resolved="handleCommentThreadResolved"
            @reply="handleCommentThreadReply"
            @delete="handleCommentThreadDelete"
          />
        </t-aside>
      </t-layout>
    </t-content>
    <t-footer class="doc-footer">
      <div class="doc-footer-stats">
        <span class="doc-footer-stat">{{ footerCurrentPageLabel }}</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-stat">{{ footerPageLabel }}</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-stat">{{ footerWordLabel }}</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-stat">{{ footerSelectionWordLabel }}</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-stat">{{ footerBlockTypeLabel }}</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-stat">{{ footerNodeLabel }}</span>
        <span class="doc-footer-divider">·</span>
        <span class="doc-footer-stat">{{ footerPluginLabel }}</span>
      </div>
      <div class="doc-footer-right">
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
import { Selection, TextSelection } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";
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
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
const toolbarRef = ref<ToolbarExpose | null>(null);
const activeToolbarMenu = ref<ToolbarMenuKey>("base");
const view = shallowRef<CanvasEditorView | null>(null);
const collaborationState = ref<LumenCollaborationState>(
  createInitialLumenCollaborationState(debugFlags)
);
const commentThreads = ref<LumenCommentThread[]>(lumenCommentsStore.listThreads());
const commentsPanelOpen = ref(false);
const activeCommentThreadId = ref<string | null>(null);
const trackChangesEnabled = ref(false);
const trackChangeRecords = ref<TrackChangeRecord[]>([]);
const activeTrackChangeId = ref<string | null>(null);
const trackChangesPanelManualOpen = ref(false);
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
const canMutateTrackChanges = computed(
  () => !isReadonlyPermission.value && sessionMode.value !== "viewer"
);
const commentButtonDisabled = computed(() => !canMutateComments.value);
const commentButtonLabel = computed(() =>
  commentCount.value > 0 ? `${i18n.app.comment} (${commentCount.value})` : i18n.app.comment
);
const trackChangeCount = computed(() => trackChangeRecords.value.length);
const trackChangesPanelOpen = computed(
  () => trackChangesPanelManualOpen.value || !!activeTrackChangeId.value
);
const rightSidebarOpen = computed(() => trackChangesPanelOpen.value || commentsPanelOpen.value);
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
  return {
    from: Number(selection.from),
    to: Number(selection.to),
    empty: selection.empty === true,
    type: selection.constructor?.name ?? null,
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

const setTocPanelEnabled = (enabled: boolean) => {
  tocPanelOpen.value = enabled;
  setTocOutlineEnabled?.(enabled);
};

const toggleTocPanel = () => {
  setTocPanelEnabled(!tocPanelOpen.value);
};

const closeTocPanel = () => {
  setTocPanelEnabled(false);
};

const closeCommentsPanel = () => {
  const hadActiveThread = !!activeCommentThreadId.value;
  commentsPanelOpen.value = false;
  activeCommentThreadId.value = null;
  if (hadActiveThread) {
    activateCommentThreadInEditor?.(null);
  }
};

const getNextTrackChangeId = (excludeChangeId?: string | null) =>
  trackChangeRecords.value.find((change) => change.changeId !== excludeChangeId)?.changeId || null;

const closeTrackChangesPanel = () => {
  const hadActiveChange = !!activeTrackChangeId.value;
  trackChangesPanelManualOpen.value = false;
  activeTrackChangeId.value = null;
  if (hadActiveChange) {
    activateTrackChangeInEditor?.(null);
  }
};

const openTrackChangesPanel = (preferredChangeId?: string | null) => {
  trackChangesPanelManualOpen.value = true;
  if (commentsPanelOpen.value || activeCommentThreadId.value) {
    closeCommentsPanel();
  }
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
  commentsPanelOpen.value = true;
  const nextThreadId = preferredThreadId || activeCommentThreadId.value || getNextCommentThreadId();
  if (nextThreadId && nextThreadId !== activeCommentThreadId.value) {
    activeCommentThreadId.value = nextThreadId;
    activateCommentThreadInEditor?.(nextThreadId);
  }
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

const createCommentActionTexts = (_locale: "zh-CN" | "en-US") => ({
  disabled: "Comments are unavailable in viewer mode.",
  requiresSelection: "Select text first to create a comment.",
  failed: "Failed to create comment anchor.",
  created: "Comment anchor created.",
  replyFailed: "Failed to add comment reply.",
  missingAnchor: "Comment anchor no longer exists in the document.",
  removed: "Comment thread removed.",
});

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
  if (threads.length === 0) {
    commentsPanelOpen.value = false;
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
  closeTrackChangesPanel();
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
    const applied = currentView.commands?.setCommentAnchor?.({ threadId, anchorId }) === true;
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
    authorName:
      (debugFlags.collaborationEnabled ? collaborationState.value.userName : "") || "You",
  });
  if (!nextMessage) {
    showToolbarMessage(texts.replyFailed, "warning");
    return;
  }
  openCommentsPanel(threadId);
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

const handleTrackChangesPanelToggle = () => {
  if (trackChangesPanelOpen.value && trackChangesPanelManualOpen.value) {
    closeTrackChangesPanel();
    return;
  }
  openTrackChangesPanel();
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
        closeTrackChangesPanel();
        commentsPanelOpen.value = true;
        return;
      }
      if (!resolvedThreadId) {
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
        if (commentsPanelOpen.value || activeCommentThreadId.value) {
          closeCommentsPanel();
        }
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
  view.value = mounted.view;
  syncDebugHandles();
  setTocOutlineEnabled = mounted.setTocOutlineEnabled;
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
  detachEditor?.();
  detachEditor = null;
  setTocOutlineEnabled = null;
  detachCommentStore?.();
  detachCommentStore = null;
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
  view.value = null;
  syncDebugHandles();
  commentThreads.value = [];
  commentsPanelOpen.value = false;
  activeCommentThreadId.value = null;
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
  height: 56px;
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
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: transparent;
}

.doc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 34px;
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

.doc-footer-contact-link:hover {
  text-decoration: underline;
}

.doc-outline {
  width: 240px;
  min-width: 0;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
  overflow: auto;
  padding: 12px 10px;
}

.doc-outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
  letter-spacing: 0.03em;
  margin: 2px 4px 8px;
  text-transform: uppercase;
}

.doc-outline-close {
  border: 0;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.doc-outline-close:hover {
  color: #111827;
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
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: hidden;
}

.doc-side-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  min-width: 0;
  z-index: 8;
  background: transparent;
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.08);
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
.doc-shell.is-high-contrast .doc-side-panel,
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

.doc-shell.is-high-contrast .editor-host :deep(.lumenpage-scroll-area) {
  background: #000;
}

.doc-shell.is-high-contrast .editor-host :deep(.page-canvas) {
  border-color: #fff;
  box-shadow: none;
}

@media (max-width: 1024px) {
  .doc-side-panel {
    width: 280px;
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

  .doc-outline {
    display: none;
  }

  .doc-side-panel {
    display: none;
  }
}
</style>
