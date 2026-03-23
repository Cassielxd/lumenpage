import { Extension } from "lumenpage-core";

import {
  CommentAnchor,
  findCommentAnchorRange,
  findCommentAnchorRanges,
  getCommentMarksAtPos,
  getCommentThreadIdsAtPos,
} from "./commentAnchor";
import { CommentsPluginKey, createCommentsPlugin, getCommentsPluginState } from "./commentsPlugin";
import { CommentsRuntime } from "./commentsRuntime";
import { createDefaultCommentsOptions, type CommentsOptions } from "./types";

export const Comments = Extension.create<CommentsOptions>({
  name: "comments",
  priority: 160,
  addOptions() {
    return createDefaultCommentsOptions();
  },
  addExtensions() {
    return [CommentAnchor, CommentsRuntime.configure(this.options)];
  },
});

export {
  COMMENT_MUTATION_META,
  createDefaultCommentsOptions,
  isResolvedCommentThread,
  markCommentTransaction,
  normalizeCommentId,
} from "./types";
export type {
  CommentAnchorAttrs,
  CommentStoreAdapter,
  CommentsOptions,
  CommentsPluginState,
  CommentThreadRecord,
} from "./types";
export {
  CommentAnchor,
  type CommentAnchorRange,
  findCommentAnchorRange,
  findCommentAnchorRanges,
  getCommentMarksAtPos,
  getCommentThreadIdsAtPos,
} from "./commentAnchor";
export { CommentsPluginKey, createCommentsPlugin, getCommentsPluginState } from "./commentsPlugin";
export { CommentsRuntime } from "./commentsRuntime";

export default Comments;
