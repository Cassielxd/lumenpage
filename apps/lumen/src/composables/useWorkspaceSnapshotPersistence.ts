import { shallowRef, type ComputedRef } from "vue";
import * as Y from "yjs";
import { saveDocumentCollabSnapshot } from "../editor/backendClient";

type UseWorkspaceSnapshotPersistenceOptions = {
  backendUrl: ComputedRef<string>;
  routeDocumentId: ComputedRef<string>;
  routeShareToken: ComputedRef<string>;
  realtimeCollaborationEnabled: ComputedRef<boolean>;
  backendDocumentId: ComputedRef<string>;
  canWriteSnapshot: ComputedRef<boolean>;
  saveFailedMessage: ComputedRef<string>;
  onSaveError: (message: string) => void;
};

const SNAPSHOT_SAVE_DEBOUNCE_MS = 700;

export const useWorkspaceSnapshotPersistence = ({
  backendUrl,
  routeDocumentId,
  routeShareToken,
  realtimeCollaborationEnabled,
  backendDocumentId,
  canWriteSnapshot,
  saveFailedMessage,
  onSaveError,
}: UseWorkspaceSnapshotPersistenceOptions) => {
  const localSnapshotDocument = shallowRef<Y.Doc | null>(null);
  let snapshotSaveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let snapshotSavePromise: Promise<void> | null = null;
  let pendingSnapshotSave = false;
  let lastSnapshotSaveError = "";

  const clearSnapshotSaveTimer = () => {
    if (snapshotSaveTimeoutId != null) {
      clearTimeout(snapshotSaveTimeoutId);
      snapshotSaveTimeoutId = null;
    }
  };

  const canPersistLocalSnapshot = () =>
    routeDocumentId.value.length > 0 &&
    !realtimeCollaborationEnabled.value &&
    backendDocumentId.value.length > 0 &&
    !!localSnapshotDocument.value &&
    canWriteSnapshot.value;

  const encodeSnapshotBase64 = (document: Y.Doc) => {
    if (typeof window === "undefined") {
      return "";
    }
    const update = Y.encodeStateAsUpdate(document);
    if (update.byteLength === 0) {
      return "";
    }
    let binary = "";
    for (let index = 0; index < update.byteLength; index += 1) {
      binary += String.fromCharCode(update[index]);
    }
    return window.btoa(binary);
  };

  const saveWorkspaceSnapshot = async () => {
    if (!canPersistLocalSnapshot()) {
      return;
    }
    const documentId = backendDocumentId.value;
    const document = localSnapshotDocument.value;
    if (!documentId || !document) {
      return;
    }
    await saveDocumentCollabSnapshot(backendUrl.value, documentId, {
      snapshot: encodeSnapshotBase64(document),
      shareToken: routeShareToken.value || null,
    });
    lastSnapshotSaveError = "";
  };

  const flushWorkspaceSnapshotSave = async () => {
    clearSnapshotSaveTimer();
    if (!pendingSnapshotSave) {
      if (snapshotSavePromise) {
        await snapshotSavePromise;
      }
      return;
    }
    pendingSnapshotSave = false;
    snapshotSavePromise = (async () => {
      try {
        await saveWorkspaceSnapshot();
      } catch (error) {
        const message =
          error instanceof Error ? error.message || saveFailedMessage.value : saveFailedMessage.value;
        if (message !== lastSnapshotSaveError) {
          onSaveError(message);
          lastSnapshotSaveError = message;
        }
      } finally {
        snapshotSavePromise = null;
      }
    })();
    await snapshotSavePromise;
  };

  const scheduleWorkspaceSnapshotSave = () => {
    if (!canPersistLocalSnapshot()) {
      pendingSnapshotSave = false;
      clearSnapshotSaveTimer();
      return;
    }
    pendingSnapshotSave = true;
    clearSnapshotSaveTimer();
    snapshotSaveTimeoutId = setTimeout(() => {
      snapshotSaveTimeoutId = null;
      void flushWorkspaceSnapshotSave();
    }, SNAPSHOT_SAVE_DEBOUNCE_MS);
  };

  const setSnapshotDocument = (document: unknown) => {
    localSnapshotDocument.value = document instanceof Y.Doc ? document : null;
  };

  const resetWorkspaceSnapshotPersistence = () => {
    clearSnapshotSaveTimer();
    pendingSnapshotSave = false;
    localSnapshotDocument.value = null;
  };

  return {
    flushWorkspaceSnapshotSave,
    scheduleWorkspaceSnapshotSave,
    setSnapshotDocument,
    resetWorkspaceSnapshotPersistence,
  };
};
