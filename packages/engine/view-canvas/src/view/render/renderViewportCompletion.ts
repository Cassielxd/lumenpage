import { emitGhostTrace, now } from "../debugTrace";
import { type RendererPerfSummary, reportRendererPerf } from "./renderPerfReporter";
import { type RendererViewportState } from "./rendererViewportState";

export const completeRendererViewportPass = ({
  settings,
  perfStart,
  pageCache,
  state,
  nextState,
  layout,
  layoutVersion,
  prevLayoutVersion,
  layoutVersionChanged,
  skippedLayoutVersions,
  forceRedraw,
  cacheClearReasons,
  changedRange,
  surfacePass,
  overlayMs,
  overlayDisplayListItemCount,
}: {
  settings: any;
  perfStart: number;
  pageCache: Map<number, any>;
  state: RendererViewportState;
  nextState: RendererViewportState;
  layout: any;
  layoutVersion: number | null;
  prevLayoutVersion: number | null;
  layoutVersionChanged: boolean;
  skippedLayoutVersions: boolean;
  forceRedraw: boolean;
  cacheClearReasons: string[];
  changedRange: { min: number; max: number } | null;
  surfacePass: {
    visible: { startIndex: number; endIndex: number };
    startIndex: number;
    endIndex: number;
    activePages: Set<number>;
    pageTrace: any[] | null;
    pageCacheHits: number;
    pageCacheMisses: number;
    pageCacheRecreated: number;
    signatureComputedPages: number;
    signatureSkippedPages: number;
    displayListBuiltPages: number;
    displayListReusedPages: number;
    displayListItemCount: number;
    redrawCount: number;
    cachedPages: number;
    displayListBuildMs: number;
    renderPagesMs: number;
    compositeMs: number;
  };
  overlayMs: number;
  overlayDisplayListItemCount: number;
}) => {
  emitGhostTrace(
    "render-frame",
    {
      layoutVersion,
      prevLayoutVersion,
      layoutVersionChanged,
      skippedLayoutVersions: skippedLayoutVersions === true,
      layoutDocChanged: layout?.__changeSummary?.docChanged === true,
      forceRedraw,
      cacheClearReasons,
      activePages: surfacePass.activePages.size,
      visibleStartIndex: surfacePass.visible.startIndex,
      visibleEndIndex: surfacePass.visible.endIndex,
      activeStartIndex: surfacePass.startIndex,
      activeEndIndex: surfacePass.endIndex,
      redrawPages: surfacePass.redrawCount,
      cachedPages: surfacePass.cachedPages,
      pageCacheHits: surfacePass.pageCacheHits,
      pageCacheMisses: surfacePass.pageCacheMisses,
      pageCacheRecreated: surfacePass.pageCacheRecreated,
      signatureComputedPages: surfacePass.signatureComputedPages,
      signatureSkippedPages: surfacePass.signatureSkippedPages,
      displayListBuiltPages: surfacePass.displayListBuiltPages,
      displayListReusedPages: surfacePass.displayListReusedPages,
      displayListItemCount: surfacePass.displayListItemCount,
      overlayDisplayListItemCount,
      changedRangeMin: changedRange?.min ?? null,
      changedRangeMax: changedRange?.max ?? null,
      pageTrace: surfacePass.pageTrace || [],
    },
    settings
  );

  if (!settings?.debugPerf) {
    return nextState;
  }

  const summary: RendererPerfSummary = {
    ms: Math.round(now() - perfStart),
    layoutVersion,
    prevLayoutVersion,
    layoutVersionChanged,
    skippedLayoutVersions: skippedLayoutVersions === true,
    docChanged: layout?.__changeSummary?.docChanged === true,
    forceRedraw,
    cacheClearReasons,
    activePages: surfacePass.activePages.size,
    visibleStartIndex: surfacePass.visible.startIndex,
    visibleEndIndex: surfacePass.visible.endIndex,
    activeStartIndex: surfacePass.startIndex,
    activeEndIndex: surfacePass.endIndex,
    redrawPages: surfacePass.redrawCount,
    cachedPages: surfacePass.cachedPages,
    changedRangeMin: changedRange?.min ?? null,
    changedRangeMax: changedRange?.max ?? null,
    pageCacheHits: surfacePass.pageCacheHits,
    pageCacheMisses: surfacePass.pageCacheMisses,
    pageCacheRecreated: surfacePass.pageCacheRecreated,
    cacheSize: pageCache.size,
    signatureComputedPages: surfacePass.signatureComputedPages,
    signatureSkippedPages: surfacePass.signatureSkippedPages,
    displayListBuiltPages: surfacePass.displayListBuiltPages,
    displayListReusedPages: surfacePass.displayListReusedPages,
    displayListItemCount: surfacePass.displayListItemCount,
    displayListBuildMs: Math.round(surfacePass.displayListBuildMs),
    renderPagesMs: Math.round(surfacePass.renderPagesMs),
    compositeMs: Math.round(surfacePass.compositeMs),
    overlayMs: Math.round(overlayMs),
    overlayDisplayListItemCount,
    pageTrace:
      layout?.__changeSummary?.docChanged === true || forceRedraw
        ? surfacePass.pageTrace || []
        : undefined,
  };

  return {
    ...nextState,
    lastPerfLog: reportRendererPerf({
      settings,
      lastPerfLog: state.lastPerfLog,
      summary,
    }),
  };
};
