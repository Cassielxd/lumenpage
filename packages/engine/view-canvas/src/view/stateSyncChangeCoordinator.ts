type CreateStateSyncChangeCoordinatorArgs = {
  getEditorState: () => any;
  setEditorState: (state: any) => void;
  applyTransaction: (prevState: any, tr: any) => any;
  clampOffset: (offset: number) => number;
  docPosToTextOffset: (doc: any, pos: number) => number;
  setCaretOffsetValue: (offset: number) => void;
  getPendingPreferredUpdate: () => boolean;
  setPendingPreferredUpdate: (pending: boolean) => void;
  hasPendingLayoutWork: () => boolean;
  updateCaret: (updatePreferred: boolean) => void;
  logSelection: (state: any) => void;
  updateStatus: () => void;
  scheduleRender: () => void;
  scheduleLayout: () => void;
  flushPendingScrollIntoView: () => void;
};

export const createStateSyncChangeCoordinator = ({
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
}: CreateStateSyncChangeCoordinatorArgs) => {
  const syncCaretOffsetForState = (editorState: any) => {
    const nextCaretOffset = clampOffset(
      docPosToTextOffset(editorState.doc, editorState.selection.head)
    );
    setCaretOffsetValue(nextCaretOffset);
  };

  const syncAfterStateChange = (editorState = getEditorState()) => {
    syncCaretOffsetForState(editorState);
    const hasPendingLayout = hasPendingLayoutWork();
    if (hasPendingLayout) {
      setPendingPreferredUpdate(true);
      updateStatus();
      return;
    }
    updateCaret(getPendingPreferredUpdate());
    setPendingPreferredUpdate(true);
    logSelection(editorState);
    updateStatus();
    flushPendingScrollIntoView();
    scheduleRender();
  };

  const dispatchTransaction = (tr: any) => {
    const prevState = getEditorState();
    const nextState = applyTransaction(prevState, tr);
    setEditorState(nextState);
    if (tr.docChanged) {
      syncCaretOffsetForState(nextState);
      setPendingPreferredUpdate(true);
      updateStatus();
      scheduleLayout();
      return;
    }
    if (hasPendingLayoutWork()) {
      syncCaretOffsetForState(nextState);
      setPendingPreferredUpdate(true);
      updateStatus();
      return;
    }
    syncAfterStateChange(nextState);
  };

  return {
    syncAfterStateChange,
    dispatchTransaction,
  };
};
