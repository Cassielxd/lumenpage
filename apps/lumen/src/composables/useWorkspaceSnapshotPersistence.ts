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
  let observedSnapshotDocument: Y.Doc | null = null;
  let detachSnapshotObserver: (() => void) | null = null;
  let snapshotSaveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let snapshotSavePromise: Promise<boolean> | null = null;
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

  const runWorkspaceSnapshotSave = async (options?: { force?: boolean }) => {
    clearSnapshotSaveTimer();
    if (snapshotSavePromise) {
      const inFlightResult = await snapshotSavePromise;
      if (!pendingSnapshotSave && options?.force !== true) {
        return inFlightResult;
      }
    }
    if (!pendingSnapshotSave && options?.force !== true) {
      return false;
    }
    pendingSnapshotSave = false;
    if (!canPersistLocalSnapshot()) {
      return false;
    }
    snapshotSavePromise = (async () => {
      try {
        await saveWorkspaceSnapshot();
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message || saveFailedMessage.value : saveFailedMessage.value;
        if (message !== lastSnapshotSaveError) {
          onSaveError(message);
          lastSnapshotSaveError = message;
        }
        return false;
      } finally {
        snapshotSavePromise = null;
      }
    })();
    return await snapshotSavePromise;
  };

  const flushWorkspaceSnapshotSave = async () => {
    return await runWorkspaceSnapshotSave();
  };

  const saveWorkspaceSnapshotNow = async () => {
    return await runWorkspaceSnapshotSave({ force: true });
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

  const resetSnapshotObserver = () => {
    detachSnapshotObserver?.();
    detachSnapshotObserver = null;
    observedSnapshotDocument = null;
  };

  const observeSnapshotDocument = (document: Y.Doc | null) => {
    resetSnapshotObserver();
    if (!(document instanceof Y.Doc)) {
      return;
    }
    const handleUpdate = () => {
      scheduleWorkspaceSnapshotSave();
    };
    document.on("update", handleUpdate);
    observedSnapshotDocument = document;
    detachSnapshotObserver = () => {
      observedSnapshotDocument?.off("update", handleUpdate);
    };
  };

  const setSnapshotDocument = (document: unknown) => {
    localSnapshotDocument.value = document instanceof Y.Doc ? document : null;
    observeSnapshotDocument(localSnapshotDocument.value);
  };

  const resetWorkspaceSnapshotPersistence = () => {
    clearSnapshotSaveTimer();
    pendingSnapshotSave = false;
    resetSnapshotObserver();
    localSnapshotDocument.value = null;
  };

  return {
    flushWorkspaceSnapshotSave,
    saveWorkspaceSnapshotNow,
    scheduleWorkspaceSnapshotSave,
    setSnapshotDocument,
    resetWorkspaceSnapshotPersistence,
  };
};
