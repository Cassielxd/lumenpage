import { Plugin, PluginKey } from "lumenpage-state";

import {
  createRemoteSelectionDecorations,
  type RemoteSelection,
  type RemoteSelectionOptions,
} from "./collaboration";

export type CollaborationMeta = {
  selections?: RemoteSelection[];
  decorations?: RemoteSelectionOptions;
};

type CollaborationState = {
  selections: RemoteSelection[];
  decorations: RemoteSelectionOptions;
};

const normalizeSelections = (value) => (Array.isArray(value) ? value : []);

export const collaborationPluginKey = new PluginKey("lumenpage-collaboration");

export const createCollaborationPlugin = ({
  selections = [],
  decorations = {},
}: {
  selections?: RemoteSelection[];
  decorations?: RemoteSelectionOptions;
} = {}) => {
  return new Plugin({
    key: collaborationPluginKey,
    state: {
      init() {
        return {
          selections: normalizeSelections(selections),
          decorations: { ...decorations },
        } as CollaborationState;
      },
      apply(tr, value: CollaborationState) {
        const meta = tr.getMeta(collaborationPluginKey) as CollaborationMeta | undefined;
        if (!meta) {
          return value;
        }
        return {
          selections: meta.selections ? normalizeSelections(meta.selections) : value.selections,
          decorations: meta.decorations ? { ...value.decorations, ...meta.decorations } : value.decorations,
        } as CollaborationState;
      },
    },
    props: {
      decorations(state) {
        const pluginState = collaborationPluginKey.getState(state) as CollaborationState | undefined;
        if (!pluginState || pluginState.selections.length === 0) {
          return null;
        }
        return createRemoteSelectionDecorations(pluginState.selections, pluginState.decorations);
      },
    },
  });
};

export const setRemoteSelections = (
  selections: RemoteSelection[],
  decorations?: RemoteSelectionOptions
) => {
  return (state, dispatch) => {
    if (dispatch) {
      const tr = state.tr.setMeta(collaborationPluginKey, {
        selections,
        decorations,
      });
      dispatch(tr);
    }
    return true;
  };
};
