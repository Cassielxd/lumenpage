<template>
  <div class="bubble-menu-panel" role="toolbar" aria-label="Selection formatting">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="bubble-menu-btn"
      :class="{ 'bubble-menu-btn--active': item.active }"
      :disabled="item.disabled"
      :aria-label="item.label"
      :aria-pressed="item.active || undefined"
      :title="item.label"
      @mousedown.prevent
      @click="onRunAction(item.id)"
    >
      <LumenIcon v-if="item.icon" :name="item.icon" :size="15" />
      <span v-else class="bubble-menu-btn-fallback">{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import LumenIcon from "./LumenIcon.vue";

type BubbleMenuPanelItem = {
  id: string;
  icon?: string;
  label: string;
  active: boolean;
  disabled: boolean;
};

defineProps<{
  items: BubbleMenuPanelItem[];
  onRunAction: (id: string) => void;
}>();
</script>

<style scoped>
.bubble-menu-panel {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 2px;
  border: 1px solid #d2d7df;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 10px 28px rgba(32, 33, 36, 0.16);
  backdrop-filter: blur(10px);
}

.bubble-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 34px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #202124;
  font: inherit;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
}

.bubble-menu-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.bubble-menu-btn:hover {
  border-color: #d2d7df;
  background: #f1f3f4;
}

.bubble-menu-btn:focus,
.bubble-menu-btn:focus-visible,
.bubble-menu-btn--active,
.bubble-menu-btn--active:hover {
  border-color: #aecbfa;
  background: #e8f0fe;
  outline: none;
}

.bubble-menu-btn :deep(.lumen-icon) {
  width: 18px;
  height: 18px;
}

.bubble-menu-btn-fallback {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}
</style>
