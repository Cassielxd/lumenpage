import { createStateSyncChangeCoordinator } from "./stateSyncChangeCoordinator.js";
import { createStateSyncScrollCoordinator } from "./stateSyncScrollCoordinator.js";
import { createStateSyncStatus } from "./stateSyncStatus.js";

type CreateStateSyncCoordinatorArgs = {
  getEditorState: () => any;
  setEditorState: (state: any) => void;
  applyTransaction: (prevState: any, tr: any) => any;
  getLayout: () => any;
  inputEl: any;
  status: { textContent: string };
  queryEditorProp?: (name: string, args?: any) => any;
  scrollIntoViewAtPos?: (pos?: number) => void;
  clampOffset: (offset: number) => number;
  docPosToTextOffset: (doc: any, pos: number) => number;
  setCaretOffsetValue: (offset: number) => void;
  getPendingPreferredUpdate: () => boolean;
  setPendingPreferredUpdate: (pending: boolean) => void;
  hasPendingLayoutWork: () => boolean;
  updateCaret: (updatePreferred: boolean) => void;
  logSelection: (state: any) => void;
  scheduleRender: () => void;
  scheduleLayout: () => void;
};

export const createStateSyncCoordinator = ({
  getEditorState,
  setEditorState,
  applyTransaction,
  getLayout,
  inputEl,
  status,
  queryEditorProp,
  scrollIntoViewAtPos,
  clampOffset,
  docPosToTextOffset,
  setCaretOffsetValue,
  getPendingPreferredUpdate,
  setPendingPreferredUpdate,
  hasPendingLayoutWork,
  updateCaret,
  logSelection,
  scheduleRender,
  scheduleLayout,
}: CreateStateSyncCoordinatorArgs) => {
  const { updateStatus } = createStateSyncStatus({
    getLayout,
    inputEl,
    status,
    queryEditorProp,
  });

  const {
    requestScrollIntoView,
    flushPendingScrollIntoView,
    flushPendingScrollIntoViewIfReady,
  } = createStateSyncScrollCoordinator({
    hasPendingLayoutWork,
    scrollIntoViewAtPos,
  });

  const { syncAfterStateChange, dispatchTransaction } = createStateSyncChangeCoordinator({
    getEditorState,
    setEditorState,
    applyTransaction,
    clampOffset,
    docPosToTextOffset,
    setCaretOffsetValue,
    getPendingPreferredUpdate,
    setPendingPreferredUpdate,
    hasPendingLayoutWork,
    updateCaret,
    logSelection,
    updateStatus,
    scheduleRender,
    scheduleLayout,
    flushPendingScrollIntoView,
  });

  return {
    updateStatus,
    requestScrollIntoView,
    flushPendingScrollIntoView,
    flushPendingScrollIntoViewIfReady,
    syncAfterStateChange,
    dispatchTransaction,
  };
};
