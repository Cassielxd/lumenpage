<template>
  <aside class="doc-track-changes">
    <div class="doc-track-changes-header">
      <div class="doc-track-changes-heading">
        <span class="doc-track-changes-title">{{ texts.title }}</span>
        <span class="doc-track-changes-summary">{{ summaryLabel }}</span>
      </div>
      <button type="button" class="doc-track-changes-close" @click="$emit('close')">x</button>
    </div>

    <div v-if="changes.length === 0" class="doc-track-changes-empty">
      {{ enabled ? texts.emptyEnabled : texts.emptyDisabled }}
    </div>

    <template v-else>
      <div class="doc-track-changes-toolbar">
        <div class="doc-track-changes-toolbar-main">
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

        <t-input
          class="doc-track-changes-search"
          size="small"
          clearable
          :model-value="searchQuery"
          :placeholder="texts.searchPlaceholder"
          @update:model-value="handleSearchQueryChange"
        />

        <div class="doc-track-changes-filters">
          <t-button
            size="small"
            variant="outline"
            :theme="typeFilter === 'all' ? 'primary' : 'default'"
            @click="typeFilter = 'all'"
          >
            {{ texts.all }} ({{ changes.length }})
          </t-button>
          <t-button
            size="small"
            variant="outline"
            :theme="typeFilter === 'replace' ? 'primary' : 'default'"
            @click="typeFilter = 'replace'"
          >
            {{ texts.replace }} ({{ replaceChangeCount }})
          </t-button>
          <t-button
            size="small"
            variant="outline"
            :theme="typeFilter === 'insert' ? 'primary' : 'default'"
            @click="typeFilter = 'insert'"
          >
            {{ texts.insert }} ({{ insertChangeCount }})
          </t-button>
          <t-button
            size="small"
            variant="outline"
            :theme="typeFilter === 'delete' ? 'primary' : 'default'"
            @click="typeFilter = 'delete'"
          >
            {{ texts.delete }} ({{ deleteChangeCount }})
          </t-button>
        </div>
      </div>

      <div v-if="filteredChanges.length === 0" class="doc-track-changes-empty is-filtered">
        {{ texts.filteredEmpty }}
      </div>

      <template v-else>
        <div class="doc-track-changes-list">
          <button
            v-for="change in filteredChanges"
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
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import type { TrackChangeRecord } from "lumenpage-extension-track-change";

type TrackChangeFilter = "all" | "insert" | "delete" | "replace";

const props = defineProps<{
  changes: readonly TrackChangeRecord[];
  activeChangeId: string | null;
  enabled: boolean;
  canManage: boolean;
  locale: "zh-CN" | "en-US";
}>();

defineEmits<{
  (event: "close"): void;
  (event: "select", changeId: string): void;
  (event: "accept", changeId: string): void;
  (event: "reject", changeId: string): void;
  (event: "accept-all"): void;
  (event: "reject-all"): void;
}>();

const searchQuery = ref("");
const typeFilter = ref<TrackChangeFilter>("all");

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
        filteredEmpty: "No changes match the current filter.",
        searchPlaceholder: "Search changes",
        all: "All",
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
        title: "\u4fee\u8ba2",
        change: "\u6761\u4fee\u8ba2",
        changes: "\u6761\u4fee\u8ba2",
        enabled: "\u4fee\u8ba2\u4e2d",
        disabled: "\u4fee\u8ba2\u5173\u95ed",
        emptyEnabled: "\u5df2\u5f00\u542f\u4fee\u8ba2\uff0c\u65b0\u7684\u7f16\u8f91\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002",
        emptyDisabled: "\u6682\u65e0\u4fee\u8ba2\u8bb0\u5f55\u3002",
        filteredEmpty: "\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u7684\u4fee\u8ba2\u3002",
        searchPlaceholder: "\u641c\u7d22\u4fee\u8ba2",
        all: "\u5168\u90e8",
        acceptAll: "\u5168\u90e8\u63a5\u53d7",
        rejectAll: "\u5168\u90e8\u62d2\u7edd",
        accept: "\u63a5\u53d7",
        reject: "\u62d2\u7edd",
        jump: "\u5b9a\u4f4d",
        deletedPrefix: "\u5220\u9664\uff1a",
        insertedPrefix: "\u65b0\u589e\uff1a",
        deletedLabel: "\u5220\u9664\u5185\u5bb9",
        insertedLabel: "\u65b0\u589e\u5185\u5bb9",
        replace: "\u66ff\u6362",
        insert: "\u65b0\u589e",
        delete: "\u5220\u9664",
        unknownAuthor: "\u672a\u77e5\u7528\u6237",
      }
);

const normalizeSearchValue = (value: unknown) => String(value || "").trim().toLowerCase();

const resolveChangeFilter = (change: TrackChangeRecord): Exclude<TrackChangeFilter, "all"> => {
  const hasInsert = change.kinds.includes("insert");
  const hasDelete = change.kinds.includes("delete");
  if (hasInsert && hasDelete) {
    return "replace";
  }
  return hasInsert ? "insert" : "delete";
};

const doesChangeMatchSearch = (change: TrackChangeRecord, query: string) => {
  if (!query) {
    return true;
  }
  const searchFields = [
    change.changeId,
    change.userName,
    change.insertedText,
    change.deletedText,
  ];
  return searchFields.some((field) => normalizeSearchValue(field).includes(query));
};

const insertChangeCount = computed(
  () => props.changes.filter((change) => resolveChangeFilter(change) === "insert").length
);
const deleteChangeCount = computed(
  () => props.changes.filter((change) => resolveChangeFilter(change) === "delete").length
);
const replaceChangeCount = computed(
  () => props.changes.filter((change) => resolveChangeFilter(change) === "replace").length
);

const filteredChanges = computed(() => {
  const query = normalizeSearchValue(searchQuery.value);
  return props.changes.filter((change) => {
    if (typeFilter.value !== "all" && resolveChangeFilter(change) !== typeFilter.value) {
      return false;
    }
    return doesChangeMatchSearch(change, query);
  });
});

const summaryLabel = computed(() => {
  const totalCount = props.changes.length;
  const visibleCount = filteredChanges.value.length;
  if (visibleCount === totalCount) {
    if (totalCount === 1) {
      return `1 ${texts.value.change}`;
    }
    return `${totalCount} ${texts.value.changes}`;
  }
  return props.locale === "en-US"
    ? `${visibleCount} of ${totalCount} ${texts.value.changes}`
    : `\u663e\u793a ${visibleCount} / ${totalCount} ${texts.value.changes}`;
});

const selectedChangeId = computed(() => {
  if (
    props.activeChangeId &&
    filteredChanges.value.some((change) => change.changeId === props.activeChangeId)
  ) {
    return props.activeChangeId;
  }
  return filteredChanges.value[0]?.changeId || null;
});

const selectedChange = computed(
  () =>
    filteredChanges.value.find((change) => change.changeId === selectedChangeId.value) ||
    filteredChanges.value[0] ||
    null
);

const resolveChangeLabel = (change: TrackChangeRecord) => {
  const filter = resolveChangeFilter(change);
  if (filter === "replace") {
    return texts.value.replace;
  }
  if (filter === "insert") {
    return texts.value.insert;
  }
  return texts.value.delete;
};

const resolveChangeTheme = (change: TrackChangeRecord) => {
  const filter = resolveChangeFilter(change);
  if (filter === "replace") {
    return "warning";
  }
  return filter === "insert" ? "success" : "danger";
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
    return props.locale === "en-US" ? "(empty)" : "\uff08\u7a7a\uff09";
  }
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
};

const handleSearchQueryChange = (value: string | number) => {
  searchQuery.value = String(value ?? "");
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
.doc-track-changes-item-meta,
.doc-track-changes-detail-header,
.doc-track-changes-detail-actions,
.doc-track-changes-toolbar-main {
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
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 4px 10px;
}

.doc-track-changes-toolbar-actions,
.doc-track-changes-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.doc-track-changes-search {
  width: 100%;
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

.doc-track-changes-empty.is-filtered {
  min-height: 92px;
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
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-divider),
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-input__wrap) {
  border-color: #4b5563;
}

:global(.doc-shell.is-high-contrast) .doc-track-changes-item:hover,
:global(.doc-shell.is-high-contrast) .doc-track-changes-item.is-active,
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-block.is-delete,
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-block.is-insert,
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-input__wrap) {
  background: #000;
}

:global(.doc-shell.is-high-contrast) .doc-track-changes-item-text.is-delete,
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-block.is-delete .doc-track-changes-detail-text,
:global(.doc-shell.is-high-contrast) .doc-track-changes-item-text.is-insert,
:global(.doc-shell.is-high-contrast) .doc-track-changes-detail-block.is-insert .doc-track-changes-detail-text,
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-tag),
:global(.doc-shell.is-high-contrast) .doc-track-changes :deep(.t-input__inner) {
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
