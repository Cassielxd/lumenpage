<template>
  <t-aside
    v-if="activeTab"
    class="doc-side-tabs"
    :class="{
      'is-side-panel-resizing': resizing,
      'is-high-contrast': highContrast,
    }"
    :style="{ '--doc-side-panel-width': `${width}px` }"
  >
    <button
      type="button"
      class="doc-side-panel-resize-handle"
      aria-label="Resize panel"
      @pointerdown="emit('resize-start', $event)"
    ></button>
    <div class="doc-side-panel-card">
      <slot v-if="activeTab === 'outline'" name="outline" />
      <slot v-else-if="activeTab === 'comments'" name="comments" />
      <slot v-else-if="activeTab === 'collaboration'" name="collaboration" />
      <slot v-else-if="activeTab === 'locks'" name="locks" />
      <slot v-else-if="activeTab === 'assistant'" name="assistant" />
      <slot v-else-if="activeTab === 'changes'" name="changes" />
      <slot v-else-if="activeTab === 'annotation'" name="annotation" />
    </div>
  </t-aside>
</template>

<script setup lang="ts">
defineProps<{
  activeTab:
    | "outline"
    | "comments"
    | "collaboration"
    | "locks"
    | "assistant"
    | "changes"
    | "annotation"
    | null;
  width: number;
  resizing?: boolean;
  highContrast?: boolean;
}>();

const emit = defineEmits<{
  (event: "resize-start", value: PointerEvent): void;
}>();
</script>

<style scoped>
.doc-side-tabs {
  position: fixed;
  top: 112px;
  right: 16px;
  bottom: 56px;
  width: var(--doc-side-panel-width, 360px);
  display: flex;
  min-width: 0;
  background: transparent;
  z-index: 18;
}

.doc-side-panel-card {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
  overflow: hidden;
  backdrop-filter: blur(18px);
}

.doc-side-panel-resize-handle {
  position: absolute;
  top: 0;
  left: -8px;
  width: 16px;
  height: 100%;
  border: none;
  background: transparent;
  cursor: col-resize;
  z-index: 2;
}

.doc-side-panel-resize-handle::after {
  content: "";
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 7px;
  width: 2px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.42);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.doc-side-tabs:hover .doc-side-panel-resize-handle::after,
.doc-side-tabs.is-side-panel-resizing .doc-side-panel-resize-handle::after {
  opacity: 1;
}

.doc-side-tabs.is-high-contrast .doc-side-panel-card {
  background: #000;
  border: 1px solid #fff;
}

.doc-side-tabs.is-high-contrast .doc-side-panel-resize-handle::after {
  background: rgba(255, 255, 255, 0.55);
}

@media (max-width: 960px) {
  .doc-side-tabs {
    top: 104px;
    right: 12px;
    left: 12px;
    width: auto;
  }

  .doc-side-panel-resize-handle {
    display: none;
  }
}
</style>
