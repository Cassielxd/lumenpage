import { computed, onBeforeUnmount, onMounted, watch, type ComputedRef } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import type { SyncWorkspaceAccessOptions } from "./useWorkspaceAccessLoader";

type UseWorkspaceAccessLifecycleOptions = {
  routeDocumentId: ComputedRef<string>;
  routeShareToken: ComputedRef<string>;
  realtimeCollaborationEnabled: ComputedRef<boolean>;
  collaborationAuthError: ComputedRef<string | null>;
  loadWorkspace: (options?: SyncWorkspaceAccessOptions) => Promise<unknown>;
  flushPendingSnapshotSave: () => Promise<unknown> | void;
};

export const useWorkspaceAccessLifecycle = ({
  routeDocumentId,
  routeShareToken,
  realtimeCollaborationEnabled,
  collaborationAuthError,
  loadWorkspace,
  flushPendingSnapshotSave,
}: UseWorkspaceAccessLifecycleOptions) => {
  const workspaceRouteKey = computed(() => {
    const documentId = String(routeDocumentId.value || "").trim();
    if (!documentId) {
      return "";
    }
    const shareToken = String(routeShareToken.value || "").trim();
    return shareToken ? `${documentId}::${shareToken}` : documentId;
  });

  let refreshPromise: Promise<unknown> | null = null;

  const refreshWorkspaceAccess = ({ flushSnapshot = false }: { flushSnapshot?: boolean } = {}) => {
    if (refreshPromise) {
      return refreshPromise;
    }
    refreshPromise = (async () => {
      if (flushSnapshot) {
        await flushPendingSnapshotSave();
      }
      await loadWorkspace({ withCollabTicket: true });
    })().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  };

  const handleForegroundRefresh = () => {
    if (!routeDocumentId.value || !realtimeCollaborationEnabled.value) {
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    void refreshWorkspaceAccess();
  };

  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      handleForegroundRefresh();
    }
  };

  onMounted(async () => {
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleForegroundRefresh, { passive: true });
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange, { passive: true });
    }
    await refreshWorkspaceAccess();
  });

  watch(
    () => workspaceRouteKey.value,
    (nextRouteKey, previousRouteKey) => {
      if (!nextRouteKey || nextRouteKey === previousRouteKey) {
        return;
      }
      void refreshWorkspaceAccess({ flushSnapshot: true });
    },
  );

  watch(
    () => collaborationAuthError.value,
    (nextError, previousError) => {
      if (!nextError || nextError === previousError) {
        return;
      }
      if (!routeDocumentId.value || !realtimeCollaborationEnabled.value) {
        return;
      }
      void refreshWorkspaceAccess();
    },
  );

  onBeforeUnmount(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", handleForegroundRefresh);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  });

  onBeforeRouteLeave(async () => {
    await flushPendingSnapshotSave();
  });
};
