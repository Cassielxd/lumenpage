import { Extension } from "lumenpage-core";

import { CommentsPluginKey, createCommentsPlugin } from "./commentsPlugin";
import {
  createDefaultCommentsOptions,
  normalizeCommentId,
  type CommentsOptions,
} from "./types";

type CommentCommandMethods<ReturnType> = {
  activateCommentThread: (threadId: string | null) => ReturnType;
  refreshComments: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    commentsRuntime: CommentCommandMethods<ReturnType>;
  }
}

const createActivateCommentThreadCommand =
  (threadId: string | null) =>
  (state: any, dispatch?: (tr: any) => void) => {
    if (!state?.tr) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    const tr = state.tr
      .setMeta(CommentsPluginKey, { activeThreadId: normalizeCommentId(threadId) })
      .setMeta("addToHistory", false);
    dispatch(tr);
    return true;
  };

const createRefreshCommentsCommand =
  () =>
  (state: any, dispatch?: (tr: any) => void) => {
    if (!state?.tr) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    const tr = state.tr
      .setMeta(CommentsPluginKey, { refresh: true })
      .setMeta("addToHistory", false);
    dispatch(tr);
    return true;
  };

export const CommentsRuntime = Extension.create<CommentsOptions>({
  name: "commentsRuntime",
  priority: 160,
  addOptions() {
    return createDefaultCommentsOptions();
  },
  addCommands() {
    return {
      activateCommentThread: (threadId: string | null) => createActivateCommentThreadCommand(threadId),
      refreshComments: () => createRefreshCommentsCommand(),
    };
  },
  addPlugins() {
    return [createCommentsPlugin(this.options)];
  },
});

export default CommentsRuntime;
