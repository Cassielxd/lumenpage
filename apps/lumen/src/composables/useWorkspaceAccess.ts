import { computed, ref, watch, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import {
  clearStoredShareAccessToken,
  createDocumentCollabTicket,
  ensureCollaborationDocument,
  getDocumentCollabSnapshot,
  getBackendDocumentAccess,
  type BackendUser,
} from "../editor/backendClient";
import type { PlaygroundDebugFlags } from "../editor/config";
import { useBackendConnection } from "./useBackendConnection";
import { useWorkspaceShellStore } from "../stores/workspaceShell";

type WorkspaceAccessMessages = {
  shareDialogLoadFailed: ComputedRef<string>;
  shareDialogEnsureFailed: ComputedRef<string>;
  shareLandingLoadFailed: ComputedRef<string>;
};

type SyncWorkspaceAccessOptions = {
  withCollabTicket?: boolean;
  preferredSessionUser?: BackendUser | null;
  skipSessionRefresh?: boolean;
};

type UseWorkspaceAccessOptions = {
  debugFlags: PlaygroundDebugFlags;
  workspaceAccessEnabled: ComputedRef<boolean>;
  realtimeCollaborationEnabled: ComputedRef<boolean>;
  routeDocumentId: ComputedRef<string>;
  routeShareToken: ComputedRef<string>;
  messages: WorkspaceAccessMessages;
  applyRuntime: (
    runtimeFlags: PlaygroundDebugFlags,
    snapshotBase64?: string | null
  ) => Promise<boolean>;
  clearRuntime: () => void;
};

export const useWorkspaceAccess = ({
  debugFlags,
  workspaceAccessEnabled,
  realtimeCollaborationEnabled,
  routeDocumentId,
  routeShareToken,
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
  const pendingAccountReturnTarget = ref<"share" | null>(null);
  const accountSessionSyncing = ref(false);

  const syncBackendWorkspaceAccess = async (options?: SyncWorkspaceAccessOptions) => {
    const withCollabTicket = options?.withCollabTicket === true;
    let snapshotBase64: string | null = null;
    const nextFlags = {
      ...debugFlags,
      collaborationEnabled: realtimeCollaborationEnabled.value,
    };
    const currentRouteDocumentId = routeDocumentId.value;
    const currentRouteShareToken = routeShareToken.value;

    backendAccessError.value = null;

    if (options?.skipSessionRefresh) {
      setBackendSessionUser(options.preferredSessionUser ?? null);
    } else {
      try {
        await refreshSession();
      } catch (error) {
        setBackendSessionUser(null);
        if (workspaceAccessEnabled.value) {
          backendAccessError.value =
            error instanceof Error
              ? error.message || String(error)
              : messages.shareDialogLoadFailed.value;
        }
      }
    }

    if (!workspaceAccessEnabled.value) {
      backendDocument.value = null;
      backendDocumentAccess.value = null;
      backendAccessBound.value = false;
      return {
        runtimeFlags: nextFlags,
        snapshotBase64,
      };
    }

    try {
      if (currentRouteDocumentId) {
        const resolved = await getBackendDocumentAccess(backendUrl.value, currentRouteDocumentId, {
          shareToken: currentRouteShareToken,
        });
        backendDocument.value = resolved.document;
        backendDocumentAccess.value = resolved.access;
        backendAccessBound.value = true;
        nextFlags.collaborationDocument = resolved.document.name;
        nextFlags.collaborationField = resolved.document.field;
        nextFlags.permissionMode = resolved.access.permissionMode;

        if (resolved.access.source !== "share-link") {
          clearStoredShareAccessToken(currentRouteDocumentId);
        }

        if (!nextFlags.collaborationEnabled) {
          const snapshot = await getDocumentCollabSnapshot(backendUrl.value, resolved.document.id, {
            shareToken: currentRouteShareToken,
          });
          snapshotBase64 = snapshot.snapshot;
        }

        if (withCollabTicket && nextFlags.collaborationEnabled) {
          const { collab } = await createDocumentCollabTicket(backendUrl.value, resolved.document.id, {
            field: resolved.document.field,
            userName: backendSessionUser.value?.displayName || debugFlags.collaborationUserName,
            userColor: debugFlags.collaborationUserColor,
            shareToken: currentRouteShareToken,
          });
          nextFlags.collaborationUrl = collab.url || nextFlags.collaborationUrl;
          nextFlags.collaborationDocument = collab.documentName || nextFlags.collaborationDocument;
          nextFlags.collaborationField = collab.field || nextFlags.collaborationField;
          nextFlags.collaborationToken = collab.token || nextFlags.collaborationToken;
          nextFlags.collaborationUserName = collab.userName || nextFlags.collaborationUserName;
          nextFlags.collaborationUserColor = collab.userColor || nextFlags.collaborationUserColor;
          nextFlags.permissionMode = collab.permissionMode;
        }

        return {
          runtimeFlags: nextFlags,
          snapshotBase64,
        };
      }

      if (!backendSessionUser.value) {
        backendDocument.value = null;
        backendDocumentAccess.value = null;
        backendAccessBound.value = false;
        return {
          runtimeFlags: nextFlags,
          snapshotBase64,
        };
      }

      const ensured = await ensureCollaborationDocument(backendUrl.value, {
        name: debugFlags.collaborationDocument,
        title: debugFlags.collaborationDocument,
        field: debugFlags.collaborationField,
      });
      backendDocument.value = ensured.document;
      backendDocumentAccess.value = ensured.access;
      backendAccessBound.value = true;
      nextFlags.permissionMode = ensured.access.permissionMode;

      if (withCollabTicket && nextFlags.collaborationEnabled) {
        const { collab } = await createDocumentCollabTicket(backendUrl.value, ensured.document.id, {
          field: ensured.document.field,
          userName: backendSessionUser.value?.displayName || debugFlags.collaborationUserName,
          userColor: debugFlags.collaborationUserColor,
        });
        nextFlags.collaborationUrl = collab.url || nextFlags.collaborationUrl;
        nextFlags.collaborationDocument = collab.documentName || nextFlags.collaborationDocument;
        nextFlags.collaborationField = collab.field || nextFlags.collaborationField;
        nextFlags.collaborationToken = collab.token || nextFlags.collaborationToken;
        nextFlags.collaborationUserName = collab.userName || nextFlags.collaborationUserName;
        nextFlags.collaborationUserColor = collab.userColor || nextFlags.collaborationUserColor;
        nextFlags.permissionMode = collab.permissionMode;
      }
    } catch (error) {
      backendDocument.value = null;
      backendDocumentAccess.value = null;
      backendAccessBound.value = false;
      backendAccessError.value =
        error instanceof Error
          ? error.message || String(error)
          : messages.shareDialogEnsureFailed.value;
      nextFlags.permissionMode = "readonly";
    }

    return {
      runtimeFlags: nextFlags,
      snapshotBase64,
    };
  };

  const applyWorkspaceRuntime = async (
    runtimeFlags: PlaygroundDebugFlags,
    snapshotBase64?: string | null
  ) => {
    workspaceError.value = null;
    if (routeDocumentId.value && !backendDocument.value) {
      clearRuntime();
      workspaceError.value = backendAccessError.value || messages.shareLandingLoadFailed.value;
      workspaceLoading.value = false;
      return false;
    }

    const mounted = await applyRuntime(runtimeFlags, snapshotBase64);
    workspaceLoading.value = false;
    return mounted;
  };

  const loadWorkspace = async (options?: SyncWorkspaceAccessOptions) => {
    workspaceLoading.value = true;
    const { runtimeFlags, snapshotBase64 } = await syncBackendWorkspaceAccess(options);
    await applyWorkspaceRuntime(runtimeFlags, snapshotBase64);
    return runtimeFlags;
  };

  const handleAccountSessionChange = async (user: BackendUser | null) => {
    accountSessionSyncing.value = true;
    setBackendSessionUser(user);
    accountPopupVisible.value = false;
    try {
      await loadWorkspace({
        withCollabTicket: true,
        preferredSessionUser: user,
        skipSessionRefresh: true,
      });
      if (pendingAccountReturnTarget.value === "share" && user) {
        shareDialogVisible.value = true;
      }
    } finally {
      pendingAccountReturnTarget.value = null;
      accountSessionSyncing.value = false;
    }
  };

  const openShareDialog = () => {
    pendingAccountReturnTarget.value = null;
    shareDialogVisible.value = true;
  };

  const openAccountDialog = (mode: "login" | "register" = "login") => {
    accountDialogMode.value = mode;
    accountPopupVisible.value = false;
    accountDialogVisible.value = true;
  };

  const handleShareAuthRequest = () => {
    pendingAccountReturnTarget.value = "share";
    shareDialogVisible.value = false;
    openAccountDialog("login");
  };

  const resetWorkspaceAccessState = () => {
    pendingAccountReturnTarget.value = null;
    accountSessionSyncing.value = false;
    workspaceShellStore.resetWorkspaceShellState();
  };

  watch(
    () => accountDialogVisible.value,
    (visible) => {
      if (visible || pendingAccountReturnTarget.value !== "share" || accountSessionSyncing.value) {
        return;
      }
      if (backendSessionUser.value) {
        shareDialogVisible.value = true;
      }
      pendingAccountReturnTarget.value = null;
    }
  );

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
