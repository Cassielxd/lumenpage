export const createRenderSync = ({
  getEditorState,
  setEditorState,
  applyTransaction,
  layoutPipeline,
  renderer,
  spacer,
  scrollArea,
  status,
  inputEl,
  getText,
  clampOffset,
  docPosToTextOffset,
  getSelectionOffsets,
  selectionToRects,
  coordsAtPos,
  logSelection,
  getCaretOffset,
  setCaretOffsetValue,
  getCaretRect,
  setCaretRect,
  setPreferredX,
  getPendingPreferredUpdate,
  setPendingPreferredUpdate,
  getLayout,
  setLayout,
  getRafId,
  setRafId,
  setInputPosition,
}) => {
  const updateStatus = () => {
    const layout = getLayout();
    const pageCount = layout ? layout.pages.length : 0;
    const focused = document.activeElement === inputEl ? "typing" : "idle";
    status.textContent = `${pageCount} pages | ${focused}`;
  };

  const scheduleRender = () => {
    if (getRafId()) {
      return;
    }

    setRafId(
      requestAnimationFrame(() => {
        setRafId(0);
        const layout = getLayout();
        const selection = getSelectionOffsets(getEditorState(), docPosToTextOffset, clampOffset);
        const selectionRects = selectionToRects(
          layout,
          selection.from,
          selection.to,
          scrollArea.scrollTop,
          scrollArea.clientWidth,
          getText().length
        );
        renderer.render(layout, scrollArea, getCaretRect(), selectionRects);
      })
    );
  };

  const updateCaret = (updatePreferred) => {
    const layout = getLayout();
    if (!layout) {
      return;
    }

    const caretRect = coordsAtPos(
      layout,
      getCaretOffset(),
      scrollArea.scrollTop,
      scrollArea.clientWidth,
      getText().length
    );
    setCaretRect(caretRect);
    if (caretRect) {
      setInputPosition(caretRect.x, caretRect.y);
      if (updatePreferred) {
        setPreferredX(caretRect.x);
      }
    }
  };

  const updateLayout = () => {
    const layout = layoutPipeline.layoutFromDoc(getEditorState().doc);
    setLayout(layout);
    spacer.style.height = `${layout.totalHeight}px`;
  };

  const syncAfterStateChange = () => {
    const editorState = getEditorState();
    const nextCaretOffset = clampOffset(
      docPosToTextOffset(editorState.doc, editorState.selection.head)
    );
    setCaretOffsetValue(nextCaretOffset);
    updateCaret(getPendingPreferredUpdate());
    setPendingPreferredUpdate(true);
    logSelection(editorState);
    updateStatus();
    scheduleRender();
  };

  const dispatchTransaction = (tr) => {
    const nextState = applyTransaction(getEditorState(), tr);
    setEditorState(nextState);
    if (tr.docChanged) {
      updateLayout();
    }
    syncAfterStateChange();
  };

  return {
    updateStatus,
    scheduleRender,
    updateCaret,
    updateLayout,
    syncAfterStateChange,
    dispatchTransaction,
  };
};
