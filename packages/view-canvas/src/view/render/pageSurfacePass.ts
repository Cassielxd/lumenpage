import { getVisiblePages } from "../virtualization";
import {
  enforceRendererPageCacheLimit,
  ensureRendererCanvasPool,
  pruneRendererPageCache,
  type RendererPageCacheEntry,
  type RendererPageCanvasSlot,
} from "./pageCanvasCache";
import { runPageCompositePass } from "./pageCompositePass";
import { runPageRedrawPass } from "./pageRedrawPass";

export const renderPageSurfacePass = ({
  layout,
  settings,
  pageLayer,
  pageCache,
  pageCanvases,
  scrollTop,
  clientHeight,
  pageX,
  dpr,
  layoutVersion,
  layoutVersionChanged,
  forceRedraw,
  changedRange,
  getPageSignature,
  renderPage,
}: {
  layout: any;
  settings: any;
  pageLayer: HTMLElement;
  pageCache: Map<number, RendererPageCacheEntry>;
  pageCanvases: RendererPageCanvasSlot[];
  scrollTop: number;
  clientHeight: number;
  pageX: number;
  dpr: number;
  layoutVersion: number | null;
  layoutVersionChanged: boolean;
  forceRedraw: boolean;
  changedRange: { min: number; max: number } | null;
  getPageSignature: (page: any) => number;
  renderPage: (pageIndex: number, layout: any, entry: RendererPageCacheEntry) => void;
}) => {
  const visible = getVisiblePages(layout, scrollTop, clientHeight);
  const buffer = settings.pageBuffer ?? 2;
  const startIndex = Math.max(0, visible.startIndex - buffer);
  const endIndex = Math.min(layout.pages.length - 1, visible.endIndex + buffer);
  const activePages = new Set<number>();
  for (let index = startIndex; index <= endIndex; index += 1) {
    activePages.add(index);
  }

  pruneRendererPageCache(pageCache, layout.pages.length);
  ensureRendererCanvasPool({
    pageCanvases,
    pageLayer,
    count: activePages.size,
  });

  const pageIndices = Array.from(activePages.values()).sort((a, b) => a - b);
  const pageSpan = layout.pageHeight + layout.pageGap;
  const pageTrace =
    settings?.debugGhostTrace === true || settings?.debugPerf === true ? [] : null;

  let pageCacheHits = 0;
  let pageCacheMisses = 0;
  let pageCacheRecreated = 0;
  let signatureComputedPages = 0;
  let signatureSkippedPages = 0;
  let redrawCount = 0;
  let cachedPages = 0;
  let signatureMs = 0;
  let renderPagesMs = 0;
  let compositeMs = 0;

  for (let index = 0; index < pageIndices.length; index += 1) {
    const pageIndex = pageIndices[index];
    const redrawState = runPageRedrawPass({
      pageCache,
      pageIndex,
      layout,
      dpr,
      layoutVersion,
      layoutVersionChanged,
      forceRedraw,
      changedRange,
      settings,
      getPageSignature,
      renderPage,
    });

    if (redrawState.cacheDisposition === "hit") {
      pageCacheHits += 1;
    } else if (redrawState.cacheDisposition === "recreated") {
      pageCacheRecreated += 1;
    } else {
      pageCacheMisses += 1;
    }

    if (redrawState.signatureComputed) {
      signatureComputedPages += 1;
    } else {
      signatureSkippedPages += 1;
    }

    signatureMs += redrawState.signatureMs;

    if (redrawState.pageRedrawn) {
      redrawCount += 1;
      renderPagesMs += redrawState.renderMs;
    } else {
      cachedPages += 1;
    }

    const compositeState = runPageCompositePass({
      canvasEntry: pageCanvases[index],
      entry: redrawState.entry,
      pageIndex,
      layout,
      settings,
      pageX,
      scrollTop,
      dpr,
      pageSpan,
      pageRedrawn: redrawState.pageRedrawn,
    });
    compositeMs += compositeState.compositeMs;

    if (pageTrace) {
      pageTrace.push({
        pageIndex,
        rootIndexMin: Number.isFinite(redrawState.page?.rootIndexMin)
          ? Number(redrawState.page.rootIndexMin)
          : null,
        rootIndexMax: Number.isFinite(redrawState.page?.rootIndexMax)
          ? Number(redrawState.page.rootIndexMax)
          : null,
        lineCount: Array.isArray(redrawState.page?.lines) ? redrawState.page.lines.length : 0,
        reused: redrawState.page?.__reused === true,
        canSkipSignature: redrawState.canSkipSignature,
        hasCachedSignature: redrawState.hasCachedSignature,
        pageRedrawn: redrawState.pageRedrawn,
        needsComposite: compositeState.needsComposite,
        signatureChanged: forceRedraw || redrawState.prevEntrySignature !== redrawState.signature,
      });
    }
  }

  const maxCache = settings.maxPageCache ?? Math.max(activePages.size * 3, 24);
  enforceRendererPageCacheLimit(pageCache, activePages, maxCache);

  return {
    visible,
    startIndex,
    endIndex,
    activePages,
    maxCache,
    pageTrace,
    pageCacheHits,
    pageCacheMisses,
    pageCacheRecreated,
    signatureComputedPages,
    signatureSkippedPages,
    redrawCount,
    cachedPages,
    signatureMs,
    renderPagesMs,
    compositeMs,
  };
};
