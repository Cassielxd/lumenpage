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
      <div class="doc-comments-list">
        <button
          v-for="thread in threads"
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
              <span class="doc-comments-message-author">{{ message.authorName }}</span>
              <span class="doc-comments-message-time">
                {{ formatTimestamp(message.updatedAt || message.createdAt) }}
              </span>
            </div>
            <p class="doc-comments-message-body">{{ message.body }}</p>
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
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";

import type { LumenCommentThread } from "../editor/commentsStore";

const props = defineProps<{
  threads: readonly LumenCommentThread[];
  activeThreadId: string | null;
  canManage: boolean;
  locale: "zh-CN" | "en-US";
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "select", threadId: string): void;
  (event: "toggle-resolved", payload: { threadId: string; resolved: boolean }): void;
  (event: "reply", payload: { threadId: string; body: string }): void;
  (event: "delete", threadId: string): void;
}>();

const replyDrafts = reactive<Record<string, string>>({});

const texts = computed(() =>
  props.locale === "en-US"
    ? {
        title: "Comments",
        thread: "thread",
        threads: "threads",
        empty: "No comment threads yet.",
        open: "Open",
        resolved: "Resolved",
        emptyQuote: "No quoted text",
        jump: "Jump",
        resolve: "Resolve",
        reopen: "Reopen",
        delete: "Delete",
        emptyReplies: "No replies yet.",
        reply: "Reply",
        replyPlaceholder: "Write a reply",
        replyPlaceholderResolved: "Reopen the thread to reply.",
        replyPlaceholderReadonly: "Comments are unavailable in viewer mode.",
        replyHint: "Ctrl+Enter to reply",
        noMessages: "No messages",
        oneMessage: "1 message",
      }
    : {
        title: "\u8bc4\u8bba",
        thread: "\u6761\u7ebf\u7a0b",
        threads: "\u6761\u7ebf\u7a0b",
        empty: "\u6682\u65e0\u8bc4\u8bba\u7ebf\u7a0b",
        open: "\u8fdb\u884c\u4e2d",
        resolved: "\u5df2\u89e3\u51b3",
        emptyQuote: "\u65e0\u5f15\u7528\u6587\u672c",
        jump: "\u5b9a\u4f4d",
        resolve: "\u89e3\u51b3",
        reopen: "\u91cd\u65b0\u6253\u5f00",
        delete: "\u5220\u9664",
        emptyReplies: "\u6682\u65e0\u56de\u590d",
        reply: "\u56de\u590d",
        replyPlaceholder: "\u8f93\u5165\u56de\u590d",
        replyPlaceholderResolved: "\u5148\u91cd\u65b0\u6253\u5f00\u7ebf\u7a0b\u518d\u56de\u590d",
        replyPlaceholderReadonly: "\u67e5\u770b\u6a21\u5f0f\u4e0b\u65e0\u6cd5\u8bc4\u8bba",
        replyHint: "Ctrl+Enter \u53d1\u9001",
        noMessages: "\u6682\u65e0\u6d88\u606f",
        oneMessage: "1 \u6761\u6d88\u606f",
      }
);

const summaryLabel = computed(() => {
  const count = props.threads.length;
  if (count === 1) {
    return `1 ${texts.value.thread}`;
  }
  return `${count} ${texts.value.threads}`;
});

const selectedThreadId = computed(() => props.activeThreadId || props.threads[0]?.id || null);
const selectedThread = computed(
  () => props.threads.find((thread) => thread.id === selectedThreadId.value) || props.threads[0] || null
);

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

const formatMessageCount = (count: number) => {
  if (count <= 0) {
    return texts.value.noMessages;
  }
  if (count === 1) {
    return texts.value.oneMessage;
  }
  return props.locale === "en-US" ? `${count} messages` : `${count} \u6761\u6d88\u606f`;
};

const getReplyDraft = (threadId: string) => replyDrafts[threadId] || "";

const setReplyDraft = (threadId: string, value: string | number) => {
  replyDrafts[threadId] = String(value ?? "");
};

const isReplyDisabled = (thread: LumenCommentThread) =>
  !props.canManage || thread.status === "resolved";

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
</script>

<style scoped>
.doc-comments {
  width: 300px;
  min-width: 0;
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

.doc-comments-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.doc-comments-message-author {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
}

.doc-comments-message-time {
  color: #6b7280;
  font-size: 11px;
  white-space: nowrap;
}

.doc-comments-message-body {
  margin: 0;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
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
:global(.doc-shell.is-high-contrast) .doc-comments-item-time,
:global(.doc-shell.is-high-contrast) .doc-comments-item-summary,
:global(.doc-shell.is-high-contrast) .doc-comments-detail-time,
:global(.doc-shell.is-high-contrast) .doc-comments-message-time,
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
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-textarea__inner) {
  background: #000;
}

:global(.doc-shell.is-high-contrast) .doc-comments-empty,
:global(.doc-shell.is-high-contrast) .doc-comments-message-empty,
:global(.doc-shell.is-high-contrast) .doc-comments-message,
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-textarea__inner),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-divider) {
  border-color: #4b5563;
}

:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-button),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-textarea__inner),
:global(.doc-shell.is-high-contrast) .doc-comments :deep(.t-tag) {
  color: #fff;
}

@media (max-width: 1024px) {
  .doc-comments {
    width: 280px;
  }
}

@media (max-width: 768px) {
  .doc-comments {
    display: none;
  }
}
</style>
