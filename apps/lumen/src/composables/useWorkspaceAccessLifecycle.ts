import { computed, onMounted, watch, type ComputedRef } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import type { SyncWorkspaceAccessOptions } from "./useWorkspaceAccessLoader";

type UseWorkspaceAccessLifecycleOptions = {
  routeDocumentId: ComputedRef<string>;
  routeShareToken: ComputedRef<string>;
  loadWorkspace: (options?: SyncWorkspaceAccessOptions) => Promise<unknown>;
  flushPendingSnapshotSave: () => Promise<unknown> | void;
};

export const useWorkspaceAccessLifecycle = ({
  routeDocumentId,
  routeShareToken,
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

  onMounted(async () => {
    await loadWorkspace({ withCollabTicket: true });
  });

  watch(
    () => workspaceRouteKey.value,
    (nextRouteKey, previousRouteKey) => {
      if (!nextRouteKey || nextRouteKey === previousRouteKey) {
        return;
      }
      void (async () => {
        await flushPendingSnapshotSave();
        await loadWorkspace({ withCollabTicket: true });
      })();
    },
  );

  onBeforeRouteLeave(async () => {
    await flushPendingSnapshotSave();
  });
};
