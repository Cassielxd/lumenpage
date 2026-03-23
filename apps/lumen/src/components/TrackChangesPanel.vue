<template>
  <aside class="doc-track-changes">
    <div class="doc-track-changes-header">
      <div class="doc-track-changes-heading">
        <span class="doc-track-changes-title">{{ texts.title }}</span>
        <span class="doc-track-changes-summary">{{ summaryLabel }}</span>
      </div>
      <button type="button" class="doc-track-changes-close" @click="$emit('close')">x</button>
    </div>

    <div class="doc-track-changes-toolbar">
      <t-tag size="small" variant="light" :theme="enabled ? 'success' : 'default'">
        {{ enabled ? texts.enabled : texts.disabled }}
      </t-tag>
      <div class="doc-track-changes-toolbar-actions">
        <t-button
          size="small"
          variant="outline"
          :disabled="!canManage || changes.length === 0"
          @click="$emit('accept-all')"
        >
          {{ texts.acceptAll }}
        </t-button>
        <t-button
          size="small"
          theme="danger"
          variant="outline"
          :disabled="!canManage || changes.length === 0"
          @click="$emit('reject-all')"
        >
          {{ texts.rejectAll }}
        </t-button>
      </div>
    </div>

    <div v-if="changes.length === 0" class="doc-track-changes-empty">
      {{ enabled ? texts.emptyEnabled : texts.emptyDisabled }}
    </div>

    <template v-else>
      <div class="doc-track-changes-list">
        <button
          v-for="change in changes"
          :key="change.changeId"
          type="button"
          class="doc-track-changes-item"
          :class="{ 'is-active': change.changeId === selectedChangeId }"
          @click="$emit('select', change.changeId)"
        >
          <div class="doc-track-changes-item-meta">
            <t-tag size="small" variant="light" :theme="resolveChangeTheme(change)">
              {{ resolveChangeLabel(change) }}
            </t-tag>
            <span class="doc-track-changes-item-time">{{ formatTimestamp(change.createdAt) }}</span>
          </div>
          <p v-if="change.deletedText" class="doc-track-changes-item-text is-delete">
            {{ texts.deletedPrefix }} {{ formatExcerpt(change.deletedText) }}
          </p>
          <p v-if="change.insertedText" class="doc-track-changes-item-text is-insert">
            {{ texts.insertedPrefix }} {{ formatExcerpt(change.insertedText) }}
          </p>
          <span class="doc-track-changes-item-author">{{ change.userName || texts.unknownAuthor }}</span>
        </button>
      </div>

      <div v-if="selectedChange" class="doc-track-changes-detail">
        <t-divider class="doc-track-changes-divider" />
        <div class="doc-track-changes-detail-header">
          <t-tag size="small" variant="light" :theme="resolveChangeTheme(selectedChange)">
            {{ resolveChangeLabel(selectedChange) }}
          </t-tag>
          <span class="doc-track-changes-detail-time">
            {{ formatTimestamp(selectedChange.createdAt) }}
          </span>
        </div>
        <div class="doc-track-changes-detail-body">
          <div v-if="selectedChange.deletedText" class="doc-track-changes-detail-block is-delete">
            <div class="doc-track-changes-detail-label">{{ texts.deletedLabel }}</div>
            <p class="doc-track-changes-detail-text">{{ selectedChange.deletedText }}</p>
          </div>
          <div v-if="selectedChange.insertedText" class="doc-track-changes-detail-block is-insert">
            <div class="doc-track-changes-detail-label">{{ texts.insertedLabel }}</div>
            <p class="doc-track-changes-detail-text">{{ selectedChange.insertedText }}</p>
          </div>
        </div>
        <div class="doc-track-changes-detail-actions">
          <t-button size="small" variant="outline" @click="$emit('select', selectedChange.changeId)">
            {{ texts.jump }}
          </t-button>
          <t-button
            size="small"
            variant="outline"
            :disabled="!canManage"
            @click="$emit('accept', selectedChange.changeId)"
          >
            {{ texts.accept }}
          </t-button>
          <t-button
            size="small"
            theme="danger"
            variant="outline"
            :disabled="!canManage"
            @click="$emit('reject', selectedChange.changeId)"
          >
            {{ texts.reject }}
          </t-button>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { TrackChangeRecord } from "lumenpage-extension-track-change";

const props = defineProps<{
  changes: readonly TrackChangeRecord[];
  activeChangeId: string | null;
  enabled: boolean;
  canManage: boolean;
  locale: "zh-CN" | "en-US";
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "select", changeId: string): void;
  (event: "accept", changeId: string): void;
  (event: "reject", changeId: string): void;
  (event: "accept-all"): void;
  (event: "reject-all"): void;
}>();

const texts = computed(() =>
  props.locale === "en-US"
    ? {
        title: "Changes",
        change: "change",
        changes: "changes",
        enabled: "Tracking On",
        disabled: "Tracking Off",
        emptyEnabled: "Track changes is on. New edits will appear here.",
        emptyDisabled: "No tracked changes yet.",
        acceptAll: "Accept All",
        rejectAll: "Reject All",
        accept: "Accept",
        reject: "Reject",
        jump: "Jump",
        deletedPrefix: "Delete:",
        insertedPrefix: "Insert:",
        deletedLabel: "Deleted",
        insertedLabel: "Inserted",
        replace: "Replace",
        insert: "Insert",
        delete: "Delete",
        unknownAuthor: "Unknown",
      }
    : {
        title: "修订",
        change: "条修订",
        changes: "条修订",
        enabled: "修订中",
        disabled: "修订关闭",
        emptyEnabled: "已开启修订，新的编辑会显示在这里。",
        emptyDisabled: "暂无修订记录。",
        acceptAll: "全部接受",
        rejectAll: "全部拒绝",
        accept: "接受",
        reject: "拒绝",
        jump: "定位",
        deletedPrefix: "删除：",
        insertedPrefix: "新增：",
        deletedLabel: "删除内容",
        insertedLabel: "新增内容",
        replace: "替换",
        insert: "新增",
        delete: "删除",
        unknownAuthor: "未知用户",
      }
);

const summaryLabel = computed(() => {
  const count = props.changes.length;
  if (count === 1) {
    return `1 ${texts.value.change}`;
  }
  return `${count} ${texts.value.changes}`;
});

const selectedChangeId = computed(() => props.activeChangeId || props.changes[0]?.changeId || null);
const selectedChange = computed(
  () => props.changes.find((change) => change.changeId === selectedChangeId.value) || props.changes[0] || null
);

const resolveChangeLabel = (change: TrackChangeRecord) => {
  const hasInsert = change.kinds.includes("insert");
  const hasDelete = change.kinds.includes("delete");
  if (hasInsert && hasDelete) {
    return texts.value.replace;
  }
  if (hasInsert) {
    return texts.value.insert;
  }
  return texts.value.delete;
};

const resolveChangeTheme = (change: TrackChangeRecord) => {
  const hasInsert = change.kinds.includes("insert");
  const hasDelete = change.kinds.includes("delete");
  if (hasInsert && hasDelete) {
    return "warning";
  }
  return hasInsert ? "success" : "danger";
};

const formatTimestamp = (value: string | null | undefined) => {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) {
    return "--";
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(time));
  } catch (_error) {
    return new Date(time).toISOString();
  }
};

const formatExcerpt = (value: string | null | undefined) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return props.locale === "en-US" ? "(empty)" : "（空）";
  }
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
};
</script>

<style scoped>
.doc-track-changes {
  width: 100%;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
  border-left: 1px solid #e5e7eb;
  background: #ffffff;
  overflow: auto;
  padding: 12px 10px;
}

.doc-track-changes-header,
.doc-track-changes-toolbar,
.doc-track-changes-item-meta,
.doc-track-changes-detail-header,
.doc-track-changes-detail-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.doc-track-changes-header {
  margin: 2px 4px 8px;
}

.doc-track-changes-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.doc-track-changes-title {
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.doc-track-changes-summary,
.doc-track-changes-item-time,
.doc-track-changes-item-author,
.doc-track-changes-detail-time {
  color: #6b7280;
  font-size: 12px;
}

.doc-track-changes-close {
  border: 0;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.doc-track-changes-close:hover {
  color: #111827;
}

.doc-track-changes-toolbar {
  margin: 0 4px 10px;
}

.doc-track-changes-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-track-changes-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  color: #6b7280;
  font-size: 13px;
  text-align: center;
  padding: 16px 12px;
}

.doc-track-changes-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.doc-track-changes-item {
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  padding: 8px;
  cursor: pointer;
}

.doc-track-changes-item:hover {
  background: #eff6ff;
}

.doc-track-changes-item.is-active {
  background: #dbeafe;
}

.doc-track-changes-item-text,
.doc-track-changes-detail-text {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.doc-track-changes-item-text.is-delete,
.doc-track-changes-detail-block.is-delete .doc-track-changes-detail-text {
  color: #b91c1c;
}

.doc-track-changes-item-text.is-insert,
.doc-track-changes-detail-block.is-insert .doc-track-changes-detail-text {
  color: #15803d;
}

.doc-track-changes-item-author {
  display: inline-block;
  margin-top: 6px;
}

.doc-track-changes-detail {
  padding: 0 4px 4px;
}

.doc-track-changes-divider {
  margin: 8px 0;
}

.doc-track-changes-detail-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.doc-track-changes-detail-block {
  border-radius: 8px;
  padding: 10px 12px;
}

.doc-track-changes-detail-block.is-delete {
  background: rgba(254, 226, 226, 0.7);
}

.doc-track-changes-detail-block.is-insert {
  background: rgba(220, 252, 231, 0.7);
}

.doc-track-changes-detail-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.doc-track-changes-detail-actions {
  flex-wrap: wrap;
  margin-top: 12px;
}

:global(.doc-shell.is-high-contrast) .doc-track-changes {
  background: #000;
  border-color: #fff;
}

:global(.doc-shell.is-high-contrast) .doc-track-changes-title,
:global(.doc-shell.is-high-contrast) .doc-track-changes-close:hover,
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-label {
  color: #fff;
}

:global(.doc-shell.is-high-contrast) .doc-track-changes-summary,
:global(.doc-shell.is-high-contrast) .doc-track-changes-close,
:global(.doc-shell.is-high-contrast) .doc-track-changes-item-time,
:global(.doc-shell.is-high-contrast) .doc-track-changes-item-author,
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-time,
:global(.doc-shell.is-high-contrast) .doc-track-changes-empty {
  color: #d1d5db;
}

:global(.doc-shell.is-high-contrast) .doc-track-changes-empty,
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-divider) {
  border-color: #4b5563;
}

:global(.doc-shell.is-high-contrast) .doc-track-changes-item:hover,
:global(.doc-shell.is-high-contrast) .doc-track-changes-item.is-active,
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-block.is-delete,
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-block.is-insert {
  background: #000;
}

:global(.doc-shell.is-high-contrast) .doc-track-changes-item-text.is-delete,
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-block.is-delete .doc-track-changes-detail-text,
:global(.doc-shell.is-high-contrast) .doc-track-changes-item-text.is-insert,
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-block.is-insert .doc-track-changes-detail-text,
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-tag) {
  color: #fff;
}

@media (max-width: 1024px) {
  .doc-track-changes {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .doc-track-changes {
    display: none;
  }
}
</style>
