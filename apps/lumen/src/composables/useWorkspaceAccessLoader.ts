import type { ComputedRef, Ref } from "vue";
import {
  clearStoredShareAccessToken,
  createDocumentCollabTicket,
  ensureCollaborationDocument,
  getDocumentCollabSnapshot,
  getBackendDocumentAccess,
  getBackendShareLink,
  type BackendAccess,
  type BackendDocument,
  type BackendUser,
} from "../editor/backendClient";
import type { PlaygroundDebugFlags } from "../editor/config";

export type WorkspaceAccessMessages = {
  shareDialogLoadFailed: ComputedRef<string>;
  shareDialogEnsureFailed: ComputedRef<string>;
  shareLandingLoadFailed: ComputedRef<string>;
};

export type SyncWorkspaceAccessOptions = {
  withCollabTicket?: boolean;
  preferredSessionUser?: BackendUser | null;
  skipSessionRefresh?: boolean;
};

type UseWorkspaceAccessLoaderOptions = {
  debugFlags: PlaygroundDebugFlags;
  backendUrl: ComputedRef<string>;
  backendSessionUser: Ref<BackendUser | null>;
  setBackendSessionUser: (user: BackendUser | null) => void;
  refreshSession: () => Promise<BackendUser | null>;
  workspaceAccessEnabled: ComputedRef<boolean>;
  realtimeCollaborationEnabled: ComputedRef<boolean>;
  routeDocumentId: ComputedRef<string>;
  routeShareToken: ComputedRef<string>;
  backendDocument: Ref<BackendDocument | null>;
  backendDocumentAccess: Ref<BackendAccess | null>;
  backendAccessError: Ref<string | null>;
  backendAccessBound: Ref<boolean>;
  workspaceLoading: Ref<boolean>;
  workspaceError: Ref<string | null>;
  messages: WorkspaceAccessMessages;
  redirectToShareAccess: (shareToken: string) => Promise<boolean>;
  applyRuntime: (
    runtimeFlags: PlaygroundDebugFlags,
    snapshotBase64?: string | null,
  ) => Promise<boolean>;
  clearRuntime: () => void;
};

const applyCollaborationTicketToFlags = (
  runtimeFlags: PlaygroundDebugFlags,
  collab: Awaited<ReturnType<typeof createDocumentCollabTicket>>["collab"],
) => {
  runtimeFlags.collaborationUrl = collab.url || runtimeFlags.collaborationUrl;
  runtimeFlags.collaborationDocument = collab.documentName || runtimeFlags.collaborationDocument;
  runtimeFlags.collaborationField = collab.field || runtimeFlags.collaborationField;
  runtimeFlags.collaborationToken = collab.token || runtimeFlags.collaborationToken;
  runtimeFlags.collaborationUserName = collab.userName || runtimeFlags.collaborationUserName;
  runtimeFlags.collaborationUserColor = collab.userColor || runtimeFlags.collaborationUserColor;
  runtimeFlags.permissionMode = collab.permissionMode;
};

export const useWorkspaceAccessLoader = ({
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
  redirectToShareAccess,
  applyRuntime,
  clearRuntime,
}: UseWorkspaceAccessLoaderOptions) => {
  const resolveErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message || String(error) : fallback;
  const disableCollaborationFallback = (runtimeFlags: PlaygroundDebugFlags, message: string) => {
    backendAccessError.value = message;
    runtimeFlags.collaborationEnabled = false;
    runtimeFlags.collaborationToken = "";
    debugFlags.collaborationEnabled = false;
    debugFlags.collaborationToken = "";
  };
  const redirectToRestrictedShareLandingIfNeeded = async (shareToken: string) => {
    const normalizedShareToken = String(shareToken || "").trim();
    if (!normalizedShareToken || backendSessionUser.value) {
      return false;
    }

    try {
      const shareAccess = await getBackendShareLink(backendUrl.value, normalizedShareToken);
      if (shareAccess.shareLink.allowAnonymous) {
        return false;
      }
      return redirectToShareAccess(normalizedShareToken);
    } catch (_error) {
      return false;
    }
  };
  const syncBackendWorkspaceAccess = async (options?: SyncWorkspaceAccessOptions) => {
    const withCollabTicket = options?.withCollabTicket === true;
    let snapshotBase64: string | null = null;
    const runtimeFlags = {
      ...debugFlags,
      collaborationEnabled: realtimeCollaborationEnabled.value,
    };
    const currentRouteDocumentId = routeDocumentId.value;
    const currentRouteShareToken = routeShareToken.value;
    let redirectedToShareAccess = false;

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

    const sessionDisplayName = String(backendSessionUser.value?.displayName || "").trim();
    if (sessionDisplayName) {
      runtimeFlags.collaborationUserName = sessionDisplayName;
      debugFlags.collaborationUserName = sessionDisplayName;
    }

    if (!workspaceAccessEnabled.value) {
      backendDocument.value = null;
      backendDocumentAccess.value = null;
      backendAccessBound.value = false;
      return { runtimeFlags, snapshotBase64 };
    }

    try {
      if (currentRouteDocumentId) {
        if (await redirectToRestrictedShareLandingIfNeeded(currentRouteShareToken)) {
          backendDocument.value = null;
          backendDocumentAccess.value = null;
          backendAccessBound.value = false;
          redirectedToShareAccess = true;
          return { runtimeFlags, snapshotBase64, redirectedToShareAccess };
        }

        let resolved: Awaited<ReturnType<typeof getBackendDocumentAccess>>;
        try {
          resolved = await getBackendDocumentAccess(backendUrl.value, currentRouteDocumentId, {
            shareToken: currentRouteShareToken,
          });
        } catch (error) {
          if (await redirectToRestrictedShareLandingIfNeeded(currentRouteShareToken)) {
            backendDocument.value = null;
            backendDocumentAccess.value = null;
            backendAccessBound.value = false;
            redirectedToShareAccess = true;
            return { runtimeFlags, snapshotBase64, redirectedToShareAccess };
          }
          throw error;
        }
        backendDocument.value = resolved.document;
        backendDocumentAccess.value = resolved.access;
        backendAccessBound.value = true;
        runtimeFlags.collaborationDocument = resolved.document.name;
        runtimeFlags.collaborationField = resolved.document.field;
        runtimeFlags.permissionMode = resolved.access.permissionMode;

        if (resolved.access.source !== "share-link" && !currentRouteShareToken) {
          clearStoredShareAccessToken(currentRouteDocumentId);
        }

        if (!runtimeFlags.collaborationEnabled) {
          const snapshot = await getDocumentCollabSnapshot(backendUrl.value, resolved.document.id, {
            shareToken: currentRouteShareToken,
          });
          snapshotBase64 = snapshot.snapshot;
        }

        if (withCollabTicket && runtimeFlags.collaborationEnabled) {
          try {
            const { collab } = await createDocumentCollabTicket(
              backendUrl.value,
              resolved.document.id,
              {
                field: resolved.document.field,
                userName: backendSessionUser.value?.displayName || debugFlags.collaborationUserName,
                userColor: debugFlags.collaborationUserColor,
                shareToken: currentRouteShareToken,
              },
            );
            applyCollaborationTicketToFlags(runtimeFlags, collab);
          } catch (error) {
            disableCollaborationFallback(
              runtimeFlags,
              resolveErrorMessage(error, messages.shareDialogEnsureFailed.value),
            );
            const snapshot = await getDocumentCollabSnapshot(backendUrl.value, resolved.document.id, {
              shareToken: currentRouteShareToken,
            });
            snapshotBase64 = snapshot.snapshot;
          }
        }

        return { runtimeFlags, snapshotBase64, redirectedToShareAccess };
      }

      if (!backendSessionUser.value) {
        backendDocument.value = null;
        backendDocumentAccess.value = null;
        backendAccessBound.value = false;
        return { runtimeFlags, snapshotBase64, redirectedToShareAccess };
      }

      const ensured = await ensureCollaborationDocument(backendUrl.value, {
        name: debugFlags.collaborationDocument,
        title: debugFlags.collaborationDocument,
        field: debugFlags.collaborationField,
      });
      backendDocument.value = ensured.document;
      backendDocumentAccess.value = ensured.access;
      backendAccessBound.value = true;
      runtimeFlags.permissionMode = ensured.access.permissionMode;

      if (withCollabTicket && runtimeFlags.collaborationEnabled) {
        try {
          const { collab } = await createDocumentCollabTicket(backendUrl.value, ensured.document.id, {
            field: ensured.document.field,
            userName: backendSessionUser.value?.displayName || debugFlags.collaborationUserName,
            userColor: debugFlags.collaborationUserColor,
          });
          applyCollaborationTicketToFlags(runtimeFlags, collab);
        } catch (error) {
          disableCollaborationFallback(
            runtimeFlags,
            resolveErrorMessage(error, messages.shareDialogEnsureFailed.value),
          );
        }
      }
    } catch (error) {
      backendDocument.value = null;
      backendDocumentAccess.value = null;
      backendAccessBound.value = false;
      backendAccessError.value = resolveErrorMessage(error, messages.shareDialogEnsureFailed.value);
      runtimeFlags.permissionMode = "readonly";
    }

    return { runtimeFlags, snapshotBase64, redirectedToShareAccess };
  };

  const applyWorkspaceRuntime = async (
    runtimeFlags: PlaygroundDebugFlags,
    redirectedToShareAccess: boolean,
    snapshotBase64?: string | null,
  ) => {
    workspaceError.value = null;
    if (redirectedToShareAccess) {
      workspaceLoading.value = false;
      return false;
    }
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
    const { runtimeFlags, snapshotBase64, redirectedToShareAccess } =
      await syncBackendWorkspaceAccess(options);
    await applyWorkspaceRuntime(runtimeFlags, redirectedToShareAccess, snapshotBase64);
    return runtimeFlags;
  };

  return {
    loadWorkspace,
  };
};
