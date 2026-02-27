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
      </div>
      <div class="topbar-right">
        <t-button size="small" variant="outline" @click="toggleTocPanel">
          {{ tocToggleLabel }}
        </t-button>
        <t-button size="small" variant="outline">{{ i18n.app.comment }}</t-button>
        <t-button size="small" theme="primary">{{ i18n.app.share }}</t-button>
        <t-avatar size="small">U</t-avatar>
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
      <aside v-if="tocPanelOpen && tocItems.length > 0" class="doc-outline">
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
      </aside>
      <div class="doc-stage">
        <div ref="editorHost" class="editor-host"></div>
      </div>
    </t-content>
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
import { TextSelection } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import EditorMenuBar from "./components/EditorMenuBar.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import { createPlaygroundDebugFlags } from "./editor/config";
import { createPlaygroundI18n } from "./editor/i18n";
import { mountPlaygroundEditor } from "./editor/editorMount";
import {
  findHeadingPosById,
  type TocOutlineItem,
  type TocOutlineSnapshot,
} from "./editor/tocOutlinePlugin";
import type { ToolbarMenuKey } from "./editor/toolbarCatalog";
import type { EditorSessionMode } from "./editor/sessionMode";

const debugFlags = createPlaygroundDebugFlags();
const i18n = createPlaygroundI18n(debugFlags.locale);
const docTitle = ref(i18n.app.defaultDocTitle);
const editorHost = ref<HTMLElement | null>(null);
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
const toolbarRef = ref<ToolbarExpose | null>(null);
const activeToolbarMenu = ref<ToolbarMenuKey>("base");
const view = shallowRef<CanvasEditorView | null>(null);
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
let detachEditor: null | (() => void) = null;
let setTocOutlineEnabled: null | ((enabled: boolean) => void) = null;

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

const handleTocOutlineChange = (snapshot: TocOutlineSnapshot) => {
  tocItems.value = Array.isArray(snapshot?.items) ? snapshot.items : [];
  activeTocId.value = snapshot?.activeId || null;
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
    onTocOutlineChange: handleTocOutlineChange,
    tocOutlineEnabled: tocPanelOpen.value,
  });
  view.value = mounted.view;
  setTocOutlineEnabled = mounted.setTocOutlineEnabled;
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
  view.value = null;
  tocItems.value = [];
  activeTocId.value = null;
});
</script>

<style scoped>
.doc-shell {
  height: 100vh;
  width: 100%;
  background: #f5f6f8;
  color: #1f2329;
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
  display: flex;
  min-height: 0;
  flex: 1;
  padding: 0;
  overflow: hidden;
  background: #f5f6f8;
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
  flex: 1;
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: hidden;
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
.doc-shell.is-high-contrast .doc-stage,
.doc-shell.is-high-contrast :deep(.menu-bar),
.doc-shell.is-high-contrast :deep(.toolbar) {
  background: #000;
  border-color: #fff;
}

.doc-shell.is-high-contrast .logo {
  background: #fff;
  color: #000;
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

  .doc-outline {
    display: none;
  }
}
</style>
