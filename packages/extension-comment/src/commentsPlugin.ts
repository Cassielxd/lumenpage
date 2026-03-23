import { Plugin, PluginKey } from "lumenpage-state";
import { Decoration, DecorationSet } from "lumenpage-view-canvas";

import { getCommentThreadIdsAtPos } from "./commentAnchor";
import {
  createDefaultCommentsOptions,
  isResolvedCommentThread,
  normalizeCommentId,
  type CommentsOptions,
  type CommentsPluginState,
  type CommentStoreAdapter,
  type CommentThreadRecord,
} from "./types";

const DEFAULT_PLUGIN_STATE: CommentsPluginState = {
  activeThreadId: null,
  revision: 0,
};

export const CommentsPluginKey = new PluginKey<CommentsPluginState>("comments");

const getThreadFromStore = (store: CommentStoreAdapter | null, threadId: string) => {
  const direct = store?.getThread?.(threadId);
  if (direct) {
    return direct;
  }
  const threads = store?.getThreads?.();
  if (!Array.isArray(threads) || threads.length === 0) {
    return null;
  }
  return (
    threads.find((thread) => normalizeCommentId((thread as CommentThreadRecord | null)?.id) === threadId) ||
    null
  );
};

const docHasThreadId = (state: any, threadId: string) => {
  const type = state?.schema?.marks?.commentAnchor;
  if (!type || !state?.doc?.nodesBetween || !threadId) {
    return false;
  }

  let found = false;
  state.doc.nodesBetween(0, state.doc.content.size, (node: any) => {
    if (found || !Array.isArray(node?.marks) || node.marks.length === 0) {
      return found ? false : undefined;
    }
    for (const mark of node.marks) {
      if (mark?.type !== type) {
        continue;
      }
      if (normalizeCommentId(mark?.attrs?.threadId) !== threadId) {
        continue;
      }
      found = true;
      return false;
    }
    return undefined;
  });

  return found;
};

const createCommentsDecorations = (
  state: any,
  pluginState: CommentsPluginState,
  options: CommentsOptions
) => {
  const type = state?.schema?.marks?.commentAnchor;
  if (!type || !state?.doc?.nodesBetween) {
    return null;
  }

  const decorations: any[] = [];

  state.doc.nodesBetween(0, state.doc.content.size, (node: any, pos: number) => {
    if (!node?.isInline || !Array.isArray(node.marks) || node.marks.length === 0) {
      return;
    }
    const from = pos;
    const to = pos + node.nodeSize;
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return;
    }

    for (const mark of node.marks) {
      if (mark?.type !== type) {
        continue;
      }
      const threadId = normalizeCommentId(mark?.attrs?.threadId);
      if (!threadId) {
        continue;
      }
      const thread = getThreadFromStore(options.store, threadId);
      const resolved = isResolvedCommentThread(thread);
      if (resolved && options.showResolved !== true) {
        continue;
      }

      const isActive = pluginState.activeThreadId === threadId;
      const backgroundColor = isActive
        ? options.activeDecorationColor
        : resolved
          ? options.resolvedDecorationColor
          : options.inactiveDecorationColor;

      decorations.push(
        Decoration.inline(from, to, {
          backgroundColor,
        })
      );
    }
  });

  return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : null;
};

export const getCommentsPluginState = (state: any): CommentsPluginState =>
  CommentsPluginKey.getState(state) || DEFAULT_PLUGIN_STATE;

export const createCommentsPlugin = (pluginOptions: Partial<CommentsOptions> = {}) => {
  const options = {
    ...createDefaultCommentsOptions(),
    ...(pluginOptions || {}),
  };

  return new Plugin<CommentsPluginState>({
    key: CommentsPluginKey,
    view(view: any) {
      const unsubscribe = options.store?.subscribe?.(() => {
        const tr = view?.state?.tr
          ?.setMeta(CommentsPluginKey, { refresh: true })
          ?.setMeta("addToHistory", false);
        if (tr) {
          view.dispatch(tr);
        }
      });

      return {
        destroy() {
          if (typeof unsubscribe === "function") {
            unsubscribe();
          }
        },
      };
    },
    state: {
      init: () => DEFAULT_PLUGIN_STATE,
      apply: (transaction: any, pluginState: CommentsPluginState, _oldState: any, newState: any) => {
        const meta = transaction?.getMeta?.(CommentsPluginKey) || null;
        let activeThreadId = pluginState?.activeThreadId || null;
        let changed = false;

        if (meta && Object.prototype.hasOwnProperty.call(meta, "activeThreadId")) {
          const nextThreadId = normalizeCommentId(meta.activeThreadId);
          if (nextThreadId !== activeThreadId) {
            activeThreadId = nextThreadId;
            changed = true;
          }
        }

        if (activeThreadId && !docHasThreadId(newState, activeThreadId)) {
          activeThreadId = null;
          changed = true;
        }

        const shouldRefresh = transaction?.docChanged === true || meta?.refresh === true;
        if (!changed && !shouldRefresh) {
          return pluginState;
        }

        return {
          activeThreadId,
          revision: Number(pluginState?.revision || 0) + 1,
        };
      },
    },
    props: {
      decorations(state: any) {
        return createCommentsDecorations(state, getCommentsPluginState(state), options);
      },
      handleClick(view: any, pos: number) {
        const currentState = getCommentsPluginState(view?.state);
        const nextThreadId = getCommentThreadIdsAtPos(view?.state, pos)?.[0] || null;
        if (!nextThreadId) {
          if (!currentState.activeThreadId) {
            return false;
          }
          const tr = view?.state?.tr
            ?.setMeta(CommentsPluginKey, { activeThreadId: null })
            ?.setMeta("addToHistory", false);
          if (tr) {
            view.dispatch(tr);
          }
          return true;
        }
        if (currentState.activeThreadId === nextThreadId) {
          return false;
        }
        const tr = view?.state?.tr
          ?.setMeta(CommentsPluginKey, { activeThreadId: nextThreadId })
          ?.setMeta("addToHistory", false);
        if (tr) {
          view.dispatch(tr);
        }
        return true;
      },
    },
  });
};
