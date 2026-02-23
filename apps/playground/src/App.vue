<template>
  <t-layout class="app-shell">
    <t-header class="topbar">
      <div class="topbar-left">
        <div class="logo">LP</div>
        <div class="brand">腾讯文档</div>
        <t-input v-model="docTitle" class="title-input" size="small" />
        <t-tag size="small" theme="success" variant="light">已保存</t-tag>
        <t-tag size="small" variant="light">{{ permissionLabel }}</t-tag>
      </div>
      <div class="topbar-right">
        <t-button size="small" theme="primary">分享</t-button>
        <t-button size="small" variant="outline">评论</t-button>
        <t-avatar size="small">U</t-avatar>
      </div>
    </t-header>

    <EditorMenuBar :editorView="view" />
    <EditorToolbar ref="toolbarRef" :editorView="view" />

  <t-content class="editor-area">
    <div ref="editorHost" class="editor-host"></div>
    <div
      v-if="debugTablePagination"
      ref="tableDebugPanel"
      class="table-debug-panel"
    ></div>
  </t-content>
  </t-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import EditorMenuBar from "./components/EditorMenuBar.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import { createPlaygroundDebugFlags } from "./editor/config";
import { mountPlaygroundEditor } from "./editor/editorMount";

const docTitle = ref("项目周报");
const editorHost = ref<HTMLElement | null>(null);
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
const toolbarRef = ref<ToolbarExpose | null>(null);
const view = shallowRef<CanvasEditorView | null>(null);
const tableDebugPanel = ref<HTMLElement | null>(null);
const debugFlags = createPlaygroundDebugFlags();
const debugTablePagination = debugFlags.debugTablePagination;
const permissionLabel = computed(() => {
  if (debugFlags.permissionMode === "readonly") {
    return "只读态";
  }
  if (debugFlags.permissionMode === "comment") {
    return "评论态";
  }
  return "编辑态";
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
    tableDebugPanelElement: tableDebugPanel.value,
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
.app-shell {
  height: 100vh;
  width: 100%;
  background: #f5f6f8;
  color: #1f2329;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  border-bottom: 1px solid #e5e6eb;
  padding: 0 20px;
  height: 52px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand {
  font-weight: 600;
  font-size: 14px;
}

.logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #3370ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.title-input {
  width: 200px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.editor-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0;
  background: #f5f6f8;
  overflow: hidden;
  position: relative;
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

.table-debug-panel {
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 320px;
  max-height: 45vh;
  padding: 12px 14px;
  background: rgba(15, 23, 42, 0.9);
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.4;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
  overflow: auto;
  white-space: pre-wrap;
  pointer-events: auto;
  user-select: text;
  z-index: 10;
}
</style>
