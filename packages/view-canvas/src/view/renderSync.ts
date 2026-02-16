import { buildDecorationDrawData } from "./render/decorations";

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
  getDecorations,
  selectionToRects,
  activeBlockToRects,
  buildLayoutIndex,
  blockSelectionConfig,
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
  getLayoutIndex,
  setLayoutIndex,
  getRafId,
  setRafId,
  setInputPosition,
  syncNodeViewOverlays,
}) => {
  const updateStatus = () => {
    const layout = getLayout();
    const pageCount = layout ? layout.pages.length : 0;
    const focused = document.activeElement === inputEl ? "typing" : "idle";
    status.textContent = `${pageCount} pages | ${focused}`;
  };

  const resolveBlockSelection = () => {
    const config = blockSelectionConfig || {};
    const focused = document.activeElement === inputEl;
    const onlyWhenFocused = config.onlyWhenFocused !== false;
    const enabled = config.enabled !== false && (!onlyWhenFocused || focused);
    const types = Array.isArray(config.types) ? config.types : ["paragraph", "heading", "image"];
    return { enabled, types };
  };

  const scheduleRender = () => {
    if (getRafId()) {
      return;
    }

    setRafId(
      requestAnimationFrame(() => {
        setRafId(0);
        const layout = getLayout();
        const layoutIndex = getLayoutIndex?.() || null;
        const selection = getSelectionOffsets(getEditorState(), docPosToTextOffset, clampOffset);
        const selectionRects = selectionToRects(
          layout,
          selection.from,
          selection.to,
          scrollArea.scrollTop,
          scrollArea.clientWidth,
          getText().length,
          layoutIndex
        );
        let blockRects = [];
        const blockSelection = resolveBlockSelection();
        if (
          selection.from === selection.to &&
          blockSelection.enabled &&
          typeof activeBlockToRects === "function"
        ) {
          blockRects = activeBlockToRects(
            layout,
            selection.from,
            scrollArea.scrollTop,
            scrollArea.clientWidth,
            getText().length,
            { blockTypes: blockSelection.types },
            layoutIndex
          );
        }
        const decorationData = buildDecorationDrawData({
          layout,
          layoutIndex,
          doc: getEditorState().doc,
          decorations: typeof getDecorations === "function" ? getDecorations() : null,
          scrollTop: scrollArea.scrollTop,
          viewportWidth: scrollArea.clientWidth,
          textLength: getText().length,
          docPosToTextOffset,
          coordsAtPos,
        });
        syncNodeViewOverlays?.();
        renderer.render(layout, scrollArea, getCaretRect(), selectionRects, blockRects, decorationData);
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
    if (typeof buildLayoutIndex === "function") {
      setLayoutIndex(buildLayoutIndex(layout));
    }
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









