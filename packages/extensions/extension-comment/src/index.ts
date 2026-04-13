import { Extension } from "lumenpage-core";

import {
  CommentAnchor,
  findCommentAnchorRange,
  findCommentAnchorRanges,
  getCommentMarksAtPos,
  getCommentThreadIdsAtPos,
} from "./commentAnchor.js";
import { CommentsPluginKey, createCommentsPlugin, getCommentsPluginState } from "./commentsPlugin.js";
import { CommentsRuntime } from "./commentsRuntime.js";
import { createDefaultCommentsOptions, type CommentsOptions } from "./types.js";

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
} from "./types.js";
export type {
  CommentAnchorAttrs,
  CommentStoreAdapter,
  CommentsOptions,
  CommentsPluginState,
  CommentThreadRecord,
} from "./types.js";
export {
  CommentAnchor,
  type CommentAnchorRange,
  findCommentAnchorRange,
  findCommentAnchorRanges,
  getCommentMarksAtPos,
  getCommentThreadIdsAtPos,
} from "./commentAnchor.js";
export { CommentsPluginKey, createCommentsPlugin, getCommentsPluginState } from "./commentsPlugin.js";
export { CommentsRuntime } from "./commentsRuntime.js";

export default Comments;
