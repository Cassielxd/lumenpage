<template>
  <div class="doc-main" :class="{ 'is-high-contrast': highContrast }">
    <WorkspaceStage
      v-if="!workspaceError"
      :editor-view="editorView"
      :editor-host="editorHostElement"
      :annotation-store="annotationStore"
      :locale="locale"
    >
      <template #editor-host>
        <div :ref="handleEditorHostRef" class="editor-host"></div>
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
    <WorkspaceFloatingActions
      v-if="!workspaceLoading && !workspaceError"
      :active-side-tab="activeSideTab"
      :annotation-active="annotationActive"
      :outline-label="outlineLabel"
      :comments-label="commentsLabel"
      :collaboration-label="collaborationLabel"
      :locks-label="locksLabel"
      :assistant-label="assistantLabel"
      :changes-label="changesLabel"
      :annotation-label="annotationLabel"
      @select="emit('select-floating-action', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, type ComponentPublicInstance } from "vue";
import type { CanvasEditorView } from "lumenpage-view-canvas";
import type { LumenAnnotationStore } from "../../annotation/annotationStore";
import type { PlaygroundLocale } from "../../editor/i18n";
import type { SideTabKey } from "../../composables/useWorkspaceSidePanel";
import WorkspaceFloatingActions from "./WorkspaceFloatingActions.vue";
import WorkspaceStage from "./WorkspaceStage.vue";

const props = defineProps<{
  editorView: CanvasEditorView | null;
  annotationStore: LumenAnnotationStore;
  locale: PlaygroundLocale;
  highContrast: boolean;
  workspaceLoading: boolean;
  workspaceError: string | null;
  documentStatusLoadingLabel: string;
  documentStatusLoadingCopy: string;
  documentStatusErrorLabel: string;
  activeSideTab: SideTabKey | null;
  annotationActive: boolean;
  outlineLabel: string;
  commentsLabel: string;
  collaborationLabel: string;
  locksLabel: string;
  assistantLabel: string;
  changesLabel: string;
  annotationLabel: string;
  onEditorHostChange: (value: HTMLElement | null) => void;
}>();

const emit = defineEmits<{
  (event: "select-floating-action", value: SideTabKey): void;
}>();

const editorHostElement = ref<HTMLElement | null>(null);

const handleEditorHostRef = (value: Element | ComponentPublicInstance | null) => {
  const nextValue = value instanceof HTMLElement ? value : null;
  editorHostElement.value = nextValue;
  props.onEditorHostChange(nextValue);
};
</script>

<style scoped>
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

.doc-main.is-high-contrast :deep(.doc-floating-action) {
  background: rgba(0, 0, 0, 0.92);
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
}

.doc-main.is-high-contrast :deep(.doc-floating-action.is-active) {
  background: #fff;
  color: #000;
  border-color: #fff;
}

.doc-main.is-high-contrast :deep(.doc-ruler-corner) {
  background: #000;
  border-color: rgba(255, 255, 255, 0.36);
}

.doc-main.is-high-contrast :deep(.doc-ruler-corner::after) {
  border-color: rgba(255, 255, 255, 0.52);
}

.doc-main.is-high-contrast .editor-host :deep(.lumenpage-scroll-area) {
  background: #000;
}

.doc-main.is-high-contrast .editor-host :deep(.page-canvas) {
  border-color: #fff;
  box-shadow: none;
}
</style>
