import { computed, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import type { PlaygroundDebugFlags } from "../editor/config";
import { useBackendConnection } from "./useBackendConnection";
import {
  useWorkspaceAccessLoader,
  type WorkspaceAccessMessages,
} from "./useWorkspaceAccessLoader";
import { useWorkspaceAccessDialogs } from "./useWorkspaceAccessDialogs";
import { useWorkspaceAccessLifecycle } from "./useWorkspaceAccessLifecycle";
import { useWorkspaceShellStore } from "../stores/workspaceShell";
import { useDocumentNavigation } from "./useDocumentNavigation";

type UseWorkspaceAccessOptions = {
  debugFlags: PlaygroundDebugFlags;
  locale: ComputedRef<string>;
  workspaceAccessEnabled: ComputedRef<boolean>;
  realtimeCollaborationEnabled: ComputedRef<boolean>;
  collaborationAuthError: ComputedRef<string | null>;
  routeDocumentId: ComputedRef<string>;
  routeShareToken: ComputedRef<string>;
  flushPendingSnapshotSave?: (() => Promise<unknown> | void) | null;
  messages: WorkspaceAccessMessages;
  applyRuntime: (
    runtimeFlags: PlaygroundDebugFlags,
    snapshotBase64?: string | null
  ) => Promise<boolean>;
  clearRuntime: () => void;
};

export const useWorkspaceAccess = ({
  debugFlags,
  locale,
  workspaceAccessEnabled,
  realtimeCollaborationEnabled,
  collaborationAuthError,
  routeDocumentId,
  routeShareToken,
  flushPendingSnapshotSave: flushPendingSnapshotSaveOption,
  messages,
  applyRuntime,
  clearRuntime,
}: UseWorkspaceAccessOptions) => {
  const workspaceShellStore = useWorkspaceShellStore();
  const {
    backendUrl,
    sessionUser: backendSessionUser,
    setSessionUser: setBackendSessionUser,
    refreshSession,
  } = useBackendConnection({
    fallbackUrl: computed(() => debugFlags.collaborationUrl),
  });
  const { openShareAccess } = useDocumentNavigation();
  const {
    shareDialogVisible,
    accountDialogVisible,
    accountDialogMode,
    accountPopupVisible,
    backendDocument,
    backendDocumentAccess,
    backendAccessError,
    backendAccessBound,
    workspaceLoading,
    workspaceError,
  } = storeToRefs(workspaceShellStore);
  const flushPendingSnapshotSave = async () => {
    await flushPendingSnapshotSaveOption?.();
  };
  const { loadWorkspace } = useWorkspaceAccessLoader({
    debugFlags,
    backendUrl,
    backendSessionUser,
    setBackendSessionUser,
    refreshSession,
    workspaceAccessEnabled,
    realtimeCollaborationEnabled,
    routeDocumentId,
    routeShareToken,
    backendDocument,
    backendDocumentAccess,
    backendAccessError,
    backendAccessBound,
    workspaceLoading,
    workspaceError,
    messages,
    redirectToShareAccess: (shareToken: string) =>
      openShareAccess(shareToken, {
        locale: locale.value,
        replace: true,
      }),
    applyRuntime,
    clearRuntime,
  });
  const {
    handleAccountSessionChange,
    openShareDialog,
    openAccountDialog,
    handleShareAuthRequest,
    resetWorkspaceAccessDialogsState,
  } = useWorkspaceAccessDialogs({
    backendSessionUser,
    shareDialogVisible,
    accountDialogVisible,
    accountDialogMode,
    accountPopupVisible,
    setBackendSessionUser,
    loadWorkspace,
  });

  const resetWorkspaceAccessState = () => {
    resetWorkspaceAccessDialogsState();
    workspaceShellStore.resetWorkspaceShellState();
  };
  useWorkspaceAccessLifecycle({
    routeDocumentId,
    routeShareToken,
    realtimeCollaborationEnabled,
    collaborationAuthError,
    loadWorkspace,
    flushPendingSnapshotSave,
  });

  return {
    backendUrl,
    shareDialogVisible,
    accountDialogVisible,
    accountDialogMode,
    accountPopupVisible,
    backendSessionUser,
    backendDocument,
    backendDocumentAccess,
    backendAccessError,
    backendAccessBound,
    workspaceLoading,
    workspaceError,
    handleAccountSessionChange,
    openShareDialog,
    openAccountDialog,
    handleShareAuthRequest,
    loadWorkspace,
    resetWorkspaceAccessState,
  };
};
