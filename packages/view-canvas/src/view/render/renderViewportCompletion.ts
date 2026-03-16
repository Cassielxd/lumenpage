import { now } from "../debugTrace";
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
    redrawCount: number;
    cachedPages: number;
    signatureMs: number;
    renderPagesMs: number;
    compositeMs: number;
  };
  overlayMs: number;
}) => {
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
    signatureMs: Math.round(surfacePass.signatureMs),
    renderPagesMs: Math.round(surfacePass.renderPagesMs),
    compositeMs: Math.round(surfacePass.compositeMs),
    overlayMs: Math.round(overlayMs),
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
