import type { CommentStoreAdapter, CommentThreadRecord } from "lumenpage-extension-comment";
import { normalizeCommentId } from "lumenpage-extension-comment";
import * as Y from "yjs";

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

type YjsCommentsBinding = {
  doc: Y.Doc;
  field: string;
  threads: Y.Map<Y.Map<unknown>>;
  observer: (events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => void;
};

const listeners = new Set<() => void>();
const localThreads = new Map<string, LumenCommentThread>();

let yjsBinding: YjsCommentsBinding | null = null;

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

const normalizeThreadStatus = (thread: Partial<LumenCommentThread> | null | undefined) => {
  if (thread?.status === "resolved" || thread?.resolved === true) {
    return "resolved";
  }
  if (thread?.status === "open" || thread?.resolved === false) {
    return "open";
  }
  return null;
};

const resolveThreadStatus = (
  thread: Partial<LumenCommentThread> | null | undefined,
  existingStatus?: "open" | "resolved" | null
) => normalizeThreadStatus(thread) || existingStatus || "open";

const getCommentsFieldKey = (field: string | null | undefined) =>
  `lumen-comments:${normalizeCommentId(field) || "default"}`;

const disconnectYjsBinding = () => {
  if (!yjsBinding) {
    return;
  }
  yjsBinding.threads.unobserveDeep(yjsBinding.observer);
  yjsBinding = null;
};

const isYjsBacked = () => yjsBinding != null;

const readString = (value: unknown) => (typeof value === "string" ? value : null);

const readYMessage = (value: unknown) => {
  if (!(value instanceof Y.Map)) {
    return null;
  }
  return normalizeMessage({
    id: value.get("id"),
    authorId: value.get("authorId"),
    authorName: value.get("authorName"),
    body: value.get("body"),
    createdAt: value.get("createdAt"),
    updatedAt: value.get("updatedAt"),
  });
};

const createYMessageMap = (message: LumenCommentMessage) => {
  const map = new Y.Map<unknown>();
  map.set("id", message.id);
  map.set("authorId", message.authorId);
  map.set("authorName", message.authorName);
  map.set("body", message.body);
  map.set("createdAt", message.createdAt);
  map.set("updatedAt", message.updatedAt);
  return map;
};

const ensureYMessagesArray = (threadMap: Y.Map<unknown>) => {
  const existing = threadMap.get("messages");
  if (existing instanceof Y.Array) {
    return existing as Y.Array<unknown>;
  }
  const next = new Y.Array<unknown>();
  threadMap.set("messages", next);
  return next;
};

const ensureYThreadMap = (threadId: string) => {
  const binding = yjsBinding;
  if (!binding) {
    return null;
  }
  const existing = binding.threads.get(threadId);
  if (existing instanceof Y.Map) {
    return existing as Y.Map<unknown>;
  }
  const next = new Y.Map<unknown>();
  next.set("id", threadId);
  next.set("messages", new Y.Array<unknown>());
  binding.threads.set(threadId, next);
  return next;
};

const readYThread = (threadId: string, value: unknown): LumenCommentThread | null => {
  if (!(value instanceof Y.Map)) {
    return null;
  }
  const normalizedId = normalizeCommentId(readString(value.get("id"))) || threadId;
  const anchorId = normalizeCommentId(readString(value.get("anchorId")));
  if (!normalizedId || !anchorId) {
    return null;
  }
  const messagesValue = value.get("messages");
  const messages =
    messagesValue instanceof Y.Array
      ? sortMessages(
          messagesValue
            .toArray()
            .map((message) => readYMessage(message))
            .filter((message): message is LumenCommentMessage => message != null)
        )
      : [];
  const createdAt = readString(value.get("createdAt")) || new Date().toISOString();
  const updatedAt = readString(value.get("updatedAt")) || createdAt;
  const status = value.get("status") === "resolved" || value.get("resolved") === true ? "resolved" : "open";
  return {
    id: normalizedId,
    anchorId,
    blockId: normalizeCommentId(value.get("blockId")) || null,
    quote: readString(value.get("quote")),
    status,
    resolved: status === "resolved",
    messages,
    createdAt,
    updatedAt,
  };
};

const listYThreads = () => {
  const binding = yjsBinding;
  if (!binding) {
    return [];
  }
  const threads: LumenCommentThread[] = [];
  binding.threads.forEach((value, threadId) => {
    const thread = readYThread(threadId, value);
    if (thread) {
      threads.push(thread);
    }
  });
  return sortThreads(threads);
};

const getYThread = (threadId: string) => {
  const binding = yjsBinding;
  if (!binding) {
    return null;
  }
  return readYThread(threadId, binding.threads.get(threadId));
};

const listLocalThreads = () => sortThreads(localThreads.values());

const getLocalThread = (threadId: string) => localThreads.get(threadId) || null;

const useLocalCommentsStore = ({ clear = false }: { clear?: boolean } = {}) => {
  disconnectYjsBinding();
  if (clear && localThreads.size > 0) {
    localThreads.clear();
  }
  emitChange();
};

const useYjsCommentsStore = (document: Y.Doc | null | undefined, field?: string | null) => {
  if (!document) {
    useLocalCommentsStore({ clear: true });
    return;
  }

  const normalizedField = normalizeCommentId(field) || "default";
  if (yjsBinding?.doc === document && yjsBinding.field === normalizedField) {
    return;
  }

  disconnectYjsBinding();

  const threads = document.getMap<Y.Map<unknown>>(getCommentsFieldKey(normalizedField));
  const observer = () => {
    emitChange();
  };

  threads.observeDeep(observer);
  yjsBinding = {
    doc: document,
    field: normalizedField,
    threads,
    observer,
  };
  emitChange();
};

const upsertLocalThread = (
  thread: Partial<LumenCommentThread> & { id: string; anchorId: string }
): LumenCommentThread | null => {
  const id = normalizeCommentId(thread?.id);
  const anchorId = normalizeCommentId(thread?.anchorId);
  if (!id || !anchorId) {
    return null;
  }

  const now = new Date().toISOString();
  const existing = localThreads.get(id);
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
    blockId:
      normalizeCommentId(thread?.blockId) ||
      normalizeCommentId(existing?.blockId) ||
      null,
    quote: typeof thread?.quote === "string" ? thread.quote : existing?.quote || null,
    messages: nextMessages,
    status: resolveThreadStatus(thread, existing?.status),
    resolved: resolveThreadStatus(thread, existing?.status) === "resolved",
    createdAt: existing?.createdAt || String(thread?.createdAt || now),
    updatedAt: String(thread?.updatedAt || now),
  };
  localThreads.set(id, nextThread);
  emitChange();
  return nextThread;
};

const upsertYThread = (
  thread: Partial<LumenCommentThread> & { id: string; anchorId: string }
): LumenCommentThread | null => {
  const id = normalizeCommentId(thread?.id);
  const anchorId = normalizeCommentId(thread?.anchorId);
  const binding = yjsBinding;
  if (!binding || !id || !anchorId) {
    return null;
  }

  const now = new Date().toISOString();
  let nextThread: LumenCommentThread | null = null;

  binding.doc.transact(() => {
    const threadMap = ensureYThreadMap(id);
    if (!threadMap) {
      return;
    }
    const existing = readYThread(id, threadMap);
    const status = resolveThreadStatus(thread, existing?.status);

    threadMap.set("id", id);
    threadMap.set("anchorId", anchorId);
    threadMap.set(
      "blockId",
      normalizeCommentId(thread?.blockId) || normalizeCommentId(existing?.blockId) || null
    );
    threadMap.set(
      "quote",
      typeof thread?.quote === "string" ? thread.quote : existing?.quote || null
    );
    threadMap.set("status", status);
    threadMap.set("resolved", status === "resolved");
    threadMap.set("createdAt", String(existing?.createdAt || thread?.createdAt || now));
    threadMap.set("updatedAt", String(thread?.updatedAt || now));

    if (Array.isArray(thread?.messages)) {
      const messagesArray = ensureYMessagesArray(threadMap);
      if (messagesArray.length > 0) {
        messagesArray.delete(0, messagesArray.length);
      }
      const nextMessages = sortMessages(
        thread.messages
          .map((message) => normalizeMessage(message))
          .filter((message): message is LumenCommentMessage => message != null)
      );
      if (nextMessages.length > 0) {
        messagesArray.push(nextMessages.map((message) => createYMessageMap(message)));
      }
    } else {
      ensureYMessagesArray(threadMap);
    }

    nextThread = readYThread(id, threadMap);
  }, "lumen-comments:upsert-thread");

  return nextThread;
};

const addLocalMessage = (
  threadId: string,
  message: Partial<LumenCommentMessage> & { body: string }
) => {
  const normalizedThreadId = normalizeCommentId(threadId);
  if (!normalizedThreadId) {
    return null;
  }
  const existing = localThreads.get(normalizedThreadId);
  if (!existing) {
    return null;
  }
  const nextMessage = normalizeMessage(message);
  if (!nextMessage) {
    return null;
  }
  localThreads.set(normalizedThreadId, {
    ...existing,
    messages: sortMessages([...existing.messages, nextMessage]),
    updatedAt: nextMessage.updatedAt,
  });
  emitChange();
  return nextMessage;
};

const addYMessage = (
  threadId: string,
  message: Partial<LumenCommentMessage> & { body: string }
) => {
  const normalizedThreadId = normalizeCommentId(threadId);
  const binding = yjsBinding;
  if (!binding || !normalizedThreadId) {
    return null;
  }
  const nextMessage = normalizeMessage(message);
  if (!nextMessage) {
    return null;
  }

  binding.doc.transact(() => {
    const threadMap = ensureYThreadMap(normalizedThreadId);
    if (!threadMap) {
      return;
    }
    const messagesArray = ensureYMessagesArray(threadMap);
    messagesArray.push([createYMessageMap(nextMessage)]);
    threadMap.set("updatedAt", nextMessage.updatedAt);
  }, "lumen-comments:add-message");

  return nextMessage;
};

const removeLocalThread = (threadId: string) => {
  const normalizedThreadId = normalizeCommentId(threadId);
  if (!normalizedThreadId) {
    return false;
  }
  const deleted = localThreads.delete(normalizedThreadId);
  if (deleted) {
    emitChange();
  }
  return deleted;
};

const removeYThread = (threadId: string) => {
  const normalizedThreadId = normalizeCommentId(threadId);
  const binding = yjsBinding;
  if (!binding || !normalizedThreadId) {
    return false;
  }
  const exists = binding.threads.has(normalizedThreadId);
  if (!exists) {
    return false;
  }
  binding.doc.transact(() => {
    binding.threads.delete(normalizedThreadId);
  }, "lumen-comments:remove-thread");
  return true;
};

const setLocalResolved = (threadId: string, resolved: boolean) => {
  const normalizedThreadId = normalizeCommentId(threadId);
  if (!normalizedThreadId) {
    return false;
  }
  const existing = localThreads.get(normalizedThreadId);
  if (!existing) {
    return false;
  }
  localThreads.set(normalizedThreadId, {
    ...existing,
    status: resolved ? "resolved" : "open",
    resolved,
    updatedAt: new Date().toISOString(),
  });
  emitChange();
  return true;
};

const setYResolved = (threadId: string, resolved: boolean) => {
  const normalizedThreadId = normalizeCommentId(threadId);
  const binding = yjsBinding;
  if (!binding || !normalizedThreadId) {
    return false;
  }
  const threadMap = binding.threads.get(normalizedThreadId);
  if (!(threadMap instanceof Y.Map)) {
    return false;
  }
  binding.doc.transact(() => {
    threadMap.set("status", resolved ? "resolved" : "open");
    threadMap.set("resolved", resolved);
    threadMap.set("updatedAt", new Date().toISOString());
  }, "lumen-comments:set-resolved");
  return true;
};

const clearLocalThreads = () => {
  if (localThreads.size === 0) {
    return;
  }
  localThreads.clear();
  emitChange();
};

const clearYThreads = () => {
  const binding = yjsBinding;
  if (!binding || binding.threads.size === 0) {
    return;
  }
  binding.doc.transact(() => {
    const threadIds = Array.from(binding.threads.keys());
    for (const threadId of threadIds) {
      binding.threads.delete(threadId);
    }
  }, "lumen-comments:clear");
};

export const lumenCommentsStore: CommentStoreAdapter & {
  useLocalStore: (options?: { clear?: boolean }) => void;
  useCollaborationStore: (document: Y.Doc | null | undefined, field?: string | null) => void;
  isCollaborationBacked: () => boolean;
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
  useLocalStore(options) {
    useLocalCommentsStore(options);
  },
  useCollaborationStore(document, field) {
    useYjsCommentsStore(document, field);
  },
  isCollaborationBacked() {
    return isYjsBacked();
  },
  getThread(threadId: string) {
    const normalizedThreadId = normalizeCommentId(threadId);
    if (!normalizedThreadId) {
      return null;
    }
    return isYjsBacked() ? getYThread(normalizedThreadId) : getLocalThread(normalizedThreadId);
  },
  getThreads() {
    return isYjsBacked() ? listYThreads() : listLocalThreads();
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
    return isYjsBacked() ? listYThreads() : listLocalThreads();
  },
  upsertThread(thread) {
    return isYjsBacked() ? upsertYThread(thread) : upsertLocalThread(thread);
  },
  addMessage(threadId, message) {
    return isYjsBacked() ? addYMessage(threadId, message) : addLocalMessage(threadId, message);
  },
  removeThread(threadId) {
    return isYjsBacked() ? removeYThread(threadId) : removeLocalThread(threadId);
  },
  setResolved(threadId: string, resolved: boolean) {
    return isYjsBacked() ? setYResolved(threadId, resolved) : setLocalResolved(threadId, resolved);
  },
  clear() {
    if (isYjsBacked()) {
      clearYThreads();
      return;
    }
    clearLocalThreads();
  },
};
