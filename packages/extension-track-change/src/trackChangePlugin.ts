import { Plugin, PluginKey } from "lumenpage-state";
import { Decoration, DecorationSet } from "lumenpage-view-canvas";

import { getTrackChangeIdsAtPos } from "./trackChangeMark";
import {
  TRACK_CHANGE_META,
  createDefaultTrackChangesOptions,
  normalizeTrackChangeId,
  type TrackChangesOptions,
  type TrackChangePluginState,
} from "./types";

const createDefaultPluginState = (enabled = false): TrackChangePluginState => ({
  enabled,
  activeChangeId: null,
  revision: 0,
});

export const TrackChangePluginKey = new PluginKey<TrackChangePluginState>("trackChanges");

const docHasChangeId = (state: any, changeId: string) => {
  const type = state?.schema?.marks?.trackChange;
  if (!type || !state?.doc?.nodesBetween || !changeId) {
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
      if (normalizeTrackChangeId(mark?.attrs?.changeId) !== changeId) {
        continue;
      }
      found = true;
      return false;
    }
    return undefined;
  });

  return found;
};

const createTrackChangeDecorations = (
  state: any,
  pluginState: TrackChangePluginState,
  options: TrackChangesOptions
) => {
  const type = state?.schema?.marks?.trackChange;
  const activeChangeId = normalizeTrackChangeId(pluginState?.activeChangeId);
  if (!type || !activeChangeId || !state?.doc?.nodesBetween) {
    return null;
  }

  const decorations: any[] = [];
  state.doc.nodesBetween(0, state.doc.content.size, (node: any, pos: number) => {
    if (!node?.isInline || !Array.isArray(node.marks) || node.marks.length === 0) {
      return;
    }
    const from = Number(pos);
    const to = Number(pos + node.nodeSize);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return;
    }
    for (const mark of node.marks) {
      if (mark?.type !== type) {
        continue;
      }
      if (normalizeTrackChangeId(mark?.attrs?.changeId) !== activeChangeId) {
        continue;
      }
      decorations.push(
        Decoration.inline(from, to, {
          backgroundColor: options.activeDecorationColor,
        })
      );
    }
  });

  return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : null;
};

export const getTrackChangePluginState = (state: any): TrackChangePluginState =>
  TrackChangePluginKey.getState(state) || createDefaultPluginState();

export const createTrackChangePlugin = (pluginOptions: Partial<TrackChangesOptions> = {}) => {
  const options = {
    ...createDefaultTrackChangesOptions(),
    ...(pluginOptions || {}),
  };

  return new Plugin<TrackChangePluginState>({
    key: TrackChangePluginKey,
    state: {
      init: () => createDefaultPluginState(options.enabled),
      apply: (transaction: any, pluginState: TrackChangePluginState, _oldState: any, newState: any) => {
        const meta = transaction?.getMeta?.(TRACK_CHANGE_META) || null;
        let enabled = pluginState?.enabled === true;
        let activeChangeId = pluginState?.activeChangeId || null;
        let changed = false;

        if (meta && typeof meta.enabled === "boolean" && meta.enabled !== enabled) {
          enabled = meta.enabled;
          changed = true;
        }

        if (meta && Object.prototype.hasOwnProperty.call(meta, "activeChangeId")) {
          const nextChangeId = normalizeTrackChangeId(meta.activeChangeId);
          if (nextChangeId !== activeChangeId) {
            activeChangeId = nextChangeId;
            changed = true;
          }
        }

        if (activeChangeId && !docHasChangeId(newState, activeChangeId)) {
          activeChangeId = null;
          changed = true;
        }

        const shouldRefresh = transaction?.docChanged === true || meta?.refresh === true;
        if (!changed && !shouldRefresh) {
          return pluginState;
        }

        return {
          enabled,
          activeChangeId,
          revision: Number(pluginState?.revision || 0) + 1,
        };
      },
    },
    props: {
      decorations(state: any) {
        return createTrackChangeDecorations(state, getTrackChangePluginState(state), options);
      },
      handleClick(view: any, pos: number) {
        const currentState = getTrackChangePluginState(view?.state);
        const nextChangeId = getTrackChangeIdsAtPos(view?.state, pos)?.[0] || null;
        if (!nextChangeId) {
          if (!currentState.activeChangeId) {
            return false;
          }
          const tr = view?.state?.tr
            ?.setMeta(TRACK_CHANGE_META, { activeChangeId: null })
            ?.setMeta("addToHistory", false);
          if (tr) {
            view.dispatch(tr);
          }
          return true;
        }
        if (currentState.activeChangeId === nextChangeId) {
          return false;
        }
        const tr = view?.state?.tr
          ?.setMeta(TRACK_CHANGE_META, { activeChangeId: nextChangeId })
          ?.setMeta("addToHistory", false);
        if (tr) {
          view.dispatch(tr);
        }
        return true;
      },
    },
  });
};
