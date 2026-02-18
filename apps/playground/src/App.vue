<template>
  <t-layout class="app-shell">
    <t-header class="topbar">
      <div class="topbar-left">
        <div class="logo">LP</div>
        <div class="brand">腾讯文档</div>
        <t-input v-model="docTitle" class="title-input" size="small" />
        <t-tag size="small" theme="success" variant="light">已保存</t-tag>
      </div>
      <div class="topbar-right">
        <t-button size="small" theme="primary">分享</t-button>
        <t-button size="small" variant="outline">评论</t-button>
        <t-avatar size="small">U</t-avatar>
      </div>
    </t-header>

    <EditorToolbar ref="toolbarRef" :editorView="view" />

    <t-content class="editor-area">
      <div ref="editorHost" class="editor-host"></div>
    </t-content>
  </t-layout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from "vue";
import {
  basicCommands,
  createDefaultNodeRendererRegistry,
  createDocFromText,
  createViewCommands,
  runCommand,
  schema,
  setBlockAlign,
} from "lumenpage-kit-basic";
import { baseKeymap } from "lumenpage-commands";
import { keymap } from "lumenpage-keymap";
import { CanvasEditorView, createCanvasState } from "lumenpage-view-canvas";
import { history } from "lumenpage-history";
import EditorToolbar from "./components/EditorToolbar.vue";
import { initialDocJson } from "./initialDoc";

const docTitle = ref("项目周报");
const editorHost = ref<HTMLElement | null>(null);
type ToolbarExpose = { statusEl: Ref<HTMLElement | null> };
const toolbarRef = ref<ToolbarExpose | null>(null);
const view = shallowRef<CanvasEditorView | null>(null);

const settings = {
  pageWidth: 816,
  pageHeight: 720,
  pageGap: 24,
  margin: {
    top: 72,
    right: 72,
    bottom: 72,
    left: 72,
  },
  lineHeight: 22,
  font: "16px Arial",
  wrapTolerance: 2,
  pageBuffer: 1,
  maxPageCache: 16,
};

const nodeRegistry = createDefaultNodeRendererRegistry();

onMounted(() => {
  if (!editorHost.value) {
    return;
  }
  const editorState = createCanvasState({
    schema,
    createDocFromText,
    json: initialDocJson,
    plugins: [history(), keymap(baseKeymap)],
    canvasConfig: {
      settings,
      nodeRegistry,
      debug: { layout: true },
      commands: {
        basicCommands,
        runCommand,
        setBlockAlign,
        viewCommands: createViewCommands(),
      },
      statusElement: toolbarRef.value?.statusEl?.value || undefined,
    },
  });
  view.value = new CanvasEditorView(editorHost.value, { state: editorState });
});

onBeforeUnmount(() => {
  view.value?.destroy();
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
</style>
