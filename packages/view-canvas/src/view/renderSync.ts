import { buildDecorationDrawData } from "./render/decorations";
import { NodeSelection } from "lumenpage-state";
import { tableCellSelectionToRects, tableRangeSelectionToCellRects } from "./render/selection";
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
  buildLayoutIndex,
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

  // 选区几何扩展点：允许外部替换表格选区矩形计算，核心仅负责分发与兜底。
  const resolveSelectionGeometry = () => {
    const fromProps =
      typeof queryEditorProp === "function" ? queryEditorProp("selectionGeometry") : null;
    if (fromProps && typeof fromProps === "object") {
      return fromProps;
    }
    return null;
  };

  // 统一解析“表格相关选区矩形”，优先外部 provider，缺失时回退内置默认实现。
  const resolveTableSelectionRects = ({
    layout,
    editorState,
    selection,
    layoutIndex,
  }: {
    layout: any;
    editorState: any;
    selection: { from: number; to: number };
    layoutIndex: any;
  }) => {
    const geometry = resolveSelectionGeometry();
    const tableCellRectsResolver =
      typeof geometry?.tableCellSelectionToRects === "function"
        ? geometry.tableCellSelectionToRects
        : tableCellSelectionToRects;
    const tableRangeRectsResolver =
      typeof geometry?.tableRangeSelectionToCellRects === "function"
        ? geometry.tableRangeSelectionToCellRects
        : tableRangeSelectionToCellRects;

    const tableCellRects = tableCellRectsResolver({
      layout,
      selection: editorState?.selection,
      doc: editorState?.doc,
      scrollTop: scrollArea.scrollTop,
      viewportWidth: scrollArea.clientWidth,
      layoutIndex,
      docPosToTextOffset,
    });
    if (Array.isArray(tableCellRects) && tableCellRects.length > 0) {
      return [...tableCellRects, ...tableCellRects];
    }

    const tableRangeRects = tableRangeRectsResolver({
      layout,
      fromOffset: selection.from,
      toOffset: selection.to,
      scrollTop: scrollArea.scrollTop,
      viewportWidth: scrollArea.clientWidth,
      layoutIndex,
      docPosToTextOffset,
    });
    if (Array.isArray(tableRangeRects) && tableRangeRects.length > 0) {
      return [...tableRangeRects, ...tableRangeRects];
    }

    return null;
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
        const tableSelectionRects = resolveTableSelectionRects({
          layout,
          editorState,
          selection,
          layoutIndex,
        });
        if (Array.isArray(tableSelectionRects) && tableSelectionRects.length > 0) {
          selectionRects = tableSelectionRects;
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
        renderer.render(layout, scrollArea, getCaretRect(), selectionRects, [], decorationData);
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
    if (layoutPipeline.settings?.debugPerf) {
      const prevLayout = getLayout?.() ?? null;
      console.debug("[render-sync]", {
        version,
        prevLayoutPages: prevLayout?.pages?.length ?? 0,
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










