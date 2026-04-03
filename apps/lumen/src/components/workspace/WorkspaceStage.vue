<template>
  <div class="doc-stage">
    <div class="doc-ruler-shell">
      <div class="doc-ruler-corner" aria-hidden="true"></div>
      <DocumentRuler :editor-view="editorView" :locale="locale" />
    </div>
    <div class="doc-stage-body">
      <DocumentVerticalRuler :editor-view="editorView" :locale="locale" />
      <slot name="editor-host" />
      <AnnotationLayer
        v-if="annotationStore.state.active"
        :editor-view="editorView"
        :host="editorHost"
        :store="annotationStore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CanvasEditorView } from "lumenpage-view-canvas";
import type { LumenAnnotationStore } from "../../annotation/annotationStore";
import type { PlaygroundLocale } from "../../editor/i18n";
import AnnotationLayer from "../AnnotationLayer.vue";
import DocumentRuler from "../DocumentRuler.vue";
import DocumentVerticalRuler from "../DocumentVerticalRuler.vue";

defineProps<{
  editorView: CanvasEditorView | null;
  editorHost: HTMLElement | null;
  annotationStore: LumenAnnotationStore;
  locale: PlaygroundLocale;
}>();
</script>

<style scoped>
.doc-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.doc-ruler-shell {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: 100%;
  min-width: 0;
  flex: 0 0 28px;
  min-height: 28px;
}

.doc-ruler-corner {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-right: 1px solid rgba(203, 213, 225, 0.9);
  border-bottom: 1px solid rgba(203, 213, 225, 0.9);
  background:
    linear-gradient(135deg, rgba(219, 234, 254, 0.78), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(241, 245, 249, 0.9));
  border-top-left-radius: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.doc-stage-body {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: stretch;
  gap: 0;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
