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
  let pendingScrollIntoViewPos: number | null = null;
  let hasPendingScrollIntoView = false;

  const getActiveElement = () => {
    const ownerDocument = inputEl?.ownerDocument || (typeof document !== "undefined" ? document : null);
    return ownerDocument?.activeElement ?? null;
  };

  const flushPendingScrollIntoView = () => {
    if (!hasPendingScrollIntoView) {
      return;
    }
    const requestedPos = pendingScrollIntoViewPos;
    hasPendingScrollIntoView = false;
    pendingScrollIntoViewPos = null;
    if (typeof scrollIntoViewAtPos !== "function") {
      return;
    }
    try {
      scrollIntoViewAtPos(Number.isFinite(requestedPos) ? Number(requestedPos) : undefined);
    } catch (_error) {
      // no-op
    }
  };

  const requestScrollIntoView = (pos?: number | null) => {
    pendingScrollIntoViewPos = Number.isFinite(pos) ? Number(pos) : null;
    hasPendingScrollIntoView = true;
    if (!hasPendingLayoutWork()) {
      flushPendingScrollIntoView();
    }
  };

  const flushPendingScrollIntoViewIfReady = () => {
    if (!hasPendingLayoutWork()) {
      flushPendingScrollIntoView();
    }
  };

  const updateStatus = () => {
    const layout = getLayout();
    const pageCount = layout ? layout.pages.length : 0;
    const inputFocused = getActiveElement() === inputEl;
    const focused: "typing" | "idle" = inputFocused ? "typing" : "idle";
    const fromProps =
      typeof queryEditorProp === "function"
        ? queryEditorProp("formatStatusText", { pageCount, focused, inputFocused })
        : null;
    status.textContent =
      typeof fromProps === "string" && fromProps.trim().length > 0
        ? fromProps
        : `${pageCount} pages | ${focused}`;
  };

  const syncAfterStateChange = () => {
    const editorState = getEditorState();
    const nextCaretOffset = clampOffset(
      docPosToTextOffset(editorState.doc, editorState.selection.head)
    );
    setCaretOffsetValue(nextCaretOffset);
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
    const applyStart = performance.now();
    const nextState = applyTransaction(prevState, tr);
    void applyStart;
    setEditorState(nextState);
    if (tr.docChanged) {
      const nextCaretOffset = clampOffset(
        docPosToTextOffset(nextState.doc, nextState.selection.head)
      );
      setCaretOffsetValue(nextCaretOffset);
      setPendingPreferredUpdate(true);
      updateStatus();
      scheduleRender();
      scheduleLayout();
      return;
    }
    const hasPendingLayout = hasPendingLayoutWork();
    if (hasPendingLayout) {
      const nextCaretOffset = clampOffset(
        docPosToTextOffset(nextState.doc, nextState.selection.head)
      );
      setCaretOffsetValue(nextCaretOffset);
      setPendingPreferredUpdate(true);
      updateStatus();
      return;
    }
    syncAfterStateChange();
  };

  return {
    updateStatus,
    requestScrollIntoView,
    flushPendingScrollIntoView,
    flushPendingScrollIntoViewIfReady,
    syncAfterStateChange,
    dispatchTransaction,
  };
};
