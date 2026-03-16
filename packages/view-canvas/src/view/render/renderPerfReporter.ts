import { emitGhostTrace, now } from "../debugTrace";

export type RendererPerfSummary = {
  ms: number;
  layoutVersion: number | null;
  prevLayoutVersion: number | null;
  layoutVersionChanged: boolean;
  skippedLayoutVersions: boolean;
  docChanged: boolean;
  forceRedraw: boolean;
  cacheClearReasons: string[];
  activePages: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
  activeStartIndex: number;
  activeEndIndex: number;
  redrawPages: number;
  cachedPages: number;
  changedRangeMin: number | null;
  changedRangeMax: number | null;
  pageCacheHits: number;
  pageCacheMisses: number;
  pageCacheRecreated: number;
  cacheSize: number;
  signatureComputedPages: number;
  signatureSkippedPages: number;
  signatureMs: number;
  renderPagesMs: number;
  compositeMs: number;
  overlayMs: number;
  pageTrace?: any[];
};

export const reportRendererPerf = ({
  settings,
  lastPerfLog,
  summary,
}: {
  settings: any;
  lastPerfLog: number;
  summary: RendererPerfSummary;
}) => {
  const nextNow = now();
  const sinceLast = nextNow - lastPerfLog;
  if (lastPerfLog && sinceLast <= 250) {
    return lastPerfLog;
  }

  if (settings?.__perf) {
    settings.__perf.render = summary;
  }

  if (typeof window !== "undefined") {
    const globalWindow = window as typeof window & {
      __lumenPerfLogs?: Array<Record<string, unknown>>;
      __lumenLastRenderPerf?: Record<string, unknown>;
      __copyLumenRenderPerf?: () => string;
    };
    const logs = Array.isArray(globalWindow.__lumenPerfLogs) ? globalWindow.__lumenPerfLogs : [];
    logs.push({
      type: "render-cache",
      timestamp: new Date().toISOString(),
      ...summary,
    });
    if (logs.length > 200) {
      logs.splice(0, logs.length - 200);
    }
    globalWindow.__lumenPerfLogs = logs;
    globalWindow.__lumenLastRenderPerf = summary;
    globalWindow.__copyLumenRenderPerf = () =>
      JSON.stringify(
        logs.filter((entry) => entry?.type === "render-cache"),
        null,
        2
      );
  }

  const panel = settings?.perfPanelEl;
  if (panel) {
    const layoutPerf = settings.__perf?.layout;
    panel.textContent = [
      "layout",
      `  ms: ${layoutPerf?.ms ?? "-"}`,
      `  pages: ${layoutPerf?.pages ?? "-"}`,
      `  blocks: ${layoutPerf?.blocks ?? "-"}`,
      `  cache: ${layoutPerf?.blockCacheHitRate ?? "-"}`,
      `  lines: ${layoutPerf?.lines ?? "-"}`,
      `  measure: ${layoutPerf?.measureCalls ?? "-"}`,
      `  reused: ${layoutPerf?.reusedPages ?? "-"}`,
      `  breakLinesMs: ${layoutPerf?.breakLinesMs ?? "-"}`,
      `  layoutLeafMs: ${layoutPerf?.layoutLeafMs ?? "-"}`,
      "render",
      `  ms: ${summary.ms}`,
      `  layoutVersion: ${summary.layoutVersion ?? "-"}`,
      `  prevLayoutVersion: ${summary.prevLayoutVersion ?? "-"}`,
      `  forceRedraw: ${summary.forceRedraw ? "yes" : "no"}`,
      `  cacheClear: ${summary.cacheClearReasons.length ? summary.cacheClearReasons.join(",") : "-"}`,
      `  active: ${summary.activePages}`,
      `  redraw: ${summary.redrawPages}`,
      `  cached: ${summary.cachedPages}`,
      `  cacheHits: ${summary.pageCacheHits}`,
      `  cacheMisses: ${summary.pageCacheMisses}`,
      `  cacheRecreated: ${summary.pageCacheRecreated}`,
      `  cacheSize: ${summary.cacheSize}`,
      `  sigComputed: ${summary.signatureComputedPages}`,
      `  sigSkipped: ${summary.signatureSkippedPages}`,
      `  signatureMs: ${summary.signatureMs}`,
      `  renderPagesMs: ${summary.renderPagesMs}`,
      `  compositeMs: ${summary.compositeMs}`,
      `  overlayMs: ${summary.overlayMs}`,
    ].join("\n");
  }

  const shouldConsoleLog =
    summary.docChanged === true ||
    summary.forceRedraw === true ||
    summary.redrawPages === 0 ||
    summary.signatureSkippedPages > 0;
  if (shouldConsoleLog) {
    console.info("[perf][render-cache]", summary);
  }

  emitGhostTrace(
    "render-cache",
    {
      layoutVersion: summary.layoutVersion,
      prevLayoutVersion: summary.prevLayoutVersion,
      layoutVersionChanged: summary.layoutVersionChanged,
      forceRedraw: summary.forceRedraw,
      cacheClearReasons: summary.cacheClearReasons,
      visibleStartIndex: summary.visibleStartIndex,
      visibleEndIndex: summary.visibleEndIndex,
      activeStartIndex: summary.activeStartIndex,
      activeEndIndex: summary.activeEndIndex,
      changedRangeMin: summary.changedRangeMin,
      changedRangeMax: summary.changedRangeMax,
      pageCacheHits: summary.pageCacheHits,
      pageCacheMisses: summary.pageCacheMisses,
      pageCacheRecreated: summary.pageCacheRecreated,
      redrawCount: summary.redrawPages,
      cachedPages: summary.cachedPages,
      signatureComputedPages: summary.signatureComputedPages,
      signatureSkippedPages: summary.signatureSkippedPages,
      pageTrace: summary.pageTrace || [],
    },
    settings
  );

  return nextNow;
};
