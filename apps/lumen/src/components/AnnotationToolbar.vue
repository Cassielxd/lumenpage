<template>
  <div v-if="store.state.active" class="doc-annotation-toolbar">
    <div class="doc-annotation-panel">
      <div class="doc-annotation-section">
        <div class="doc-annotation-title">{{ texts.title }}</div>
        <div class="doc-annotation-meta">
          <span>{{ texts.page }} {{ currentPageLabel }}</span>
          <span>{{ texts.hint }}</span>
        </div>
        <div class="doc-annotation-author-row">
          <span class="doc-annotation-label">{{ texts.author }}</span>
          <span class="doc-annotation-author-chip">
            <span
              class="doc-annotation-author-dot"
              :style="{ '--annotation-author-color': currentAuthorColor }"
            ></span>
            {{ currentAuthorName }}
          </span>
        </div>
        <div class="doc-annotation-view-row">
          <button
            type="button"
            class="doc-annotation-chip"
            :class="{ 'is-active': store.state.viewMode === 'all' }"
            @click="store.setViewMode('all')"
          >
            {{ texts.viewAll }}
          </button>
          <button
            type="button"
            class="doc-annotation-chip"
            :class="{ 'is-active': store.state.viewMode === 'mine' }"
            @click="store.setViewMode('mine')"
          >
            {{ texts.viewMine }}
          </button>
        </div>
        <div v-if="authors.length > 0" class="doc-annotation-authors">
          <span class="doc-annotation-label">{{ texts.authors }}</span>
          <div class="doc-annotation-author-list">
            <span
              v-for="author in authors"
              :key="author.id || `${author.name}-${author.color}`"
              class="doc-annotation-author-chip"
            >
              <span
                class="doc-annotation-author-dot"
                :style="{ '--annotation-author-color': author.color || '#94a3b8' }"
              ></span>
              {{ author.name || texts.unknownAuthor }}
            </span>
          </div>
        </div>
      </div>

      <div class="doc-annotation-section">
        <div class="doc-annotation-label">{{ texts.tool }}</div>
        <div class="doc-annotation-tool-grid">
          <button
            v-for="item in toolItems"
            :key="item.value"
            type="button"
            class="doc-annotation-chip"
            :class="{ 'is-active': store.state.tool === item.value }"
            @click="store.setTool(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="doc-annotation-section">
        <div class="doc-annotation-label">{{ texts.color }}</div>
        <div class="doc-annotation-colors">
          <button
            v-for="color in store.palette"
            :key="color"
            type="button"
            class="doc-annotation-color"
            :class="{ 'is-active': store.state.color === color }"
            :style="{ '--annotation-color': color }"
            @click="store.setColor(color)"
          ></button>
        </div>
      </div>

      <div class="doc-annotation-section">
        <div class="doc-annotation-slider-row">
          <span class="doc-annotation-label">{{ texts.size }}</span>
          <span class="doc-annotation-value">{{ store.state.lineWidth }}</span>
        </div>
        <input
          class="doc-annotation-slider"
          type="range"
          min="2"
          max="18"
          step="1"
          :value="store.state.lineWidth"
          @input="handleLineWidthInput"
        />
      </div>

      <div class="doc-annotation-section">
        <div class="doc-annotation-actions">
          <button
            type="button"
            class="doc-annotation-action"
            :disabled="store.state.historyDepth === 0"
            @click="store.undo()"
          >
            {{ texts.undo }}
          </button>
          <button
            type="button"
            class="doc-annotation-action"
            :disabled="store.state.currentPageIndex == null || store.state.items.length === 0"
            @click="store.clearPage(store.state.currentPageIndex)"
          >
            {{ texts.clearPage }}
          </button>
          <button
            type="button"
            class="doc-annotation-action is-danger"
            :disabled="!hasMineAnnotations"
            @click="store.clearMine()"
          >
            {{ texts.clearMine }}
          </button>
          <button
            v-if="!store.isCollaborationBacked()"
            type="button"
            class="doc-annotation-action is-danger"
            :disabled="store.state.items.length === 0"
            @click="store.clearAll()"
          >
            {{ texts.clearAll }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { AnnotationTool } from "../annotation/annotationTypes";
import type { AnnotationAuthor, LumenAnnotationStore } from "../annotation/annotationStore";
import { coercePlaygroundLocale, createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

const props = defineProps<{
  locale?: PlaygroundLocale | string;
  store: LumenAnnotationStore;
}>();

const currentLocale = computed<PlaygroundLocale>(() => coercePlaygroundLocale(props.locale));
const texts = computed(() => createPlaygroundI18n(currentLocale.value).annotationPanel);
const currentPageLabel = computed(() =>
  props.store.state.currentPageIndex == null ? "-" : String(props.store.state.currentPageIndex + 1)
);
const currentAuthorName = computed(
  () => props.store.state.currentAuthorName || texts.value.unknownAuthor
);
const currentAuthorColor = computed(
  () => props.store.state.currentAuthorColor || "#94a3b8"
);
const authors = computed<AnnotationAuthor[]>(() => props.store.listAuthors());
const hasMineAnnotations = computed(() =>
  props.store.state.items.some((item) => props.store.isItemOwnedByCurrentAuthor(item))
);
const toolItems = computed<Array<{ value: AnnotationTool; label: string }>>(() => [
  { value: "pen", label: texts.value.pen },
  { value: "highlighter", label: texts.value.highlighter },
  { value: "line", label: texts.value.line },
  { value: "rect", label: texts.value.rect },
  { value: "eraser", label: texts.value.eraser },
]);

const handleLineWidthInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  props.store.setLineWidth(Number(target?.value));
};
</script>

<style scoped>
.doc-annotation-toolbar {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  background: #ffffff;
}

.doc-annotation-panel {
  width: 100%;
  min-height: 0;
  overflow: auto;
  padding: 14px;
  background: #ffffff;
}

.doc-annotation-section + .doc-annotation-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
}

.doc-annotation-title {
  font-size: 13px;
  line-height: 1.2;
  font-weight: 700;
  color: #0f172a;
}

.doc-annotation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: #64748b;
}

.doc-annotation-author-row,
.doc-annotation-view-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.doc-annotation-authors {
  margin-top: 10px;
}

.doc-annotation-author-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.doc-annotation-label {
  font-size: 11px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}

.doc-annotation-author-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #dbe4f0;
  color: #0f172a;
  font-size: 12px;
  line-height: 1;
}

.doc-annotation-author-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--annotation-author-color);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.doc-annotation-tool-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.doc-annotation-chip,
.doc-annotation-action {
  border: 1px solid #dbe4f0;
  background: #f8fafc;
  color: #0f172a;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.doc-annotation-chip:hover,
.doc-annotation-action:hover:not(:disabled) {
  border-color: #93c5fd;
  background: #eff6ff;
}

.doc-annotation-chip.is-active {
  border-color: #2563eb;
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

.doc-annotation-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.doc-annotation-color {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.92);
  background: var(--annotation-color);
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.42),
    0 6px 12px rgba(15, 23, 42, 0.12);
  cursor: pointer;
}

.doc-annotation-color.is-active {
  box-shadow:
    0 0 0 2px #2563eb,
    0 8px 16px rgba(37, 99, 235, 0.24);
}

.doc-annotation-slider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.doc-annotation-value {
  font-size: 12px;
  line-height: 1;
  color: #475569;
}

.doc-annotation-slider {
  width: 100%;
  margin-top: 10px;
}

.doc-annotation-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.doc-annotation-action.is-danger {
  color: #b91c1c;
}

.doc-annotation-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

:global(.doc-shell.is-high-contrast) .doc-annotation-panel {
  background: #000000;
  color: #ffffff;
}

:global(.doc-shell.is-high-contrast) .doc-annotation-toolbar {
  background: #000000;
}

:global(.doc-shell.is-high-contrast) .doc-annotation-chip,
:global(.doc-shell.is-high-contrast) .doc-annotation-action,
:global(.doc-shell.is-high-contrast) .doc-annotation-author-chip {
  background: #0f172a;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.24);
}

:global(.doc-shell.is-high-contrast) .doc-annotation-chip.is-active {
  background: #1d4ed8;
  color: #ffffff;
  border-color: #93c5fd;
}
</style>
