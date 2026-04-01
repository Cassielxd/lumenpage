<template>
  <aside class="doc-comments">
    <div class="doc-comments-header">
      <div class="doc-comments-heading">
        <span class="doc-comments-title">{{ texts.title }}</span>
        <span class="doc-comments-summary">{{ summaryLabel }}</span>
      </div>
      <button type="button" class="doc-comments-close" @click="$emit('close')">x</button>
    </div>

    <div v-if="threads.length === 0" class="doc-comments-empty">
      {{ texts.empty }}
    </div>

    <template v-else>
      <div class="doc-comments-toolbar">
        <t-input
          class="doc-comments-search"
          size="small"
          clearable
          :model-value="searchQuery"
          :placeholder="texts.searchPlaceholder"
          @update:model-value="handleSearchQueryChange"
        />
        <div class="doc-comments-filters">
          <t-button
            size="small"
            variant="outline"
            :theme="statusFilter === 'all' ? 'primary' : 'default'"
            @click="statusFilter = 'all'"
          >
            {{ texts.all }} ({{ threads.length }})
          </t-button>
          <t-button
            size="small"
            variant="outline"
            :theme="statusFilter === 'open' ? 'primary' : 'default'"
            @click="statusFilter = 'open'"
          >
            {{ texts.open }} ({{ openThreadCount }})
          </t-button>
          <t-button
            size="small"
            variant="outline"
            :theme="statusFilter === 'resolved' ? 'primary' : 'default'"
            @click="statusFilter = 'resolved'"
          >
            {{ texts.resolved }} ({{ resolvedThreadCount }})
          </t-button>
        </div>
      </div>

      <div v-if="filteredThreads.length === 0" class="doc-comments-empty is-filtered">
        {{ texts.filteredEmpty }}
      </div>

      <template v-else>
        <div class="doc-comments-list">
          <div
            v-for="group in threadGroups"
            :key="group.key"
            class="doc-comments-group"
          >
            <div class="doc-comments-group-header">
              <span class="doc-comments-group-title">{{ group.label }}</span>
              <span class="doc-comments-group-count">{{ group.threads.length }}</span>
            </div>
            <button
              v-for="thread in group.threads"
              :key="thread.id"
              type="button"
              class="doc-comments-item"
              :class="{
                'is-active': thread.id === selectedThreadId,
                'is-resolved': thread.status === 'resolved',
              }"
              @click="$emit('select', thread.id)"
            >
              <div class="doc-comments-item-meta">
                <t-tag
                  size="small"
                  variant="light"
                  :theme="thread.status === 'resolved' ? 'default' : 'warning'"
                >
                  {{ thread.status === "resolved" ? texts.resolved : texts.open }}
                </t-tag>
                <span class="doc-comments-item-time">{{ formatTimestamp(thread.updatedAt) }}</span>
              </div>
              <p class="doc-comments-item-quote" :class="{ 'is-empty': !thread.quote }">
                {{ thread.quote || texts.emptyQuote }}
              </p>
              <span class="doc-comments-item-summary">{{ formatMessageCount(thread.messages.length) }}</span>
            </button>
          </div>
        </div>

        <div v-if="selectedThread" class="doc-comments-detail">
          <t-divider class="doc-comments-divider" />

          <div class="doc-comments-detail-header">
            <t-tag
              size="small"
              variant="light"
              :theme="selectedThread.status === 'resolved' ? 'default' : 'warning'"
            >
              {{ selectedThread.status === "resolved" ? texts.resolved : texts.open }}
            </t-tag>
            <span class="doc-comments-detail-time">{{ formatTimestamp(selectedThread.updatedAt) }}</span>
          </div>

          <p class="doc-comments-detail-quote" :class="{ 'is-empty': !selectedThread.quote }">
            {{ selectedThread.quote || texts.emptyQuote }}
          </p>

          <div class="doc-comments-detail-actions">
            <t-button size="small" variant="outline" @click="$emit('select', selectedThread.id)">
              {{ texts.jump }}
            </t-button>
            <t-button
              size="small"
              variant="outline"
              :disabled="!canManage"
              @click="
                $emit('toggle-resolved', {
                  threadId: selectedThread.id,
                  resolved: selectedThread.status !== 'resolved',
                })
              "
            >
              {{ selectedThread.status === "resolved" ? texts.reopen : texts.resolve }}
            </t-button>
            <t-button
              size="small"
              theme="danger"
              variant="outline"
              :disabled="!canManage"
              @click="$emit('delete', selectedThread.id)"
            >
              {{ texts.delete }}
            </t-button>
          </div>

          <div class="doc-comments-message-list">
            <div v-if="selectedThread.messages.length === 0" class="doc-comments-message-empty">
              {{ texts.emptyReplies }}
            </div>
            <div
              v-for="message in selectedThread.messages"
              :key="message.id"
              class="doc-comments-message"
            >
              <div class="doc-comments-message-meta">
                <div class="doc-comments-message-meta-main">
                  <span class="doc-comments-message-author">{{ message.authorName }}</span>
                  <span v-if="isMessageEdited(message)" class="doc-comments-message-edited">
                    {{ texts.edited }}
                  </span>
                </div>
                <div class="doc-comments-message-meta-side">
                  <span class="doc-comments-message-time">
                    {{ formatTimestamp(message.updatedAt || message.createdAt) }}
                  </span>
                  <div v-if="canManageMessage(message)" class="doc-comments-message-actions">
                    <t-button
                      size="small"
                      variant="text"
                      @click="startEditingMessage(message.id, message.body)"
                    >
                      {{ texts.edit }}
                    </t-button>
                    <t-button
                      size="small"
                      theme="danger"
                      variant="text"
                      @click="
                        $emit('delete-message', {
                          threadId: selectedThread.id,
                          messageId: message.id,
                        })
                      "
                    >
                      {{ texts.delete }}
                    </t-button>
                  </div>
                </div>
              </div>
              <template v-if="editingMessageId === message.id">
                <t-textarea
                  class="doc-comments-message-editor"
                  :model-value="getMessageDraft(message.id)"
                  :autosize="{ minRows: 2, maxRows: 6 }"
                  @update:model-value="(value) => setMessageDraft(message.id, value)"
                  @keydown="handleMessageEditorKeydown($event, selectedThread.id, message.id)"
                />
                <div class="doc-comments-message-editor-footer">
                  <span class="doc-comments-message-editor-hint">{{ texts.editHint }}</span>
                  <div class="doc-comments-message-editor-actions">
                    <t-button size="small" variant="outline" @click="cancelEditingMessage(message.id)">
                      {{ texts.cancel }}
                    </t-button>
                    <t-button
                      size="small"
                      theme="primary"
                      :disabled="!getMessageDraft(message.id).trim()"
                      @click="submitMessageEdit(selectedThread.id, message.id)"
                    >
                      {{ texts.save }}
                    </t-button>
                  </div>
                </div>
              </template>
              <p v-else class="doc-comments-message-body">{{ message.body }}</p>
            </div>
          </div>

          <t-divider class="doc-comments-divider" />

          <div class="doc-comments-composer">
            <div class="doc-comments-composer-label">{{ texts.reply }}</div>
            <t-textarea
              class="doc-comments-composer-input"
              :model-value="getReplyDraft(selectedThread.id)"
              :disabled="isReplyDisabled(selectedThread)"
              :placeholder="
                selectedThread.status === 'resolved'
                  ? texts.replyPlaceholderResolved
                  : canManage
                    ? texts.replyPlaceholder
                    : texts.replyPlaceholderReadonly
              "
              :autosize="{ minRows: 3, maxRows: 6 }"
              @update:model-value="(value) => setReplyDraft(selectedThread.id, value)"
              @keydown="handleReplyKeydown($event, selectedThread.id)"
            />
            <div class="doc-comments-composer-footer">
              <span class="doc-comments-composer-hint">{{ texts.replyHint }}</span>
              <t-button
                size="small"
                theme="primary"
                :disabled="isReplyDisabled(selectedThread) || !getReplyDraft(selectedThread.id).trim()"
                @click="submitReply(selectedThread.id)"
              >
                {{ texts.reply }}
              </t-button>
            </div>
          </div>
        </div>
      </template>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

import type { LumenCommentMessage, LumenCommentThread } from "../editor/commentsStore";
import { coercePlaygroundLocale, createPlaygroundI18n, type PlaygroundLocale } from "../editor/i18n";

type CommentStatusFilter = "all" | "open" | "resolved";

const props = defineProps<{
  threads: readonly LumenCommentThread[];
  activeThreadId: string | null;
  canManage: boolean;
  currentUserName: string;
  locale: PlaygroundLocale;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "select", threadId: string): void;
  (event: "toggle-resolved", payload: { threadId: string; resolved: boolean }): void;
  (event: "reply", payload: { threadId: string; body: string }): void;
  (event: "delete", threadId: string): void;
  (event: "edit-message", payload: { threadId: string; messageId: string; body: string }): void;
  (event: "delete-message", payload: { threadId: string; messageId: string }): void;
}>();

const replyDrafts = reactive<Record<string, string>>({});
const messageDrafts = reactive<Record<string, string>>({});
const editingMessageId = ref<string | null>(null);
const searchQuery = ref("");
const statusFilter = ref<CommentStatusFilter>("all");
const { t } = useI18n();
const currentLocale = computed<PlaygroundLocale>(() => coercePlaygroundLocale(props.locale));
const i18n = computed(() => createPlaygroundI18n(currentLocale.value));
const texts = computed(() => i18n.value.commentsPanel);

const normalizeSearchValue = (value: unknown) => String(value || "").trim().toLowerCase();

const doesThreadMatchSearch = (thread: LumenCommentThread, query: string) => {
  if (!query) {
    return true;
  }
  const searchFields = [
    thread.quote,
    thread.anchorId,
    ...thread.messages.flatMap((message) => [message.authorName, message.body]),
  ];
  return searchFields.some((field) => normalizeSearchValue(field).includes(query));
};

const openThreadCount = computed(
  () => props.threads.filter((thread) => thread.status !== "resolved").length
);
const resolvedThreadCount = computed(
  () => props.threads.filter((thread) => thread.status === "resolved").length
);

const filteredThreads = computed(() => {
  const query = normalizeSearchValue(searchQuery.value);
  return props.threads.filter((thread) => {
    if (statusFilter.value !== "all" && thread.status !== statusFilter.value) {
      return false;
    }
    return doesThreadMatchSearch(thread, query);
  });
});

const summaryLabel = computed(() => {
  const totalCount = props.threads.length;
  const visibleCount = filteredThreads.value.length;
  if (visibleCount === totalCount) {
    return totalCount === 1
      ? t("commentsPanel.threadSingle", { count: totalCount })
      : t("commentsPanel.threadPlural", { count: totalCount });
  }
  return t("commentsPanel.summaryVisible", { visible: visibleCount, total: totalCount });
});

const threadGroups = computed(() => {
  const groups: Array<{ key: string; label: string; threads: LumenCommentThread[] }> = [];
  const visibleThreads = filteredThreads.value;
  if (statusFilter.value === "all") {
    const openThreads = visibleThreads.filter((thread) => thread.status !== "resolved");
    const resolvedThreads = visibleThreads.filter((thread) => thread.status === "resolved");
    if (openThreads.length > 0) {
      groups.push({ key: "open", label: texts.value.open, threads: openThreads });
    }
    if (resolvedThreads.length > 0) {
      groups.push({ key: "resolved", label: texts.value.resolved, threads: resolvedThreads });
    }
    return groups;
  }
  if (visibleThreads.length > 0) {
    groups.push({
      key: statusFilter.value,
      label: statusFilter.value === "resolved" ? texts.value.resolved : texts.value.open,
      threads: visibleThreads,
    });
  }
  return groups;
});

const selectedThreadId = computed(() => props.activeThreadId || filteredThreads.value[0]?.id || null);
const selectedThread = computed(
  () =>
    filteredThreads.value.find((thread) => thread.id === selectedThreadId.value) ||
    filteredThreads.value[0] ||
    null
);

const formatTimestamp = (value: string | null | undefined) => {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) {
    return "--";
  }
  try {
    return new Intl.DateTimeFormat(currentLocale.value, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(time));
  } catch (_error) {
    return new Date(time).toISOString();
  }
};

const formatMessageCount = (count: number) => {
  if (count <= 0) {
    return texts.value.noMessages;
  }
  if (count === 1) {
    return texts.value.oneMessage;
  }
  return t("commentsPanel.messageCount", { count });
};

const getReplyDraft = (threadId: string) => replyDrafts[threadId] || "";

const setReplyDraft = (threadId: string, value: string | number) => {
  replyDrafts[threadId] = String(value ?? "");
};

const isReplyDisabled = (thread: LumenCommentThread) =>
  !props.canManage || thread.status === "resolved";

const normalizeUserName = (value: string | null | undefined) => String(value || "").trim().toLowerCase();

const canManageMessage = (message: LumenCommentMessage) => {
  if (!props.canManage) {
    return false;
  }
  const currentUser = normalizeUserName(props.currentUserName);
  if (!currentUser) {
    return true;
  }
  return normalizeUserName(message.authorName) === currentUser;
};

const isMessageEdited = (message: LumenCommentMessage) =>
  String(message.updatedAt || "") > String(message.createdAt || "");

const getMessageDraft = (messageId: string) => messageDrafts[messageId] || "";

const setMessageDraft = (messageId: string, value: string | number) => {
  messageDrafts[messageId] = String(value ?? "");
};

const startEditingMessage = (messageId: string, body: string) => {
  editingMessageId.value = messageId;
  setMessageDraft(messageId, body);
};

const cancelEditingMessage = (messageId: string) => {
  if (editingMessageId.value === messageId) {
    editingMessageId.value = null;
  }
  delete messageDrafts[messageId];
};

const submitMessageEdit = (threadId: string, messageId: string) => {
  const body = getMessageDraft(messageId).trim();
  if (!body) {
    return;
  }
  emit("edit-message", { threadId, messageId, body });
  cancelEditingMessage(messageId);
};

const handleMessageEditorKeydown = (
  event: KeyboardEvent,
  threadId: string,
  messageId: string
) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    submitMessageEdit(threadId, messageId);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    cancelEditingMessage(messageId);
  }
};

const submitReply = (threadId: string) => {
  const body = getReplyDraft(threadId).trim();
  if (!body) {
    return;
  }
  emit("reply", { threadId, body });
  replyDrafts[threadId] = "";
};

const handleReplyKeydown = (event: KeyboardEvent, threadId: string) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    submitReply(threadId);
  }
};

const handleSearchQueryChange = (value: string | number) => {
  searchQuery.value = String(value ?? "");
};
</script>

<style scoped>
.doc-comments {
  width: 100%;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
  border-left: 1px solid #e5e7eb;
  background: #ffffff;
  overflow: auto;
  padding: 12px 10px;
}

.doc-comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 2px 4px 8px;
}

.doc-comments-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.doc-comments-title {
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.doc-comments-summary {
  font-size: 12px;
  color: #6b7280;
}

.doc-comments-close {
  border: 0;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.doc-comments-close:hover {
  color: #111827;
}

.doc-comments-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 4px 10px;
}

.doc-comments-search {
  width: 100%;
}

.doc-comments-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.doc-comments-empty {
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

.doc-comments-empty.is-filtered {
  min-height: 72px;
  margin: 0 4px;
}

.doc-comments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-comments-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.doc-comments-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 4px 2px;
}

.doc-comments-group-title {
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.doc-comments-group-count {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
}

.doc-comments-item {
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  padding: 8px;
  cursor: pointer;
}

.doc-comments-item:hover {
  background: #eff6ff;
}

.doc-comments-item.is-active {
  background: #dbeafe;
}

.doc-comments-item.is-resolved {
  background: #f8fafc;
}

.doc-comments-item.is-active.is-resolved {
  background: #e2e8f0;
}

.doc-comments-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.doc-comments-item-time {
  color: #6b7280;
  font-size: 11px;
  white-space: nowrap;
}

.doc-comments-item-quote {
  margin: 0;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.doc-comments-item-quote.is-empty {
  color: #9ca3af;
  font-style: italic;
}

.doc-comments-item-summary {
  display: inline-block;
  margin-top: 6px;
  color: #6b7280;
  font-size: 11px;
}

.doc-comments-detail {
  padding: 0 4px 4px;
}

.doc-comments-divider {
  margin: 8px 0;
}

.doc-comments-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.doc-comments-detail-time {
  color: #6b7280;
  font-size: 11px;
  white-space: nowrap;
}

.doc-comments-detail-quote {
  margin: 10px 0 0;
  color: #111827;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.doc-comments-detail-quote.is-empty {
  color: #9ca3af;
  font-style: italic;
}

.doc-comments-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.doc-comments-message-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.doc-comments-message-empty {
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  padding: 12px;
  color: #6b7280;
  font-size: 12px;
  text-align: center;
}

.doc-comments-message {
  border-left: 2px solid #dbeafe;
  padding-left: 10px;
}

.doc-comments-message-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.doc-comments-message-meta-main,
.doc-comments-message-meta-side {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.doc-comments-message-meta-side {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.doc-comments-message-author {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
}

.doc-comments-message-edited {
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
}

.doc-comments-message-time {
  color: #6b7280;
  font-size: 11px;
  white-space: nowrap;
}

.doc-comments-message-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.doc-comments-message-body {
  margin: 0;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.doc-comments-message-editor {
  width: 100%;
}

.doc-comments-message-editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}

.doc-comments-message-editor-hint {
  color: #6b7280;
  font-size: 11px;
}

.doc-comments-message-editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-comments-composer-label {
  margin-bottom: 6px;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
}

.doc-comments-composer-input {
  width: 100%;
}

.doc-comments-composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}

.doc-comments-composer-hint {
  color: #6b7280;
  font-size: 11px;
}

:global(.doc-shell.is-high-contrast) .doc-comments {
  background: #000;
  border-color: #fff;
}

:global(.doc-shell.is-high-contrast) .doc-comments-title,
:global(.doc-shell.is-high-contrast) .doc-comments-item-quote,
:global(.doc-shell.is-high-contrast) .doc-comments-detail-quote,
:global(.doc-shell.is-high-contrast) .doc-comments-message-author,
:global(.doc-shell.is-high-contrast) .doc-comments-message-body,
:global(.doc-shell.is-high-contrast) .doc-comments-close:hover {
  color: #fff;
}

:global(.doc-shell.is-high-contrast) .doc-comments-summary,
:global(.doc-shell.is-high-contrast) .doc-comments-close,
:global(.doc-shell.is-high-contrast) .doc-comments-group-title,
:global(.doc-shell.is-high-contrast) .doc-comments-group-count,
:global(.doc-shell.is-high-contrast) .doc-comments-item-time,
:global(.doc-shell.is-high-contrast) .doc-comments-item-summary,
:global(.doc-shell.is-high-contrast) .doc-comments-detail-time,
:global(.doc-shell.is-high-contrast) .doc-comments-message-time,
:global(.doc-shell.is-high-contrast) .doc-comments-message-edited,
:global(.doc-shell.is-high-contrast) .doc-comments-message-editor-hint,
:global(.doc-shell.is-high-contrast) .doc-comments-composer-label,
:global(.doc-shell.is-high-contrast) .doc-comments-composer-hint,
:global(.doc-shell.is-high-contrast) .doc-comments-empty,
:global(.doc-shell.is-high-contrast) .doc-comments-message-empty {
  color: #d1d5db;
}

:global(.doc-shell.is-high-contrast) .doc-comments-item:hover,
:global(.doc-shell.is-high-contrast) .doc-comments-item.is-active,
:global(.doc-shell.is-high-contrast) .doc-comments-item.is-resolved,
:global(.doc-shell.is-high-contrast) .doc-comments-item.is-active.is-resolved,
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-input__wrap),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-textarea__inner) {
  background: #000;
}

:global(.doc-shell.is-high-contrast) .doc-comments-empty,
:global(.doc-shell.is-high-contrast) .doc-comments-message-empty,
:global(.doc-shell.is-high-contrast) .doc-comments-message,
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-input__wrap),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-textarea__inner),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-divider) {
  border-color: #4b5563;
}

:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-input__inner),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-textarea__inner),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-tag) {
  color: #fff;
}

@media (max-width: 1024px) {
  .doc-comments {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .doc-comments {
    display: none;
  }
}
</style>
