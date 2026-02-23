import { buildDecorationDrawData } from "./render/decorations";
import { NodeSelection } from "lumenpage-state";
import { tableCellSelectionToRects, tableRangeSelectionToCellRects } from "./render/selection";
const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

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
  paginationTiming = false,
  renderTiming = false,
}) => {
  let layoutVersion = 0;
  let layoutRafId = 0;
  let stateSyncRafId = 0;
  let overlaySyncRafId = 0;
  let layoutDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDocLayoutFinishedAt = 0;
  let lastDocLayoutMs = 0;
  let pendingOverlaySyncContext: { layout: any; layoutIndex: any } | null = null;
  let lastRenderTimingLogAt = 0;
  let lastSelectionRectsKey = "";
  let lastSelectionRects: any[] | null = null;
  let lastTableSelectionRectsKey = "";
  let lastTableSelectionRects: any[] | null = null;
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

  const isInTableAtResolvedPos = ($pos: any) => {
    if (!$pos || !Number.isFinite($pos.depth)) {
      return false;
    }
    for (let depth = $pos.depth; depth >= 0; depth -= 1) {
      if ($pos.node(depth)?.type?.name?.startsWith("table")) {
        return true;
      }
    }
    return false;
  };

  const shouldComputeTableSelectionRects = (editorState: any, selection: { from: number; to: number }) => {
    const pmSel = editorState?.selection;
    if (!pmSel) {
      return false;
    }
    if (pmSel?.$anchorCell || pmSel?.$headCell || pmSel?.constructor?.name === "CellSelection") {
      return true;
    }
    if (selection.from === selection.to) {
      return false;
    }
    return isInTableAtResolvedPos(pmSel?.$from) || isInTableAtResolvedPos(pmSel?.$to);
  };

  const scheduleRender = () => {
    if (getRafId()) {
      return;
    }

    setRafId(
      requestAnimationFrame(() => {
        const renderStart = renderTiming ? now() : 0;
        setRafId(0);
        const layout = getLayout();
        if (!layout) {
          return;
        }
        const layoutIndex = getLayoutIndex?.() || null;
        const editorState = getEditorState();
        const textLength = getText().length;
        const scrollTop = Math.round(scrollArea.scrollTop * 10) / 10;
        const viewportWidth = scrollArea.clientWidth;
        const layoutToken = Number.isFinite(layout?.__version) ? Number(layout.__version) : layoutVersion;
        const selectionStart = renderTiming ? now() : 0;
        const selection = getSelectionOffsets(editorState, docPosToTextOffset, clampOffset);
        const selectionRectsKey = `${layoutToken}|${selection.from}|${selection.to}|${scrollTop}|${viewportWidth}|${textLength}`;
        let selectionRects =
          selectionRectsKey === lastSelectionRectsKey && Array.isArray(lastSelectionRects)
            ? lastSelectionRects
            : selectionToRects(
                layout,
                selection.from,
                selection.to,
                scrollTop,
                viewportWidth,
                textLength,
                layoutIndex
              );
        if (selectionRectsKey !== lastSelectionRectsKey) {
          lastSelectionRectsKey = selectionRectsKey;
          lastSelectionRects = selectionRects;
        }
        const selectionMs = renderTiming ? Math.round((now() - selectionStart) * 100) / 100 : 0;

        const tableSelectionStart = renderTiming ? now() : 0;
        let tableSelectionRects = null;
        if (shouldComputeTableSelectionRects(editorState, selection)) {
          const tableSelectionKey = `${layoutToken}|${selection.from}|${selection.to}|${scrollTop}|${viewportWidth}|table`;
          tableSelectionRects =
            tableSelectionKey === lastTableSelectionRectsKey && Array.isArray(lastTableSelectionRects)
              ? lastTableSelectionRects
              : resolveTableSelectionRects({
                  layout,
                  editorState,
                  selection,
                  layoutIndex,
                });
          if (tableSelectionKey !== lastTableSelectionRectsKey) {
            lastTableSelectionRectsKey = tableSelectionKey;
            lastTableSelectionRects = tableSelectionRects;
          }
        }
        if (Array.isArray(tableSelectionRects) && tableSelectionRects.length > 0) {
          selectionRects = tableSelectionRects;
        }
        const tableSelectionMs = renderTiming
          ? Math.round((now() - tableSelectionStart) * 100) / 100
          : 0;

        const decorationStart = renderTiming ? now() : 0;
        const decorations = typeof getDecorations === "function" ? getDecorations() : null;
        const decorationData = decorations
          ? buildDecorationDrawData({
              layout,
              layoutIndex,
              doc: editorState?.doc,
              decorations,
              scrollTop,
              viewportWidth,
              textLength,
              docPosToTextOffset,
              coordsAtPos,
            })
          : null;
        const decorationMs = renderTiming
          ? Math.round((now() - decorationStart) * 100) / 100
          : 0;

        const nodeOverlayStart = renderTiming ? now() : 0;
        scheduleNodeOverlaySync(layout, layoutIndex);
        const nodeOverlayMs = renderTiming
          ? Math.round((now() - nodeOverlayStart) * 100) / 100
          : 0;

        const rendererStart = renderTiming ? now() : 0;
        renderer.render(layout, scrollArea, getCaretRect(), selectionRects, [], decorationData);
        const rendererMs = renderTiming ? Math.round((now() - rendererStart) * 100) / 100 : 0;

        if (renderTiming) {
          const totalMs = Math.round((now() - renderStart) * 100) / 100;
          const current = now();
          if (!lastRenderTimingLogAt || current - lastRenderTimingLogAt >= 120) {
            lastRenderTimingLogAt = current;
            const renderPerf = layoutPipeline?.settings?.__perf?.render ?? null;
            console.info(
              `[render-timing] ${JSON.stringify({
                totalMs,
                selectionMs,
                tableSelectionMs,
                decorationMs,
                nodeOverlayMs,
                rendererMs,
                activePages: renderPerf?.activePages ?? null,
                redrawPages: renderPerf?.redrawPages ?? null,
                cachedPages: renderPerf?.cachedPages ?? null,
                compositeMs: renderPerf?.compositeMs ?? null,
                overlayMs: renderPerf?.overlayMs ?? null,
              })}`
            );
          }
        }
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
    const isDocChanged = changeSummary?.docChanged === true;
    const ts = now();
    const rapidDocChanges =
      isDocChanged && lastDocLayoutFinishedAt > 0 && ts - lastDocLayoutFinishedAt < 140;
    const heavyLastLayout = lastDocLayoutMs > 120;
    if (rapidDocChanges && heavyLastLayout) {
      if (!layoutDebounceTimer) {
        layoutDebounceTimer = setTimeout(() => {
          layoutDebounceTimer = null;
          updateLayout();
        }, 90);
      }
      return;
    }

    const nextPageWidth = resolvePageWidth?.();
    const prevLayout = getLayout?.() ?? null;
    const currentPageWidth = Number(layoutPipeline.settings.pageWidth);
    const widthDiff =
      Number.isFinite(nextPageWidth) && nextPageWidth > 0
        ? Math.abs(currentPageWidth - Number(nextPageWidth))
        : 0;
    // 忽略浮点抖动，避免每次都误判为页宽变化导致清空缓存。
    const widthChanged =
      Number.isFinite(nextPageWidth) && nextPageWidth > 0 && Number(widthDiff) > 0.5;

    // 性能快路径：文档未变化且页宽未变化时，直接复用当前布局，避免重复全量分页。
    if (prevLayout && !widthChanged && changeSummary?.docChanged !== true) {
      clearPendingChangeSummary?.();
      clearPendingSteps?.();
      updateStatus();
      scheduleRender();
      return;
    }

    if (Number.isFinite(nextPageWidth) && nextPageWidth > 0) {
      if (widthChanged) {
        layoutPipeline.settings.pageWidth = nextPageWidth;
        layoutPipeline.clearCache?.();
      }
    }
    const version = (layoutVersion += 1);
    clearPendingChangeSummary?.();
    clearPendingSteps?.();
    const paginationStart = paginationTiming ? now() : 0;
    const layout = layoutPipeline.layoutFromDoc(getEditorState().doc, {
      previousLayout: getLayout?.() ?? null,
      changeSummary,
      docPosToTextOffset,
    });
    if (isDocChanged) {
      lastDocLayoutFinishedAt = now();
      lastDocLayoutMs = lastDocLayoutFinishedAt - paginationStart;
    }
    if (paginationTiming) {
      const ms = Math.round((now() - paginationStart) * 100) / 100;
      const layoutPerf = layoutPipeline?.settings?.__perf?.layout ?? null;
      const payload = {
        version,
        ms,
        pages: Array.isArray(layout?.pages) ? layout.pages.length : 0,
        docChanged: !!changeSummary?.docChanged,
        beforeFrom: changeSummary?.blocks?.before?.fromIndex ?? null,
        beforeTo: changeSummary?.blocks?.before?.toIndex ?? null,
        afterFrom: changeSummary?.blocks?.after?.fromIndex ?? null,
        afterTo: changeSummary?.blocks?.after?.toIndex ?? null,
        reusedPages: layoutPerf?.reusedPages ?? null,
        reuseReason: layoutPerf?.reuseReason ?? null,
        syncAfterIndex: layoutPerf?.syncAfterIndex ?? null,
        syncFromIndex: layoutPerf?.syncFromIndex ?? null,
        maybeSyncReason: layoutPerf?.maybeSyncReason ?? null,
        blocks: layoutPerf?.blocks ?? null,
        cachedBlocks: layoutPerf?.cachedBlocks ?? null,
        blockCacheHitRate: layoutPerf?.blockCacheHitRate ?? null,
        disablePageReuse: layoutPerf?.disablePageReuse ?? null,
      };
      console.info(`[pagination-timing] ${JSON.stringify(payload)}`);
    }
    applyLayout(layout, version, changeSummary);
  };

  const scheduleLayout = () => {
    if (layoutDebounceTimer) {
      clearTimeout(layoutDebounceTimer);
      layoutDebounceTimer = null;
    }
    if (layoutRafId) {
      return;
    }
    layoutRafId = requestAnimationFrame(() => {
      layoutRafId = 0;
      updateLayout();
    });
  };

  const scheduleNodeOverlaySync = (layout: any, layoutIndex: any) => {
    pendingOverlaySyncContext = { layout, layoutIndex };
    if (overlaySyncRafId) {
      return;
    }
    overlaySyncRafId = requestAnimationFrame(() => {
      overlaySyncRafId = 0;
      const context = pendingOverlaySyncContext;
      pendingOverlaySyncContext = null;
      if (!context) {
        return;
      }
      syncNodeViewOverlays?.({
        layout: context.layout,
        layoutIndex: context.layoutIndex,
        scrollArea,
      });
    });
  };

  const scheduleStateSync = () => {
    if (stateSyncRafId) {
      return;
    }
    stateSyncRafId = requestAnimationFrame(() => {
      stateSyncRafId = 0;
      syncAfterStateChange();
    });
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
      scheduleLayout();
      scheduleStateSync();
      return;
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











