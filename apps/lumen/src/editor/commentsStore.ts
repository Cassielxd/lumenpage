import type { CommentStoreAdapter, CommentThreadRecord } from "lumenpage-extension-comment";
import { normalizeCommentId } from "lumenpage-extension-comment";

export type LumenCommentMessage = {
  id: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type LumenCommentThread = CommentThreadRecord & {
  id: string;
  anchorId: string;
  quote: string | null;
  status: "open" | "resolved";
  messages: LumenCommentMessage[];
  createdAt: string;
  updatedAt: string;
};

const listeners = new Set<() => void>();
const threads = new Map<string, LumenCommentThread>();

const emitChange = () => {
  for (const listener of Array.from(listeners)) {
    listener();
  }
};

const createLocalCommentId = (prefix: string) => {
  const randomUuid =
    typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : null;
  if (randomUuid) {
    return `${prefix}-${randomUuid}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeCommentBody = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const sortMessages = (items: Iterable<LumenCommentMessage>) =>
  Array.from(items).sort((left, right) =>
    String(left.createdAt || "").localeCompare(String(right.createdAt || ""))
  );

const sortThreads = (items: Iterable<LumenCommentThread>) =>
  Array.from(items).sort((left, right) =>
    String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt))
  );

const normalizeMessage = (message: Partial<LumenCommentMessage> | null | undefined) => {
  const body = normalizeCommentBody(message?.body);
  if (!body) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: normalizeCommentId(message?.id) || createLocalCommentId("comment"),
    authorId: normalizeCommentId(message?.authorId) || null,
    authorName: String(message?.authorName || "You").trim() || "You",
    body,
    createdAt: String(message?.createdAt || now),
    updatedAt: String(message?.updatedAt || message?.createdAt || now),
  } satisfies LumenCommentMessage;
};

export const lumenCommentsStore: CommentStoreAdapter & {
  listThreads: () => LumenCommentThread[];
  upsertThread: (
    thread: Partial<LumenCommentThread> & { id: string; anchorId: string }
  ) => LumenCommentThread | null;
  addMessage: (
    threadId: string,
    message: Partial<LumenCommentMessage> & { body: string }
  ) => LumenCommentMessage | null;
  removeThread: (threadId: string) => boolean;
  setResolved: (threadId: string, resolved: boolean) => boolean;
  clear: () => void;
} = {
  getThread(threadId: string) {
    const normalizedThreadId = normalizeCommentId(threadId);
    if (!normalizedThreadId) {
      return null;
    }
    return threads.get(normalizedThreadId) || null;
  },
  getThreads() {
    return sortThreads(threads.values());
  },
  subscribe(listener: () => void) {
    if (typeof listener !== "function") {
      return undefined;
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  listThreads() {
    return sortThreads(threads.values());
  },
  upsertThread(thread) {
    const id = normalizeCommentId(thread?.id);
    const anchorId = normalizeCommentId(thread?.anchorId);
    if (!id || !anchorId) {
      return null;
    }

    const now = new Date().toISOString();
    const existing = threads.get(id);
    const nextMessages = Array.isArray(thread?.messages)
      ? sortMessages(
          thread.messages
            .map((message) => normalizeMessage(message))
            .filter((message): message is LumenCommentMessage => message != null)
        )
      : existing?.messages || [];
    const nextThread: LumenCommentThread = {
      ...(existing || {}),
      ...(thread || {}),
      id,
      anchorId,
      quote: typeof thread?.quote === "string" ? thread.quote : existing?.quote || null,
      messages: nextMessages,
      status:
        thread?.status === "resolved"
          ? "resolved"
          : thread?.status === "open"
            ? "open"
            : existing?.status || "open",
      createdAt: existing?.createdAt || String(thread?.createdAt || now),
      updatedAt: String(thread?.updatedAt || now),
    };
    threads.set(id, nextThread);
    emitChange();
    return nextThread;
  },
  addMessage(threadId, message) {
    const normalizedThreadId = normalizeCommentId(threadId);
    if (!normalizedThreadId) {
      return null;
    }
    const existing = threads.get(normalizedThreadId);
    if (!existing) {
      return null;
    }
    const nextMessage = normalizeMessage(message);
    if (!nextMessage) {
      return null;
    }
    threads.set(normalizedThreadId, {
      ...existing,
      messages: sortMessages([...existing.messages, nextMessage]),
      updatedAt: nextMessage.updatedAt,
    });
    emitChange();
    return nextMessage;
  },
  removeThread(threadId: string) {
    const normalizedThreadId = normalizeCommentId(threadId);
    if (!normalizedThreadId) {
      return false;
    }
    const deleted = threads.delete(normalizedThreadId);
    if (deleted) {
      emitChange();
    }
    return deleted;
  },
  setResolved(threadId: string, resolved: boolean) {
    const normalizedThreadId = normalizeCommentId(threadId);
    if (!normalizedThreadId) {
      return false;
    }
    const existing = threads.get(normalizedThreadId);
    if (!existing) {
      return false;
    }
    threads.set(normalizedThreadId, {
      ...existing,
      status: resolved ? "resolved" : "open",
      resolved,
      updatedAt: new Date().toISOString(),
    });
    emitChange();
    return true;
  },
  clear() {
    if (threads.size === 0) {
      return;
    }
    threads.clear();
    emitChange();
  },
};
