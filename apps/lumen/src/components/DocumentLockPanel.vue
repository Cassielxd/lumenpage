<template>
  <aside class="doc-document-lock">
    <div class="doc-document-lock-header">
      <div class="doc-document-lock-heading">
        <span class="doc-document-lock-icon" aria-hidden="true">🔒</span>
        <span class="doc-document-lock-title">{{ texts.title }}</span>
        <span class="doc-document-lock-summary">{{ lockedRangeCount }}</span>
      </div>
      <button type="button" class="doc-document-lock-close" @click="$emit('close')">x</button>
    </div>

    <div class="doc-document-lock-toolbar">
      <t-tag size="small" variant="light" :theme="enabled ? 'warning' : 'default'">
        {{ enabled ? texts.enabled : texts.disabled }}
      </t-tag>
      <t-tag size="small" variant="light" :theme="showMarkers ? 'primary' : 'default'">
        {{ showMarkers ? texts.markersVisible : texts.markersHidden }}
      </t-tag>
      <t-tag size="small" variant="light">
        {{ rangeSummary }}
      </t-tag>
    </div>

    <div class="doc-document-lock-summary-card">
      <p class="doc-document-lock-note">{{ texts.hint }}</p>
      <p v-if="!canManage" class="doc-document-lock-note is-warning">
        {{ texts.readonlyHint }}
      </p>
    </div>

    <div class="doc-document-lock-actions">
      <t-button
        size="small"
        theme="primary"
        :disabled="!canManage"
        @mousedown.prevent
        @click="$emit('lock-selection')"
      >
        {{ texts.lockSelection }}
      </t-button>
      <t-button
        size="small"
        variant="outline"
        :disabled="!canManage"
        @mousedown.prevent
        @click="$emit('unlock-selection')"
      >
        {{ texts.unlockSelection }}
      </t-button>
      <t-button
        size="small"
        theme="danger"
        variant="outline"
        :disabled="!canManage || lockedRangeCount === 0"
        @mousedown.prevent
        @click="$emit('clear-all')"
      >
        {{ texts.clearAll }}
      </t-button>
    </div>

    <div class="doc-document-lock-toggle-group">
      <button
        type="button"
        class="doc-document-lock-toggle"
        :class="{ 'is-active': enabled, 'is-disabled': !canManage }"
        :disabled="!canManage"
        @click="$emit('set-enabled', !enabled)"
      >
        <span class="doc-document-lock-toggle-label">{{ texts.protection }}</span>
        <span class="doc-document-lock-toggle-value">
          {{ enabled ? texts.disable : texts.enable }}
        </span>
      </button>
      <button
        type="button"
        class="doc-document-lock-toggle"
        :class="{ 'is-active': showMarkers, 'is-disabled': !canManage }"
        :disabled="!canManage"
        @click="$emit('set-markers-visible', !showMarkers)"
      >
        <span class="doc-document-lock-toggle-label">{{ texts.markers }}</span>
        <span class="doc-document-lock-toggle-value">
          {{ showMarkers ? texts.hideMarkers : texts.showMarkers }}
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { PlaygroundLocale } from "../editor/i18n";
import { coercePlaygroundLocale, createPlaygroundI18n } from "../editor/i18n";

const props = defineProps<{
  locale: PlaygroundLocale;
  enabled: boolean;
  showMarkers: boolean;
  lockedRangeCount: number;
  canManage: boolean;
}>();

defineEmits<{
  (event: "close"): void;
  (event: "lock-selection"): void;
  (event: "unlock-selection"): void;
  (event: "clear-all"): void;
  (event: "set-enabled", value: boolean): void;
  (event: "set-markers-visible", value: boolean): void;
}>();

const currentLocale = computed<PlaygroundLocale>(() => coercePlaygroundLocale(props.locale));
const texts = computed(() => createPlaygroundI18n(currentLocale.value).documentLockPanel);
const rangeSummary = computed(() =>
  texts.value.rangeCount.replace("{count}", String(props.lockedRangeCount)),
);
</script>

<style scoped>
.doc-document-lock {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 16px;
  color: #0f172a;
}

.doc-document-lock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.doc-document-lock-heading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.doc-document-lock-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  font-size: 14px;
}

.doc-document-lock-title {
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
}

.doc-document-lock-summary {
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #334155;
  font-size: 12px;
  line-height: 24px;
  font-weight: 700;
  text-align: center;
}

.doc-document-lock-close {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.doc-document-lock-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 14px;
}

.doc-document-lock-summary-card {
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.96);
}

.doc-document-lock-note {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #475569;
}

.doc-document-lock-note.is-warning {
  margin-top: 8px;
  color: #b45309;
}

.doc-document-lock-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 14px;
}

.doc-document-lock-toggle-group {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding-top: 14px;
}

.doc-document-lock-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: #fff;
  color: #0f172a;
  cursor: pointer;
  text-align: left;
}

.doc-document-lock-toggle.is-active {
  border-color: rgba(37, 99, 235, 0.26);
  background: rgba(239, 246, 255, 0.9);
}

.doc-document-lock-toggle.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.doc-document-lock-toggle-label {
  font-size: 13px;
  font-weight: 600;
}

.doc-document-lock-toggle-value {
  font-size: 12px;
  color: #475569;
}

:global(.doc-shell.is-high-contrast) .doc-document-lock {
  color: #fff;
}

:global(.doc-shell.is-high-contrast) .doc-document-lock-icon,
:global(.doc-shell.is-high-contrast) .doc-document-lock-summary {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

:global(.doc-shell.is-high-contrast) .doc-document-lock-close,
:global(.doc-shell.is-high-contrast) .doc-document-lock-note,
:global(.doc-shell.is-high-contrast) .doc-document-lock-toggle-value {
  color: rgba(255, 255, 255, 0.8);
}

:global(.doc-shell.is-high-contrast) .doc-document-lock-summary-card,
:global(.doc-shell.is-high-contrast) .doc-document-lock-toggle {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

:global(.doc-shell.is-high-contrast) .doc-document-lock-toggle.is-active {
  background: rgba(255, 255, 255, 0.12);
}
</style>
