export type CommentAnchorAttrs = {
  threadId: string;
  anchorId: string;
};

export type CommentThreadRecord = {
  id: string;
  anchorId?: string | null;
  blockId?: string | null;
  status?: "open" | "resolved";
  resolved?: boolean;
  quote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};

export type CommentStoreAdapter = {
  getThread?: (threadId: string) => CommentThreadRecord | null | undefined;
  getThreads?: () => readonly CommentThreadRecord[] | null | undefined;
  subscribe?: (listener: () => void) => (() => void) | void;
};

export type CommentsOptions = {
  store: CommentStoreAdapter | null;
  showResolved: boolean;
  allowBlockComments: boolean;
  inactiveDecorationColor: string;
  activeDecorationColor: string;
  resolvedDecorationColor: string;
};

export type CommentsPluginState = {
  activeThreadId: string | null;
  revision: number;
};

export const COMMENT_MUTATION_META = "comment:mutation";

export const normalizeCommentId = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

export const markCommentTransaction = (tr: any) => {
  if (tr?.setMeta) {
    tr.setMeta(COMMENT_MUTATION_META, true);
  }
  return tr;
};

export const isResolvedCommentThread = (thread: CommentThreadRecord | null | undefined) =>
  thread?.resolved === true || thread?.status === "resolved";

export const createDefaultCommentsOptions = (): CommentsOptions => ({
  store: null,
  showResolved: false,
  allowBlockComments: false,
  inactiveDecorationColor: "rgba(245, 158, 11, 0.18)",
  activeDecorationColor: "rgba(245, 158, 11, 0.32)",
  resolvedDecorationColor: "rgba(148, 163, 184, 0.16)",
});
