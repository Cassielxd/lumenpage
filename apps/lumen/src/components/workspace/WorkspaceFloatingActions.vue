<template>
  <div class="doc-floating-actions" :class="{ 'has-side-panel': !!activeSideTab }">
    <button
      v-for="action in actions"
      :key="action.key"
      type="button"
      class="doc-floating-action"
      :class="{ 'is-active': action.active }"
      @click="emit('select', action.key)"
    >
      <span class="doc-floating-action-label">{{ action.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  activeSideTab: string | null;
  annotationActive: boolean;
  outlineLabel: string;
  commentsLabel: string;
  collaborationLabel: string;
  assistantLabel: string;
  changesLabel: string;
  annotationLabel: string;
}>();

const emit = defineEmits<{
  (event: "select", value: "outline" | "comments" | "collaboration" | "assistant" | "changes" | "annotation"): void;
}>();

const actions = computed(() => [
  {
    key: "outline" as const,
    label: props.outlineLabel,
    active: props.activeSideTab === "outline",
  },
  {
    key: "comments" as const,
    label: props.commentsLabel,
    active: props.activeSideTab === "comments",
  },
  {
    key: "collaboration" as const,
    label: props.collaborationLabel,
    active: props.activeSideTab === "collaboration",
  },
  {
    key: "assistant" as const,
    label: props.assistantLabel,
    active: props.activeSideTab === "assistant",
  },
  {
    key: "changes" as const,
    label: props.changesLabel,
    active: props.activeSideTab === "changes",
  },
  {
    key: "annotation" as const,
    label: props.annotationLabel,
    active: props.activeSideTab === "annotation" && props.annotationActive,
  },
]);
</script>

<style scoped>
.doc-floating-actions {
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: right 0.18s ease;
}

.doc-floating-actions.has-side-panel {
  right: calc(var(--doc-side-panel-width, 360px) + 20px);
}

.doc-floating-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.94);
  color: #334155;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    background 0.18s ease;
}

.doc-floating-action:hover {
  transform: translateX(-2px);
  border-color: rgba(37, 99, 235, 0.32);
  color: #1d4ed8;
}

.doc-floating-action.is-active {
  border-color: rgba(37, 99, 235, 0.44);
  background: #eff6ff;
  color: #1d4ed8;
}

.doc-floating-action-label {
  white-space: nowrap;
}

@media (max-width: 960px) {
  .doc-floating-actions {
    right: 12px;
  }

  .doc-floating-actions.has-side-panel {
    right: 12px;
  }
}
</style>
