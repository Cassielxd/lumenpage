import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import { type CollaborationCaretUser } from "lumenpage-extension-collaboration-caret";
import * as Y from "yjs";

import type { PlaygroundDebugFlags } from "./config";

const accessChangedCloseReason = "Access changed";

export type LumenCollaborationState = {
  enabled: boolean;
  url: string;
  documentName: string;
  field: string;
  userName: string;
  userColor: string;
  status: WebSocketStatus | "disabled";
  synced: boolean;
  users: CollaborationCaretUser[];
  error: string | null;
};

export type LumenCollaborationRuntime = {
  provider: HocuspocusProvider | null;
  destroy: () => void;
  updateUsers: (users: CollaborationCaretUser[]) => void;
  state: LumenCollaborationState;
};

export const createInitialLumenCollaborationState = (
  flags: Pick<
    PlaygroundDebugFlags,
    | "collaborationEnabled"
    | "collaborationUrl"
    | "collaborationDocument"
    | "collaborationField"
    | "collaborationUserName"
    | "collaborationUserColor"
  >
): LumenCollaborationState => ({
  enabled: flags.collaborationEnabled,
  url: flags.collaborationUrl,
  documentName: flags.collaborationDocument,
  field: flags.collaborationField,
  userName: flags.collaborationUserName,
  userColor: flags.collaborationUserColor,
  status: flags.collaborationEnabled ? WebSocketStatus.Connecting : "disabled",
  synced: false,
  users: [],
  error: null,
});

export const createLumenCollaborationRuntime = ({
  flags,
  onStateChange,
}: {
  flags: PlaygroundDebugFlags;
  onStateChange?: ((state: LumenCollaborationState) => void) | null;
}): LumenCollaborationRuntime => {
  let state = createInitialLumenCollaborationState(flags);
  const emitState = (patch: Partial<LumenCollaborationState> = {}) => {
    state = {
      ...state,
      ...patch,
      users: Array.isArray(patch.users) ? [...patch.users] : [...state.users],
    };
    onStateChange?.({ ...state, users: [...state.users] });
  };

  emitState();

  if (!flags.collaborationEnabled) {
    return {
      provider: null,
      destroy: () => undefined,
      updateUsers: () => undefined,
      state,
    };
  }

  const provider = new HocuspocusProvider({
    url: flags.collaborationUrl,
    name: flags.collaborationDocument,
    document: new Y.Doc(),
    token: flags.collaborationToken || null,
    onStatus: ({ status }) => {
      emitState({ status });
    },
    onSynced: ({ state: synced }) => {
      emitState({ synced, error: null });
    },
    onAuthenticationFailed: ({ reason }) => {
      emitState({
        status: WebSocketStatus.Disconnected,
        synced: false,
        error: reason || "Authentication failed",
      });
    },
    onDisconnect: () => {
      emitState({ synced: false });
    },
    onClose: ({ event }) => {
      const reason = String(event?.reason || "").trim();
      if (reason === accessChangedCloseReason) {
        emitState({
          status: WebSocketStatus.Disconnected,
          synced: false,
          error: reason,
        });
        return;
      }
      emitState({ synced: false });
    },
    onDestroy: () => {
      emitState({
        status: WebSocketStatus.Disconnected,
        synced: false,
      });
    },
  });

  return {
    provider,
    destroy: () => {
      provider.destroy();
    },
    updateUsers: (users) => {
      emitState({ users, error: null });
    },
    state,
  };
};
