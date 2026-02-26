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
  scrollIntoViewAtPos,
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
  let lastSelectionRectsKey = "";
  let lastSelectionRects: any[] | null = null;
  let lastSelectionScrollTop = Number.NaN;
  let lastTableSelectionRectsKey = "";
  let lastTableSelectionRects: any[] | null = null;
  let lastTableSelectionScrollTop = Number.NaN;
  let asyncLayoutInFlight = false;
  let asyncLayoutQueued = false;
  let pendingScrollIntoViewPos: number | null = null;
  let hasPendingScrollIntoView = false;
  let fullSettleTimer: ReturnType<typeof setTimeout> | null = null;
  let forceFullPass = false;
  let lastLayoutSettingsSignature: string | null = null;
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
  const hasPendingLayoutWork = () => layoutRafId !== 0 || asyncLayoutInFlight || asyncLayoutQueued;
  const toFiniteNumber = (value: unknown, fallback = 0) =>
    Number.isFinite(value) ? Number(value) : fallback;
  const resolveLayoutSettingsForPass = (settings: any, resolvedPageWidth: unknown) => {
    const fallbackWidth = toFiniteNumber(settings?.pageWidth, 794);
    const pageWidth =
      Number.isFinite(resolvedPageWidth) && Number(resolvedPageWidth) > 0
        ? Number(resolvedPageWidth)
        : fallbackWidth > 0
          ? fallbackWidth
          : 794;
    return {
      ...settings,
      pageWidth,
    };
  };
  const getLayoutSettingsSignature = (settings: any) => {
    const margin = settings?.margin || {};
    return [
      toFiniteNumber(settings?.pageWidth, 0),
      toFiniteNumber(settings?.pageHeight, 0),
      toFiniteNumber(settings?.pageGap, 0),
      toFiniteNumber(margin?.left, 0),
      toFiniteNumber(margin?.right, 0),
      toFiniteNumber(margin?.top, 0),
      toFiniteNumber(margin?.bottom, 0),
      toFiniteNumber(settings?.lineHeight, 0),
      String(settings?.font || ""),
      String(settings?.codeFont || ""),
      toFiniteNumber(settings?.wrapTolerance, 0),
      toFiniteNumber(settings?.minLineWidth, 0),
      toFiniteNumber(settings?.blockSpacing, 0),
      toFiniteNumber(settings?.paragraphSpacingBefore, 0),
      toFiniteNumber(settings?.paragraphSpacingAfter, 0),
      toFiniteNumber(settings?.listIndent, 0),
      toFiniteNumber(settings?.listMarkerGap, 0),
      String(settings?.listMarkerFont || ""),
      toFiniteNumber(settings?.codeBlockPadding, 0),
      String(settings?.textLocale || ""),
      settings?.segmentText ? "segment:on" : "segment:off",
    ].join("|");
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
  const findPageIndexForOffset = (layout: any, offset: number) => {
    if (!layout || !Array.isArray(layout.pages) || layout.pages.length === 0) {
      return null;
    }
    const target = Number.isFinite(offset) ? Number(offset) : 0;
    let lineEndFallback: number | null = null;
    for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
      const page = layout.pages[pageIndex];
      const lines = Array.isArray(page?.lines) ? page.lines : [];
      for (const line of lines) {
        const start = Number.isFinite(line?.start) ? Number(line.start) : null;
        const end = Number.isFinite(line?.end) ? Number(line.end) : null;
        if (start == null || end == null) {
          continue;
        }
        if (start === end && target === start) {
          return pageIndex;
        }
        if (target >= start && target < end) {
          return pageIndex;
        }
        if (target === end && end > start && lineEndFallback == null) {
          lineEndFallback = pageIndex;
        }
      }
    }
    if (lineEndFallback != null) {
      return lineEndFallback;
    }
    return layout.pages.length - 1;
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

  // Resolve optional selection-geometry overrides from editor props.
  const resolveSelectionGeometry = () => {
    const fromProps =
      typeof queryEditorProp === "function" ? queryEditorProp("selectionGeometry") : null;
    if (fromProps && typeof fromProps === "object") {
      return fromProps;
    }
    return null;
  };

  // Compute table-related selection rects with optional plugin overrides.
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
            void renderStart;
            void selectionMs;
            void tableSelectionMs;
            void decorationMs;
            void nodeOverlayMs;
            void rendererMs;
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
    const headParent = selection?.$head?.parent ?? null;
    const headParentOffset = Number.isFinite(selection?.$head?.parentOffset)
      ? Number(selection.$head.parentOffset)
      : null;
    const headParentSize =
      Number.isFinite(headParent?.content?.size) && headParent != null
        ? Number(headParent.content.size)
        : null;
    const preferBoundary =
      selection?.empty === true && headParent?.isTextblock === true
        ? headParentOffset === 0
          ? "start"
          : headParentSize != null && headParentOffset === headParentSize
          ? "end"
          : "start"
        : "start";

    const caretRect = coordsAtPos(
      layout,
      getCaretOffset(),
      scrollArea.scrollTop,
      scrollArea.clientWidth,
      getText().length,
      { preferBoundary }
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
    const latestState = getEditorState();
    const latestCaretOffset = clampOffset(
      docPosToTextOffset(latestState.doc, latestState.selection.head)
    );
    setCaretOffsetValue(latestCaretOffset);
    updateCaret(true);
    updateStatus();
    flushPendingScrollIntoView();
    scheduleRender();
  };
  const updateLayout = () => {
    const changeSummary = getPendingChangeSummary?.() ?? null;
    const nextPageWidth = resolvePageWidth?.();
    const layoutSettingsForPass = resolveLayoutSettingsForPass(layoutPipeline?.settings, nextPageWidth);
    const layoutSettingsSignature = getLayoutSettingsSignature(layoutSettingsForPass);
    const settingsChanged = layoutSettingsSignature !== lastLayoutSettingsSignature;
    const prevLayout = getLayout?.() ?? null;
    if (prevLayout && !settingsChanged && changeSummary?.docChanged !== true) {
      clearPendingChangeSummary?.();
      clearPendingSteps?.();
      updateStatus();
      flushPendingScrollIntoViewIfReady();
      scheduleRender();
      return;
    }

    if (settingsChanged) {
      layoutPipeline.clearCache?.();
    }
    const doc = getEditorState().doc;
    const workerForce = workerConfig?.force === true;
    const allowWorkerForDocChanged = workerConfig?.useForDocChanged === true;
    const allowWorkerForInitial = workerConfig?.useForInitial === true;
    const docChanged = changeSummary?.docChanged === true;
    let forceSyncLayoutOnce = false;
    try {
      forceSyncLayoutOnce = (globalThis as any).__lumenForceSyncLayoutOnce === true;
      if (forceSyncLayoutOnce) {
        (globalThis as any).__lumenForceSyncLayoutOnce = false;
      }
    } catch (_error) {
      forceSyncLayoutOnce = false;
    }
    const incrementalConfig =
      workerConfig?.incremental && typeof workerConfig.incremental === "object"
        ? workerConfig.incremental
        : null;
    const incrementalEnabled = incrementalConfig?.enabled === true;
    const runForceFullPass = forceFullPass === true;
    if (runForceFullPass) {
      forceFullPass = false;
    }
    let progressiveMaxPages =
      docChanged && incrementalEnabled && !runForceFullPass
        ? Math.max(0, Number(incrementalConfig?.maxPages) || 24)
        : 0;
    let progressiveDisabledReason: string | null = null;
    let progressiveHeadPageIndex: number | null = null;
    if (progressiveMaxPages > 0 && forceSyncLayoutOnce) {
      progressiveMaxPages = 0;
      progressiveDisabledReason = "force-sync-once";
    }
    if (
      progressiveMaxPages > 0 &&
      docChanged &&
      prevLayout &&
      Array.isArray(prevLayout?.pages) &&
      prevLayout.pages.length > progressiveMaxPages
    ) {
      const headPos = getEditorState()?.selection?.head;
      const headOffset = Number.isFinite(headPos)
        ? clampOffset(docPosToTextOffset(doc, Number(headPos)))
        : null;
      progressiveHeadPageIndex =
        headOffset != null ? findPageIndexForOffset(prevLayout, Number(headOffset)) : null;
      if (
        Number.isFinite(progressiveHeadPageIndex) &&
        Number(progressiveHeadPageIndex) >= progressiveMaxPages - 1
      ) {
        progressiveMaxPages = 0;
        progressiveDisabledReason = "tail-edit-near-cutoff";
      }
    }
    const workerIneligibleReason = getWorkerPaginationIneligibleReason(doc, layoutPipeline?.registry);
    const isEligible = isWorkerPaginationEligibleDoc(doc, layoutPipeline?.registry);
    const isInitialLayoutPass = !prevLayout;
    const workerAllowedForPass = docChanged
      ? allowWorkerForDocChanged
      : !isInitialLayoutPass || allowWorkerForInitial;
    // Keep force/debug switch gated by the same safety checks.
    const canUseWorkerProvider =
      !forceSyncLayoutOnce &&
      !!paginationWorkerProvider &&
      workerAllowedForPass;
    const canUseWorker = !forceSyncLayoutOnce && !!paginationWorker && isEligible && workerAllowedForPass;
    if ((canUseWorkerProvider || canUseWorker) && asyncLayoutInFlight) {
      asyncLayoutQueued = true;
      return;
    }
    const version = (layoutVersion += 1);
    clearPendingChangeSummary?.();
    clearPendingSteps?.();
    const applyAndLogLayout = (layout) => {
      void paginationTiming;
      void workerForce;
      void workerIneligibleReason;
      lastLayoutSettingsSignature = layoutSettingsSignature;
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
        settings: layoutSettingsForPass,
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
            layoutSettingsOverride: layoutSettingsForPass,
          });
          applyAndLogLayout(fallbackLayout);
        })
        .finally(() => {
          asyncLayoutInFlight = false;
          if (asyncLayoutQueued) {
            asyncLayoutQueued = false;
            scheduleLayout();
          }
          flushPendingScrollIntoViewIfReady();
        });
      return;
    }

    if (canUseWorker) {
      asyncLayoutInFlight = true;
      const payload = createWorkerPaginationRunsPayload(
        doc,
        layoutSettingsForPass,
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
            layoutSettingsOverride: layoutSettingsForPass,
          });
          applyAndLogLayout(fallbackLayout);
        })
        .finally(() => {
          asyncLayoutInFlight = false;
          if (asyncLayoutQueued) {
            asyncLayoutQueued = false;
            scheduleLayout();
          }
          flushPendingScrollIntoViewIfReady();
        });
      return;
    }

    const layout = layoutPipeline.layoutFromDoc(doc, {
      previousLayout: getLayout?.() ?? null,
      changeSummary,
      docPosToTextOffset,
      progressiveMaxPages,
      layoutSettingsOverride: layoutSettingsForPass,
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
      flushPendingScrollIntoViewIfReady();
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
    const hasPendingLayout = layoutRafId !== 0 || asyncLayoutInFlight || asyncLayoutQueued;
    if (hasPendingLayout) {
      // Layout is about to refresh. Keep caret offset in sync but avoid rendering against stale layout.
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

  const dispatchTransaction = (tr) => {
    const prevState = getEditorState();
    const nextState = applyTransaction(prevState, tr);
    setEditorState(nextState);
    if (tr.docChanged) {
      const nextCaretOffset = clampOffset(
        docPosToTextOffset(nextState.doc, nextState.selection.head)
      );
      setCaretOffsetValue(nextCaretOffset);
      // Wait for the next layout after doc changes before syncing caret/selection.
      setPendingPreferredUpdate(true);
      updateStatus();
      scheduleLayout();
      return;
    }
    const hasPendingLayout = layoutRafId !== 0 || asyncLayoutInFlight || asyncLayoutQueued;
    if (hasPendingLayout) {
      // A layout refresh is already pending for a recent doc change. Avoid syncing caret/selection
      // against stale page geometry; defer visual sync until applyLayout.
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
    scheduleRender,
    scheduleLayout,
    updateCaret,
    updateLayout,
    syncAfterStateChange,
    dispatchTransaction,
    requestScrollIntoView,
    isLayoutPending: hasPendingLayoutWork,
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
