import { buildDecorationDrawData } from "./render/decorations";
import { NodeSelection } from "lumenpage-state";
import { tableCellSelectionToRects, tableRangeSelectionToCellRects } from "./render/selection";
import {
  getPageIndexForOffset,
} from "lumenpage-view-runtime";
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

const isGhostTraceEnabled = (settings: any) =>
  settings?.debugGhostTrace === true ||
  (typeof globalThis !== "undefined" &&
    (globalThis as typeof globalThis & { __lumenGhostTraceEnabled?: boolean })
      .__lumenGhostTraceEnabled === true);

const emitGhostTrace = (type: string, summary: Record<string, unknown>, settings: any) => {
  if (!isGhostTraceEnabled(settings)) {
    return;
  }
  if (typeof globalThis === "undefined") {
    return;
  }
  const globalState = globalThis as typeof globalThis & {
    __lumenGhostTrace?: Array<Record<string, unknown>>;
    __copyLumenGhostTrace?: () => string;
  };
  const logs = Array.isArray(globalState.__lumenGhostTrace) ? globalState.__lumenGhostTrace : [];
  logs.push({
    type,
    timestamp: new Date().toISOString(),
    ...summary,
  });
  if (logs.length > 400) {
    logs.splice(0, logs.length - 400);
  }
  globalState.__lumenGhostTrace = logs;
  globalState.__copyLumenGhostTrace = () => JSON.stringify(logs, null, 2);
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[ghost-trace][${type}]`, summary);
  }
};

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
  getTextLength,
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
  void paginationTiming;
  void renderTiming;
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
  let lastLayoutPageCount = 0;
  let lastTableSelectionRectsKey = "";
  let lastTableSelectionRects: any[] | null = null;
  let lastTableSelectionScrollTop = Number.NaN;
  let lastDecorationData: any | null = null;
  let lastDecorationScrollTop = Number.NaN;
  let lastDecorationViewportWidth = -1;
  let lastDecorationLayoutToken = -1;
  let lastDecorationSource: any = null;
  let asyncLayoutInFlight = false;
  let asyncLayoutQueued = false;
  let pendingScrollIntoViewPos: number | null = null;
  let hasPendingScrollIntoView = false;
  let fullSettleTimer: ReturnType<typeof setTimeout> | null = null;
  let forceFullPass = false;
  // Counter to track continuous edits - only trigger full pass after user stops editing
  let continuousEditCount = 0;
  const CONTINUOUS_EDIT_THRESHOLD = 3;  // Require 3+ continuous edits before full pass
  let lastLayoutWasProgressive = false;
  // Background full layout - runs in idle time or after progressive layout
  let backgroundFullLayoutPending = false;
  let backgroundLayoutRafId: number | null = null;
  // Flag to track if full layout is needed after progressive layout
  let needsFullLayout = false;
  let lastDocEditAt = 0;
  let backgroundFullLayoutDelayMs = 1500;
  let lastLayoutSettingsSignature: string | null = null;
  const workerConfig = layoutPipeline?.settings?.paginationWorker ?? null;
  // Default to using web worker if not explicitly disabled
  const useWorkerByDefault = workerConfig?.enabled !== false;
  const paginationWorkerProvider =
    workerConfig?.enabled === true && typeof workerConfig?.provider?.requestLayout === "function"
      ? workerConfig.provider
      : null;
  const paginationWorker =
    useWorkerByDefault &&
    (workerConfig?.mode === "experimental-runs" || workerConfig?.mode === undefined) &&
    !paginationWorkerProvider
      ? new PaginationWorkerClient()
      : null;
  const getActiveElement = () => {
    const ownerDocument = inputEl?.ownerDocument || (typeof document !== "undefined" ? document : null);
    return ownerDocument?.activeElement ?? null;
  };
  const emitPerfLog = (type: string, summary: Record<string, unknown>) => {
    if (layoutPipeline?.settings?.debugPerf !== true) {
      return;
    }
    const totalPassMs =
      type === "layout-pass" && Number.isFinite(summary?.totalPassMs)
        ? Number(summary.totalPassMs)
        : 0;
    const totalApplyMs =
      type === "layout-apply" && Number.isFinite(summary?.totalApplyMs)
        ? Number(summary.totalApplyMs)
        : 0;
    const shouldConsoleLog =
      (type === "layout-pass" && totalPassMs >= 50) ||
      (type === "layout-apply" && totalApplyMs >= 8);
    if (shouldConsoleLog) {
      console.info(`[perf][${type}]`, summary);
    }
    if (typeof window !== "undefined") {
      const globalWindow = window as typeof window & {
        __lumenPerfLogs?: Array<Record<string, unknown>>;
        __copyLumenPerfLogs?: () => string;
      };
      const logs = Array.isArray(globalWindow.__lumenPerfLogs) ? globalWindow.__lumenPerfLogs : [];
      logs.push({
        type,
        timestamp: new Date().toISOString(),
        ...summary,
      });
      if (logs.length > 400) {
        logs.splice(0, logs.length - 400);
      }
      globalWindow.__lumenPerfLogs = logs;
      globalWindow.__copyLumenPerfLogs = () => JSON.stringify(logs, null, 2);
    }
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
  const cancelScheduledBackgroundFullLayout = () => {
    if (backgroundLayoutRafId) {
      if (typeof cancelIdleCallback === "function") {
        cancelIdleCallback(backgroundLayoutRafId);
      } else {
        window.clearTimeout(backgroundLayoutRafId);
      }
      backgroundLayoutRafId = null;
    }
    backgroundFullLayoutPending = false;
  };
  
  const findPageIndexForOffset = (layout: any, offset: number, layoutIndex: any = null) => {
    // Use indexed lookup if available - O(log n) instead of O(n)
    if (layoutIndex && typeof getPageIndexForOffset === 'function') {
      const pageIndex = getPageIndexForOffset(layoutIndex, offset);
      if (Number.isFinite(pageIndex)) {
        return pageIndex;
      }
    }
    
    // Fallback to linear scan
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

  // Compute special-structure selection rects with plugin-provided geometry.
  const resolveSpecialSelectionRects = ({
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
    if (typeof geometry?.resolveSelectionRects === "function") {
      const resolved = geometry.resolveSelectionRects({
        layout,
        editorState,
        selection,
        scrollTop: scrollArea.scrollTop,
        viewportWidth: scrollArea.clientWidth,
        layoutIndex,
        docPosToTextOffset,
      });
      if (Array.isArray(resolved) && resolved.length > 0) {
        return resolved;
      }
    }

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

  const shouldComputeSpecialSelectionRects = (
    editorState: any,
    selection: { from: number; to: number }
  ) => {
    const geometry = resolveSelectionGeometry();
    const fromProps = geometry?.shouldComputeSelectionRects;
    if (typeof fromProps === "function") {
      return (
        fromProps({
          editorState,
          selection,
        }) === true
      );
    }
    return false;
  };

  const shiftDecorationDrawData = (data: any, deltaY: number) => {
    if (!data || !Number.isFinite(deltaY) || deltaY === 0) {
      return data;
    }
    const shiftRects = (rects: any[] | null | undefined) =>
      Array.isArray(rects)
        ? rects.map((rect) => ({
            ...rect,
            y: Number.isFinite(rect?.y) ? Number(rect.y) - deltaY : rect?.y,
          }))
        : [];
    const shiftSegments = (segments: any[] | null | undefined) =>
      Array.isArray(segments)
        ? segments.map((segment) => ({
            ...segment,
            y: Number.isFinite(segment?.y) ? Number(segment.y) - deltaY : segment?.y,
          }))
        : [];
    const shiftWidgets = (widgets: any[] | null | undefined) =>
      Array.isArray(widgets)
        ? widgets.map((widget) => ({
            ...widget,
            y: Number.isFinite(widget?.y) ? Number(widget.y) - deltaY : widget?.y,
          }))
        : [];
    return {
      inlineRects: shiftRects(data.inlineRects),
      nodeRects: shiftRects(data.nodeRects),
      textSegments: shiftSegments(data.textSegments),
      widgets: shiftWidgets(data.widgets),
    };
  };

  const scheduleRender = () => {
    if (getRafId()) {
      return;
    }

    setRafId(
      requestAnimationFrame(() => {
        try {
          const renderStart = now();
          setRafId(0);
          const layout = getLayout();
          if (!layout) {
            return;
          }
          const layoutIndex = getLayoutIndex?.() || null;
          const editorState = getEditorState();
          const textLength = getTextLength();
          const scrollTop = Math.round(scrollArea.scrollTop * 10) / 10;
          const viewportWidth = scrollArea.clientWidth;
          const layoutToken = Number.isFinite(layout?.__version) ? Number(layout.__version) : layoutVersion;
          const prevPageCount = lastLayoutPageCount ?? 0;
          const currentPageCount = layout?.pages?.length ?? 0;
          const isProgressive = currentPageCount > prevPageCount;
          const selectionStart = now();
          const selection = getSelectionOffsets(editorState, docPosToTextOffset, clampOffset);
          const selectionRectsKey = `${layoutToken}|${selection.from}|${selection.to}|${viewportWidth}|${textLength}`;
          // Disable selection rect caching during progressive layout to avoid using stale layout info
          // which can cause incorrect line heights in selection borders
          const canShiftSelectionRects =
            !isProgressive &&
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
          const selectionMs = Math.round((now() - selectionStart) * 100) / 100;

          const tableSelectionStart = now();
          let tableSelectionRects = null;
          if (shouldComputeSpecialSelectionRects(editorState, selection)) {
            const geometry = resolveSelectionGeometry();
            const useBorderOnly = !!(
              geometry &&
              typeof geometry.shouldRenderBorderOnly === "function" &&
              geometry.shouldRenderBorderOnly({
                editorState,
                selection,
              }) === true
            );
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
              : resolveSpecialSelectionRects({
                  layout,
                  editorState,
                  selection,
                  layoutIndex,
                });
            if (useBorderOnly && Array.isArray(tableSelectionRects)) {
              tableSelectionRects = tableSelectionRects.map((rect) => ({
                ...rect,
                borderOnly: true,
              }));
            }
            lastTableSelectionRectsKey = tableSelectionKey;
            lastTableSelectionRects = tableSelectionRects;
            lastTableSelectionScrollTop = scrollTop;
          }
          if (Array.isArray(tableSelectionRects) && tableSelectionRects.length > 0) {
            selectionRects = tableSelectionRects;
          }
          const tableSelectionMs = Math.round((now() - tableSelectionStart) * 100) / 100;

          const decorationStart = now();
          const decorations = typeof getDecorations === "function" ? getDecorations() : null;
          const canShiftDecorationData =
            decorations === lastDecorationSource &&
            layoutToken === lastDecorationLayoutToken &&
            viewportWidth === lastDecorationViewportWidth &&
            lastDecorationData &&
            Number.isFinite(lastDecorationScrollTop);
          const decorationData = decorations
            ? canShiftDecorationData
              ? shiftDecorationDrawData(
                  lastDecorationData,
                  scrollTop - Number(lastDecorationScrollTop)
                )
              : buildDecorationDrawData(
                  {
                    layout,
                    layoutIndex,
                    doc: editorState?.doc,
                    decorations,
                    scrollTop,
                    viewportWidth,
                    textLength,
                    docPosToTextOffset,
                    coordsAtPos,
                    layoutToken,
                  },
                  false
                )
            : null;
          lastDecorationSource = decorations;
          lastDecorationData = decorationData;
          lastDecorationScrollTop = scrollTop;
          lastDecorationViewportWidth = viewportWidth;
          lastDecorationLayoutToken = layoutToken;
          const decorationMs = Math.round((now() - decorationStart) * 100) / 100;

          const nodeOverlayStart = now();
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
          const nodeOverlayMs = Math.round((now() - nodeOverlayStart) * 100) / 100;

          const rendererStart = now();
          renderer.render(layout, scrollArea, getCaretRect(), selectionRects, [], decorationData);
          const rendererMs = Math.round((now() - rendererStart) * 100) / 100;

          const totalMs = Math.round((now() - renderStart) * 100) / 100;
          void totalMs;
          void renderStart;
          void selectionMs;
          void tableSelectionMs;
          void decorationMs;
          void nodeOverlayMs;
          void rendererMs;
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
      getTextLength(),
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
  const applyLayout = (nextLayout, version, changeSummary, skipIndexBuild = false) => {
    if (!nextLayout) {
      return;
    }
    if (version < layoutVersion) {
      return;
    }
    const applyStartedAt = now();
    const prevLayout = getLayout?.() ?? null;
    nextLayout.__version = version;
    nextLayout.__changeSummary = changeSummary ?? null;
    nextLayout.__forceRedraw = !prevLayout || changeSummary?.docChanged === true;
    const prevLayoutIndex = getLayoutIndex?.() ?? null;
    setLayout(nextLayout);
    // Optimization: Build index for progressive layout to ensure selection/caret calculations work correctly.
    // Even during progressive pagination, we need a valid layoutIndex for accurate selection and caret positioning.
    // The index build is lightweight and necessary to prevent cursor jumping and selection errors.
    const isProgressiveLayout = skipIndexBuild || (changeSummary?.docChanged === true && prevLayout && prevLayout.pages.length > 0);
    const indexBuildStart = now();
    if (typeof buildLayoutIndex === "function") {
      setLayoutIndex(buildLayoutIndex(nextLayout, prevLayoutIndex, prevLayout));
    }
    const indexBuildMs = now() - indexBuildStart;
    lastLayoutPageCount = nextLayout.pages.length;
    spacer.style.height = `${nextLayout.totalHeight}px`;
    const latestState = getEditorState();
    const latestCaretOffset = clampOffset(
      docPosToTextOffset(latestState.doc, latestState.selection.head)
    );
    setCaretOffsetValue(latestCaretOffset);
    const caretStartedAt = now();
    updateCaret(true);
    const caretMs = now() - caretStartedAt;
    updateStatus();
    flushPendingScrollIntoView();
    scheduleRender();
    emitPerfLog("layout-apply", {
      layoutVersion: version,
      docChanged: changeSummary?.docChanged === true,
      progressiveHint: isProgressiveLayout,
      progressiveApplied: nextLayout?.__progressiveApplied === true,
      prevPages: prevLayout?.pages?.length ?? 0,
      nextPages: nextLayout?.pages?.length ?? 0,
      indexBuildMs: Math.round(indexBuildMs),
      caretMs: Math.round(caretMs),
      totalApplyMs: Math.round(now() - applyStartedAt),
    });
  };
  const updateLayout = () => {
    const passStartedAt = now();
    const changeSummary = getPendingChangeSummary?.() ?? null;
    const nextPageWidth = resolvePageWidth?.();
    const layoutSettingsForPass = resolveLayoutSettingsForPass(layoutPipeline?.settings, nextPageWidth);
    const layoutSettingsSignature = getLayoutSettingsSignature(layoutSettingsForPass);
    const settingsChanged = layoutSettingsSignature !== lastLayoutSettingsSignature;
    const prevLayout = getLayout?.() ?? null;
    
    // Fast path: if doc hasn't changed and settings are same, just re-render
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
    const workerConfigIncremental = layoutPipeline?.settings?.paginationWorker?.incremental;
    const incrementalEnabled = workerConfigIncremental !== false;
    const runForceFullPass = forceFullPass === true;
    if (runForceFullPass) {
      forceFullPass = false;
    }
    
    // 配置项：用于后台全量布局的延迟
    const settleDelayMs = Number.isFinite(workerConfigIncremental?.settleDelayMs)
      ? Math.max(120, Number(workerConfigIncremental?.settleDelayMs))
      : 120;
    const backgroundFullLayoutDelayMs = Math.max(settleDelayMs * 4, 1500);
    if (docChanged) {
      lastDocEditAt = passStartedAt;
      cancelScheduledBackgroundFullLayout();
    }
    
    // 级联分页：只在变更影响的页面进行分页，算到稳定就停止
    // 确定级联分页的起始页：从光标所在页面开始
    let cascadeFromPageIndex: number | null = null;
    let useCascadePagination = false;
    if (prevLayout && docChanged && incrementalEnabled && !runForceFullPass) {
      const headPos = getEditorState()?.selection?.head;
      const headOffset = Number.isFinite(headPos)
        ? clampOffset(docPosToTextOffset(doc, Number(headPos)))
        : null;
      const prevLayoutIndex = getLayoutIndex?.() ?? null;
      if (headOffset != null) {
        const headPageIndex = findPageIndexForOffset(prevLayout, Number(headOffset), prevLayoutIndex);
        if (Number.isFinite(headPageIndex)) {
          cascadeFromPageIndex = Number(headPageIndex);
          useCascadePagination = true;
        }
      }
      // 如果没找到光标位置（比如新文档），从第0页开始
      if (cascadeFromPageIndex === null) {
        cascadeFromPageIndex = 0;
        useCascadePagination = true;
      }
    }
    const workerIneligibleReason = getWorkerPaginationIneligibleReason(doc, layoutPipeline?.registry);
    const isEligible = isWorkerPaginationEligibleDoc(doc, layoutPipeline?.registry);
    const isInitialLayoutPass = !prevLayout;
    const workerAllowedForPass = docChanged
      ? allowWorkerForDocChanged
      : !isInitialLayoutPass || allowWorkerForInitial;
    const preferSyncIncrementalPass =
      docChanged === true &&
      !!prevLayout &&
      useCascadePagination === true &&
      runForceFullPass !== true;
    // Keep force/debug switch gated by the same safety checks.
    const canUseWorkerProvider =
      !preferSyncIncrementalPass &&
      !forceSyncLayoutOnce &&
      !!paginationWorkerProvider &&
      workerAllowedForPass;
    const canUseWorker =
      !preferSyncIncrementalPass &&
      !forceSyncLayoutOnce &&
      !!paginationWorker &&
      isEligible &&
      workerAllowedForPass;
    if ((canUseWorkerProvider || canUseWorker) && asyncLayoutInFlight) {
      asyncLayoutQueued = true;
      return;
    }
    const version = (layoutVersion += 1);
    clearPendingChangeSummary?.();
    clearPendingSteps?.();
    // Track if this is a progressive layout for index optimization
    // 级联分页就是渐进式布局
    const isLayoutProgressive = useCascadePagination && prevLayout && prevLayout.pages.length > 1;
    const applyAndLogLayout = (layout, source = "sync", computeMs: number | null = null) => {
      // Discard stale async results to avoid caret jumps from out-of-date geometry.
      if (getEditorState()?.doc !== doc) {
        emitPerfLog("layout-pass", {
          layoutVersion: version,
          source,
          discarded: true,
          docChanged,
          settingsChanged,
          useCascadePagination,
          cascadeFromPageIndex,
          computeMs: computeMs == null ? null : Math.round(computeMs),
          totalPassMs: Math.round(now() - passStartedAt),
        });
        return;
      }
      void workerForce;
      void workerIneligibleReason;
      lastLayoutSettingsSignature = layoutSettingsSignature;
      const applyStartedAt = now();
      applyLayout(layout, version, changeSummary, isLayoutProgressive);
      const layoutPerf =
        layout?.__layoutPerfSummary ?? layoutPipeline?.settings?.__perf?.layout ?? null;
      const workerDebug = layout?.__workerDebug ?? null;
      emitPerfLog("layout-pass", {
        layoutVersion: version,
        source,
        discarded: false,
        docChanged,
        settingsChanged,
        useCascadePagination,
        cascadeFromPageIndex,
        preferSyncIncrementalPass,
        usedWorkerProvider: canUseWorkerProvider,
        usedWorker: canUseWorker,
        workerIneligibleReason,
        computeMs: computeMs == null ? null : Math.round(computeMs),
        applyMs: Math.round(now() - applyStartedAt),
        totalPassMs: Math.round(now() - passStartedAt),
        prevPages: prevLayout?.pages?.length ?? 0,
        nextPages: layout?.pages?.length ?? 0,
        progressiveApplied: layout?.__progressiveApplied === true,
        progressiveTruncated: layout?.__progressiveTruncated === true,
        reusedPages: layoutPerf?.reusedPages ?? null,
        reuseReason: layoutPerf?.reuseReason ?? null,
        disablePageReuse: layoutPerf?.disablePageReuse ?? null,
        maybeSyncReason: layoutPerf?.maybeSyncReason ?? null,
        cascadeMaxPages: layoutPerf?.cascadeMaxPages ?? null,
        syncAfterIndex: layoutPerf?.syncAfterIndex ?? null,
        syncFromIndex: layoutPerf?.syncFromIndex ?? null,
        resumeFromAnchor: layoutPerf?.resumeFromAnchor ?? null,
        resumeAnchorPageIndex: layoutPerf?.resumeAnchorPageIndex ?? null,
        resumeAnchorLineIndex: layoutPerf?.resumeAnchorLineIndex ?? null,
        resumeAnchorMatchKey: layoutPerf?.resumeAnchorMatchKey ?? null,
        resumeAnchorSkippedReason: layoutPerf?.resumeAnchorSkippedReason ?? null,
        reusedPrefixPages: layoutPerf?.reusedPrefixPages ?? null,
        reusedPrefixLines: layoutPerf?.reusedPrefixLines ?? null,
        blockCacheHitRate: layoutPerf?.blockCacheHitRate ?? null,
        breakLinesMs: layoutPerf?.breakLinesMs ?? null,
        layoutLeafMs: layoutPerf?.layoutLeafMs ?? null,
        clientHadSeedLayout: workerDebug?.clientHadSeedLayout ?? null,
        clientSentSeedLayout: workerDebug?.clientSentSeedLayout ?? null,
        clientSettingsChanged: workerDebug?.clientSettingsChanged ?? null,
        clientPrevPages: workerDebug?.clientPrevPages ?? null,
        workerHadPreviousLayoutState: workerDebug?.workerHadPreviousLayoutState ?? null,
        workerPrevPagesBeforeSeed: workerDebug?.workerPrevPagesBeforeSeed ?? null,
        workerPrevPagesAfterSeed: workerDebug?.workerPrevPagesAfterSeed ?? null,
      });
      emitGhostTrace(
        "layout-pass",
        {
          layoutVersion: version,
          source,
          docChanged,
          settingsChanged,
          useCascadePagination,
          cascadeFromPageIndex,
          prevPages: prevLayout?.pages?.length ?? 0,
          nextPages: layout?.pages?.length ?? 0,
          progressiveApplied: layout?.__progressiveApplied === true,
          progressiveTruncated: layout?.__progressiveTruncated === true,
          reusedPages: layoutPerf?.reusedPages ?? null,
          reuseReason: layoutPerf?.reuseReason ?? null,
          disablePageReuse: layoutPerf?.disablePageReuse ?? null,
          maybeSyncReason: layoutPerf?.maybeSyncReason ?? null,
          syncAfterIndex: layoutPerf?.syncAfterIndex ?? null,
          syncFromIndex: layoutPerf?.syncFromIndex ?? null,
          resumeFromAnchor: layoutPerf?.resumeFromAnchor ?? null,
          resumeAnchorPageIndex: layoutPerf?.resumeAnchorPageIndex ?? null,
          resumeAnchorLineIndex: layoutPerf?.resumeAnchorLineIndex ?? null,
          resumeAnchorMatchKey: layoutPerf?.resumeAnchorMatchKey ?? null,
          resumeAnchorSkippedReason: layoutPerf?.resumeAnchorSkippedReason ?? null,
          reusedPrefixPages: layoutPerf?.reusedPrefixPages ?? null,
          reusedPrefixLines: layoutPerf?.reusedPrefixLines ?? null,
          ghostTrace: Array.isArray(layout?.__ghostTrace) ? layout.__ghostTrace : [],
        },
        layoutPipeline?.settings
      );
      // Optimization: Track if we applied progressive layout
      // Only trigger full pass after user has stopped editing for a while
      // This prevents constant full re-layouts during active typing
      const isProgressive = layout?.__progressiveApplied === true && incrementalEnabled;
      lastLayoutWasProgressive = isProgressive;

      if (isProgressive) {
        // Increment continuous edit counter
        continuousEditCount += 1;
        const appliedLayout = getLayout?.() ?? null;
        const isLargeDocument = !!(appliedLayout && appliedLayout.pages.length > 50);
        const progressiveTruncated = layout?.__progressiveTruncated === true;

        // Only schedule background full layout if page count increased
        // (meaning progressive cutoff was triggered)
        const prevPageCount = prevLayout?.pages?.length ?? 0;
        const appliedPageCount = appliedLayout?.pages?.length ?? 0;
        const pageCountIncreased = appliedPageCount > prevPageCount;

        // Mark that we need full layout eventually
        // For large documents with page count increase, schedule background full layout
        if (isLargeDocument && (pageCountIncreased || progressiveTruncated)) {
          needsFullLayout = true;
          if (fullSettleTimer) {
            clearTimeout(fullSettleTimer);
            fullSettleTimer = null;
          }
          fullSettleTimer = setTimeout(() => {
            fullSettleTimer = null;
            if (!needsFullLayout) {
              return;
            }
            if (now() - lastDocEditAt < backgroundFullLayoutDelayMs) {
              return;
            }
            scheduleBackgroundFullLayout();
          }, backgroundFullLayoutDelayMs);
        } else if (!pageCountIncreased && !progressiveTruncated) {
          // No page count increase means progressive layout completed without cutoff
          // No need for background full layout
          needsFullLayout = false;
        }
        
        // Only schedule full pass if user has stopped editing (based on counter)
        // This ensures constant-time editing even with 300+ page documents
        if (!isLargeDocument && continuousEditCount >= CONTINUOUS_EDIT_THRESHOLD) {
          if (fullSettleTimer) {
            clearTimeout(fullSettleTimer);
            fullSettleTimer = null;
          }
          fullSettleTimer = setTimeout(() => {
            fullSettleTimer = null;
            forceFullPass = true;
            continuousEditCount = 0;  // Reset counter after full pass
            needsFullLayout = false;  // Clear flag since we're doing full layout now
            scheduleLayout();
          }, settleDelayMs);
        }
        // If not enough continuous edits, just keep progressive layout active
        // This gives instant response during typing
      } else {
        // Reset counter when we do a full pass
        continuousEditCount = 0;
        needsFullLayout = false;
        if (fullSettleTimer) {
          clearTimeout(fullSettleTimer);
          fullSettleTimer = null;
        }
      }
    };

    if (canUseWorkerProvider) {
      asyncLayoutInFlight = true;
      const workerStartedAt = now();
      const providerPayload = {
        doc,
        previousLayout: getLayout?.() ?? null,
        changeSummary,
        settings: layoutSettingsForPass,
        registry: layoutPipeline?.registry,
        cascadePagination: useCascadePagination,
        cascadeFromPageIndex: cascadeFromPageIndex,
      };
      Promise.resolve(paginationWorkerProvider.requestLayout(providerPayload))
        .then((layout) => {
          if (!layout) {
            throw new Error("provider-empty-layout");
          }
          applyAndLogLayout(layout, "worker-provider", now() - workerStartedAt);
        })
        .catch(() => {
          const fallbackStartedAt = now();
          const fallbackLayout = layoutPipeline.layoutFromDoc(doc, {
            previousLayout: getLayout?.() ?? null,
            changeSummary,
            docPosToTextOffset,
            layoutSettingsOverride: layoutSettingsForPass,
            cascadePagination: useCascadePagination,
            cascadeFromPageIndex: cascadeFromPageIndex,
          });
          applyAndLogLayout(fallbackLayout, "worker-provider-fallback", now() - fallbackStartedAt);
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
      const workerStartedAt = now();
      const payload = createWorkerPaginationRunsPayload(
        doc,
        layoutSettingsForPass,
        layoutPipeline?.registry
      );
      paginationWorker
        ?.requestLayout(payload, Number(workerConfig?.timeoutMs) || 5000)
        .then((layout) => {
          applyAndLogLayout(layout, "worker", now() - workerStartedAt);
        })
        .catch(() => {
          const fallbackStartedAt = now();
          const fallbackLayout = layoutPipeline.layoutFromDoc(doc, {
            previousLayout: getLayout?.() ?? null,
            changeSummary,
            docPosToTextOffset,
            layoutSettingsOverride: layoutSettingsForPass,
            cascadePagination: useCascadePagination,
            cascadeFromPageIndex: cascadeFromPageIndex,
          });
          applyAndLogLayout(fallbackLayout, "worker-fallback", now() - fallbackStartedAt);
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

    const syncStartedAt = now();
    const layout = layoutPipeline.layoutFromDoc(doc, {
      previousLayout: getLayout?.() ?? null,
      changeSummary,
      docPosToTextOffset,
      layoutSettingsOverride: layoutSettingsForPass,
      cascadePagination: useCascadePagination,
      cascadeFromPageIndex: cascadeFromPageIndex,
      perf: {},
    });
    applyAndLogLayout(layout, "sync", now() - syncStartedAt);
  };

  const scheduleLayout = () => {
    if (layoutRafId) {
      return;
    }
    const scheduleStart = performance.now();
    layoutRafId = requestAnimationFrame(() => {
      const layoutStart = performance.now();
      layoutRafId = 0;
      updateLayout();
      void layoutStart;
      flushPendingScrollIntoViewIfReady();
    });
  };

  // Schedule background full layout using requestIdleCallback or setTimeout fallback
  // This runs full pagination in idle time, keeping editing responsive
  const scheduleBackgroundFullLayout = () => {
    if (backgroundLayoutRafId || backgroundFullLayoutPending || !needsFullLayout) {
      return;
    }
    backgroundFullLayoutPending = true;
    
    // Use requestIdleCallback if available, otherwise use setTimeout
    const scheduleIdle = (callback: () => void) => {
      if (typeof requestIdleCallback === 'function') {
        return requestIdleCallback(callback, { timeout: 2000 });
      } else {
        return window.setTimeout(callback, 100);
      }
    };
    
    const cancelIdle = (id: number) => {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(id);
      } else {
        window.clearTimeout(id);
      }
    };
    
    const runBackgroundLayout = () => {
      backgroundLayoutRafId = null;
      backgroundFullLayoutPending = false;
      
      if (now() - lastDocEditAt < backgroundFullLayoutDelayMs) {
        backgroundLayoutRafId = scheduleIdle(runBackgroundLayout) as unknown as number;
        backgroundFullLayoutPending = true;
        return;
      }

      // Only run if there's no active editing
      const hasPendingLayout = layoutRafId !== 0 || asyncLayoutInFlight || asyncLayoutQueued;
      if (hasPendingLayout) {
        // Retry later
        backgroundLayoutRafId = scheduleIdle(runBackgroundLayout) as unknown as number;
        backgroundFullLayoutPending = true;
        return;
      }
      
      // Check if we actually need a full layout
      const prevLayout = getLayout?.() ?? null;
      if (!prevLayout || prevLayout.pages.length <= 50) {
        // No need for full layout
        needsFullLayout = false;
        return;
      }
      
      // Force full pass and schedule layout
      forceFullPass = true;
      needsFullLayout = false;
      scheduleLayout();
    };
    
    backgroundLayoutRafId = scheduleIdle(runBackgroundLayout) as unknown as number;
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
    const applyStart = performance.now();
    const nextState = applyTransaction(prevState, tr);
    void applyStart;
    setEditorState(nextState);
    if (tr.docChanged) {
      const nextCaretOffset = clampOffset(
        docPosToTextOffset(nextState.doc, nextState.selection.head)
      );
      setCaretOffsetValue(nextCaretOffset);
      // Wait for the next layout after doc changes before syncing caret/selection.
      setPendingPreferredUpdate(true);
      updateStatus();
      // Clear stale selection overlay immediately; caret geometry will be refreshed after layout.
      scheduleRender();
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
      cancelScheduledBackgroundFullLayout();
      paginationWorker?.destroy?.();
      paginationWorkerProvider?.destroy?.();
    },
  };
};
