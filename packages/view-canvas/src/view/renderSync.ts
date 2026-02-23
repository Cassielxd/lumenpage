import { buildDecorationDrawData } from "./render/decorations";
import { NodeSelection } from "lumenpage-state";
import { tableCellSelectionToRects, tableRangeSelectionToCellRects } from "./render/selection";
import {
  PaginationWorkerClient,
  createWorkerPaginationRunsPayload,
  getWorkerPaginationIneligibleReason,
  isWorkerPaginationEligibleDoc,
} from "./paginationWorkerClient";
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
  let pendingOverlaySyncContext: { layout: any; layoutIndex: any } | null = null;
  let lastOverlayLayoutToken = -1;
  let lastOverlayScrollTop = Number.NaN;
  let lastOverlayViewportWidth = -1;
  let lastRenderTimingLogAt = 0;
  let lastSelectionRectsKey = "";
  let lastSelectionRects: any[] | null = null;
  let lastSelectionScrollTop = Number.NaN;
  let lastTableSelectionRectsKey = "";
  let lastTableSelectionRects: any[] | null = null;
  let lastTableSelectionScrollTop = Number.NaN;
  let asyncLayoutInFlight = false;
  let asyncLayoutQueued = false;
  let fullSettleTimer: ReturnType<typeof setTimeout> | null = null;
  let forceFullPass = false;
  const workerConfig = layoutPipeline?.settings?.paginationWorker ?? null;
  const paginationWorkerProvider =
    workerConfig?.enabled === true && typeof workerConfig?.provider?.requestLayout === "function"
      ? workerConfig.provider
      : null;
  const paginationWorker =
    workerConfig?.enabled === true &&
    workerConfig?.mode === "experimental-runs" &&
    !paginationWorkerProvider
      ? new PaginationWorkerClient()
      : null;
  const getActiveElement = () => {
    const ownerDocument = inputEl?.ownerDocument || (typeof document !== "undefined" ? document : null);
    return ownerDocument?.activeElement ?? null;
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
        try {
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
          const selectionRectsKey = `${layoutToken}|${selection.from}|${selection.to}|${viewportWidth}|${textLength}`;
          const canShiftSelectionRects =
            selectionRectsKey === lastSelectionRectsKey &&
            Array.isArray(lastSelectionRects) &&
            Number.isFinite(lastSelectionScrollTop);
          let selectionRects = canShiftSelectionRects
            ? lastSelectionRects!.map((rect) => ({
                ...rect,
                y: rect.y - (scrollTop - lastSelectionScrollTop),
              }))
            : selectionToRects(
                layout,
                selection.from,
                selection.to,
                scrollTop,
                viewportWidth,
                textLength,
                layoutIndex
              );
          lastSelectionRectsKey = selectionRectsKey;
          lastSelectionRects = selectionRects;
          lastSelectionScrollTop = scrollTop;
          const selectionMs = renderTiming ? Math.round((now() - selectionStart) * 100) / 100 : 0;

          const tableSelectionStart = renderTiming ? now() : 0;
          let tableSelectionRects = null;
          if (shouldComputeTableSelectionRects(editorState, selection)) {
            const tableSelectionKey = `${layoutToken}|${selection.from}|${selection.to}|${viewportWidth}|table`;
            const canShiftTableSelectionRects =
              tableSelectionKey === lastTableSelectionRectsKey &&
              Array.isArray(lastTableSelectionRects) &&
              Number.isFinite(lastTableSelectionScrollTop);
            tableSelectionRects = canShiftTableSelectionRects
              ? lastTableSelectionRects!.map((rect) => ({
                  ...rect,
                  y: rect.y - (scrollTop - lastTableSelectionScrollTop),
                }))
              : resolveTableSelectionRects({
                  layout,
                  editorState,
                  selection,
                  layoutIndex,
                });
            lastTableSelectionRectsKey = tableSelectionKey;
            lastTableSelectionRects = tableSelectionRects;
            lastTableSelectionScrollTop = scrollTop;
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
          const overlayNeedsSync =
            layoutToken !== lastOverlayLayoutToken ||
            !Number.isFinite(lastOverlayScrollTop) ||
            Math.abs(scrollTop - lastOverlayScrollTop) > 0.5 ||
            viewportWidth !== lastOverlayViewportWidth;
          if (overlayNeedsSync) {
            lastOverlayLayoutToken = layoutToken;
            lastOverlayScrollTop = scrollTop;
            lastOverlayViewportWidth = viewportWidth;
            scheduleNodeOverlaySync(layout, layoutIndex);
          }
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
        } catch (error) {
          setRafId(0);
          console.error("[render-sync] render fatal", error);
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
    const doc = getEditorState().doc;
    const workerForce = workerConfig?.force === true;
    const allowWorkerForDocChanged = workerConfig?.useForDocChanged === true;
    const docChanged = changeSummary?.docChanged === true;
    const incrementalConfig =
      workerConfig?.incremental && typeof workerConfig.incremental === "object"
        ? workerConfig.incremental
        : null;
    const incrementalEnabled = incrementalConfig?.enabled === true;
    const runForceFullPass = forceFullPass === true;
    if (runForceFullPass) {
      forceFullPass = false;
    }
    const progressiveMaxPages =
      docChanged && incrementalEnabled && !runForceFullPass
        ? Math.max(0, Number(incrementalConfig?.maxPages) || 24)
        : 0;
    const workerIneligibleReason = getWorkerPaginationIneligibleReason(doc, layoutPipeline?.registry);
    const isEligible = isWorkerPaginationEligibleDoc(doc, layoutPipeline?.registry);
    // force 仅用于调试开关，不允许绕过复杂块安全门禁，否则会出现布局错乱。
    const canUseWorkerProvider = !!paginationWorkerProvider && (!docChanged || allowWorkerForDocChanged);
    const canUseWorker = !!paginationWorker && isEligible;
    if ((canUseWorkerProvider || canUseWorker) && asyncLayoutInFlight) {
      asyncLayoutQueued = true;
      return;
    }
    const version = (layoutVersion += 1);
    clearPendingChangeSummary?.();
    clearPendingSteps?.();
    const paginationStart = paginationTiming ? now() : 0;
    const applyAndLogLayout = (layout) => {
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
          progressiveApplied: layout?.__progressiveApplied === true,
          workerUsed: canUseWorkerProvider || canUseWorker,
          workerReason: canUseWorkerProvider
            ? (docChanged ? "provider-docChanged" : "provider")
            : canUseWorker
            ? (workerForce ? "force-safe" : "eligible")
            : workerIneligibleReason,
        };
        console.info(`[pagination-timing] ${JSON.stringify(payload)}`);
      }
      applyLayout(layout, version, changeSummary);
      if (layout?.__progressiveApplied === true && incrementalEnabled) {
        const settleDelayMs = Math.max(0, Number(incrementalConfig?.settleDelayMs) || 120);
        if (fullSettleTimer) {
          clearTimeout(fullSettleTimer);
          fullSettleTimer = null;
        }
        fullSettleTimer = setTimeout(() => {
          fullSettleTimer = null;
          forceFullPass = true;
          scheduleLayout();
        }, settleDelayMs);
      }
    };

    if (canUseWorkerProvider) {
      asyncLayoutInFlight = true;
      const providerPayload = {
        doc,
        previousLayout: getLayout?.() ?? null,
        changeSummary,
        settings: layoutPipeline?.settings,
        registry: layoutPipeline?.registry,
        progressiveMaxPages,
      };
      Promise.resolve(paginationWorkerProvider.requestLayout(providerPayload))
        .then((layout) => {
          if (!layout) {
            throw new Error("provider-empty-layout");
          }
          applyAndLogLayout(layout);
        })
        .catch(() => {
          const fallbackLayout = layoutPipeline.layoutFromDoc(doc, {
            previousLayout: getLayout?.() ?? null,
            changeSummary,
            docPosToTextOffset,
            progressiveMaxPages,
          });
          applyAndLogLayout(fallbackLayout);
        })
        .finally(() => {
          asyncLayoutInFlight = false;
          if (asyncLayoutQueued) {
            asyncLayoutQueued = false;
            scheduleLayout();
          }
        });
      return;
    }

    if (canUseWorker) {
      asyncLayoutInFlight = true;
      const payload = createWorkerPaginationRunsPayload(
        doc,
        layoutPipeline.settings,
        layoutPipeline?.registry
      );
      paginationWorker
        ?.requestLayout(payload, Number(workerConfig?.timeoutMs) || 5000)
        .then((layout) => {
          applyAndLogLayout(layout);
        })
        .catch(() => {
          const fallbackLayout = layoutPipeline.layoutFromDoc(doc, {
            previousLayout: getLayout?.() ?? null,
            changeSummary,
            docPosToTextOffset,
          });
          applyAndLogLayout(fallbackLayout);
        })
        .finally(() => {
          asyncLayoutInFlight = false;
          if (asyncLayoutQueued) {
            asyncLayoutQueued = false;
            scheduleLayout();
          }
        });
      return;
    }

    const layout = layoutPipeline.layoutFromDoc(doc, {
      previousLayout: getLayout?.() ?? null,
      changeSummary,
      docPosToTextOffset,
      progressiveMaxPages,
    });
    applyAndLogLayout(layout);
  };

  const scheduleLayout = () => {
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
      const nextCaretOffset = clampOffset(
        docPosToTextOffset(nextState.doc, nextState.selection.head)
      );
      setCaretOffsetValue(nextCaretOffset);
      // 文档变更后先等待新布局，再更新 caret/selection，避免旧布局上的瞬时跳动。
      setPendingPreferredUpdate(true);
      updateStatus();
      scheduleLayout();
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
    destroy: () => {
      if (fullSettleTimer) {
        clearTimeout(fullSettleTimer);
        fullSettleTimer = null;
      }
      paginationWorker?.destroy?.();
      paginationWorkerProvider?.destroy?.();
    },
  };
};














