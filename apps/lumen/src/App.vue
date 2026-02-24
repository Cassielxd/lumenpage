<template>
  <t-layout :class="['doc-shell', { 'is-high-contrast': debugFlags.highContrast }]">
    <t-header class="topbar">
      <div class="topbar-left">
        <div class="logo">L</div>
        <t-input v-model="docTitle" class="title-input" size="small" />
        <t-tag size="small" theme="success" variant="light">{{ i18n.app.saved }}</t-tag>
        <t-tag size="small" variant="light">{{ permissionLabel }}</t-tag>
      </div>
      <div class="topbar-right">
        <t-button size="small" variant="outline">{{ i18n.app.comment }}</t-button>
        <t-button size="small" theme="primary">{{ i18n.app.share }}</t-button>
        <t-avatar size="small">U</t-avatar>
      </div>
    </t-header>

    <EditorMenuBar
      v-model:active-menu="activeToolbarMenu"
      :locale="debugFlags.locale"
    />
    <EditorToolbar
      ref="toolbarRef"
      :editorView="view"
      :locale="debugFlags.locale"
      :active-menu="activeToolbarMenu"
    />

    <t-content class="doc-content">
      <div class="doc-stage">
        <div ref="editorHost" class="editor-host"></div>
      </div>
    </t-content>
  </t-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import EditorMenuBar from "./components/EditorMenuBar.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import { createPlaygroundDebugFlags } from "./editor/config";
import { createPlaygroundI18n } from "./editor/i18n";
import { mountPlaygroundEditor } from "./editor/editorMount";

const debugFlags = createPlaygroundDebugFlags();
const i18n = createPlaygroundI18n(debugFlags.locale);
type ToolbarMenuKey = "base" | "insert" | "table" | "tools" | "page" | "export";
const docTitle = ref(i18n.app.defaultDocTitle);
const editorHost = ref<HTMLElement | null>(null);
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
const toolbarRef = ref<ToolbarExpose | null>(null);
const activeToolbarMenu = ref<ToolbarMenuKey>("base");
const view = shallowRef<CanvasEditorView | null>(null);
const permissionLabel = computed(() => {
  if (debugFlags.permissionMode === "readonly") {
    return i18n.app.permissionReadonly;
  }
  if (debugFlags.permissionMode === "comment") {
    return i18n.app.permissionComment;
  }
  return i18n.app.permissionEdit;
});
let detachEditor: null | (() => void) = null;

onMounted(async () => {
  if (!editorHost.value) {
    return;
  }
  await nextTick();
  const mounted = mountPlaygroundEditor({
    host: editorHost.value,
    statusElement: toolbarRef.value?.statusEl?.value || null,
    flags: debugFlags,
  });
  view.value = mounted.view;
  detachEditor = mounted.destroy;
});

onBeforeUnmount(() => {
  detachEditor?.();
  detachEditor = null;
  view.value = null;
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

.doc-content {
  display: flex;
  min-height: 0;
  flex: 1;
  padding: 0;
  overflow: hidden;
  background: #f5f6f8;
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
    radial-gradient(circle at 24px 24px, rgba(148, 163, 184, 0.06) 0, rgba(148, 163, 184, 0.06) 2px, transparent 2px) 0 0 / 36px 36px,
    linear-gradient(180deg, #f7f8fb 0%, #eef1f6 100%);
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
}
</style>
