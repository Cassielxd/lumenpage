import { buildDecorationDrawData } from "./render/decorations";
import { NodeSelection } from "lumenpage-state";
import { tableCellSelectionToRects, tableRangeSelectionToCellRects } from "./render/selection";
export const createRenderSync = ({
  getEditorState,
  setEditorState,
  applyTransaction,
  layoutPipeline,
  layoutWorker,
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
  getPendingChangeSummary,
  clearPendingChangeSummary,
  getPendingSteps,
  clearPendingSteps,
  resolvePageWidth,
  queryEditorProp,
}) => {
  let layoutVersion = 0;
  let workerDisabled = false;
  let workerHasDoc = false;
  let workerErrorCount = 0;
  const getActiveElement = () => {
    const ownerDocument = inputEl?.ownerDocument || (typeof document !== "undefined" ? document : null);
    return ownerDocument?.activeElement ?? null;
  };

  const updateStatus = () => {
    const layout = getLayout();
    const pageCount = layout ? layout.pages.length : 0;
    const focused = getActiveElement() === inputEl ? "typing" : "idle";
    status.textContent = `${pageCount} pages | ${focused}`;
  };

  const resolveBlockSelection = () => {
    const config = blockSelectionConfig || {};
    const focused = getActiveElement() === inputEl;
    const onlyWhenFocused = config.onlyWhenFocused !== false;
    let enabled = config.enabled !== false && (!onlyWhenFocused || focused);
    let types = Array.isArray(config.types) ? config.types : null;
    let excludeTypes = Array.isArray(config.excludeTypes) ? config.excludeTypes : null;
    if (!types && !excludeTypes) {
      // Default behavior: keep generic block highlight, but avoid table-level flood highlight.
      excludeTypes = ["table"];
    }

    // 支持通过 EditorProps/PluginProps 下沉活动块高亮策略，避免核心白名单硬编码。
    const fromProps = typeof queryEditorProp === "function" ? queryEditorProp("blockSelection") : null;
    if (fromProps === false) {
      enabled = false;
    } else if (Array.isArray(fromProps)) {
      types = fromProps;
      excludeTypes = null;
    } else if (fromProps && typeof fromProps === "object") {
      if (fromProps.enabled === false) {
        enabled = false;
      } else if (fromProps.enabled === true) {
        enabled = !onlyWhenFocused || focused;
      }
      if (Array.isArray(fromProps.types)) {
        types = fromProps.types;
        excludeTypes = null;
      }
      if (Array.isArray(fromProps.excludeTypes)) {
        excludeTypes = fromProps.excludeTypes;
      }
    }
    return { enabled, types, excludeTypes };
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
        const editorState = getEditorState();
        const selection = getSelectionOffsets(getEditorState(), docPosToTextOffset, clampOffset);
        let selectionRects = selectionToRects(
          layout,
          selection.from,
          selection.to,
          scrollArea.scrollTop,
          scrollArea.clientWidth,
          getText().length,
          layoutIndex
        );
        const tableCellRects = tableCellSelectionToRects({
          layout,
          selection: editorState?.selection,
          doc: editorState?.doc,
          scrollTop: scrollArea.scrollTop,
          viewportWidth: scrollArea.clientWidth,
          layoutIndex,
          docPosToTextOffset,
        });
        if (tableCellRects.length > 0) {
          // Draw twice to increase perceived emphasis for cell-range selections.
          selectionRects = [...tableCellRects, ...tableCellRects];
        } else {
          const tableRangeRects = tableRangeSelectionToCellRects({
            layout,
            fromOffset: selection.from,
            toOffset: selection.to,
            scrollTop: scrollArea.scrollTop,
            viewportWidth: scrollArea.clientWidth,
            layoutIndex,
          });
          if (tableRangeRects.length > 0) {
            selectionRects = [...tableRangeRects, ...tableRangeRects];
          }
        }
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
            { blockTypes: blockSelection.types, excludeBlockTypes: blockSelection.excludeTypes },
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
    const selection = getEditorState().selection;
    if (selection instanceof NodeSelection) {
      setCaretRect(null);
      setInputPosition?.(-9999, -9999);
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
  const applyLayout = (nextLayout, version, changeSummary) => {
    if (!nextLayout) {
      return;
    }
    if (version < layoutVersion) {
      return;
    }
    const prevLayout = getLayout?.() ?? null;
    nextLayout.__version = version;
    nextLayout.__changeSummary = changeSummary ?? null;
    nextLayout.__forceRedraw = !prevLayout;
    setLayout(nextLayout);
    if (typeof buildLayoutIndex === "function") {
      setLayoutIndex(buildLayoutIndex(nextLayout));
    }
    spacer.style.height = `${nextLayout.totalHeight}px`;
    updateCaret(true);
    updateStatus();
    scheduleRender();
  };
  const updateLayout = () => {
    const changeSummary = getPendingChangeSummary?.() ?? null;
    const pendingSteps = getPendingSteps?.() ?? null;
    const hasSteps = Array.isArray(pendingSteps) && pendingSteps.length > 0;
    const nextPageWidth = resolvePageWidth?.();
    if (Number.isFinite(nextPageWidth) && nextPageWidth > 0) {
      if (layoutPipeline.settings.pageWidth !== nextPageWidth) {
        layoutPipeline.settings.pageWidth = nextPageWidth;
        layoutPipeline.clearCache?.();
      }
    }
    const version = (layoutVersion += 1);
    clearPendingChangeSummary?.();
    clearPendingSteps?.();
    const requestPayload = {
      doc: workerHasDoc && hasSteps ? undefined : getEditorState().doc,
      steps: workerHasDoc && hasSteps ? pendingSteps : undefined,
      changeSummary,
      pageWidth: layoutPipeline.settings.pageWidth,
      version,
    };
    if (layoutWorker && !workerDisabled && layoutWorker.isActive()) {
      layoutWorker
        .requestLayout(requestPayload)
        .then((result) => {
          workerHasDoc = true;
          workerErrorCount = 0;
          applyLayout(result.layout, result.version, changeSummary);
        })
        .catch(() => {
          workerHasDoc = false;
          workerErrorCount += 1;
          if (workerErrorCount >= 2) {
            workerDisabled = true;
          }
          const layout = layoutPipeline.layoutFromDoc(getEditorState().doc, {
            previousLayout: getLayout?.() ?? null,
            changeSummary,
            docPosToTextOffset,
          });
          applyLayout(layout, version, changeSummary);
        });
      return;
    }
    if (layoutPipeline.settings?.debugPerf) {
      const prevLayout = getLayout?.() ?? null;
      console.debug("[render-sync]", {
        version,
        prevLayoutPages: prevLayout?.pages?.length ?? 0,
        hasSteps,
        hasChangeSummary: !!changeSummary,
      });
    }
    const layout = layoutPipeline.layoutFromDoc(getEditorState().doc, {
      previousLayout: getLayout?.() ?? null,
      changeSummary,
      docPosToTextOffset,
    });
    applyLayout(layout, version, changeSummary);
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









