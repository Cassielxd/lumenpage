import {
  getLayoutChangeSummary as runtimeGetLayoutChangeSummary,
  getLayoutGhostTrace as runtimeGetLayoutGhostTrace,
  getLayoutPerfSummary as runtimeGetLayoutPerfSummary,
  getLayoutTransportPerf as runtimeGetLayoutTransportPerf,
  getLayoutVersion as runtimeGetLayoutVersion,
  getLayoutWorkerDebug as runtimeGetLayoutWorkerDebug,
  getPageLayoutVersionToken as runtimeGetPageLayoutVersionToken,
  getPageOffsetDelta as runtimeGetPageOffsetDelta,
  getPageRenderSignature as runtimeGetPageRenderSignature,
  getPageRenderSignatureVersion as runtimeGetPageRenderSignatureVersion,
  getPageSourcePageIndex as runtimeGetPageSourcePageIndex,
  isPageReused as runtimeIsPageReused,
  isProgressiveLayoutApplied as runtimeIsProgressiveLayoutApplied,
  isProgressiveLayoutTruncated as runtimeIsProgressiveLayoutTruncated,
  setLayoutChangeSummary as runtimeSetLayoutChangeSummary,
  setLayoutForceRedraw as runtimeSetLayoutForceRedraw,
  setLayoutPerfSummary as runtimeSetLayoutPerfSummary,
  setLayoutVersion as runtimeSetLayoutVersion,
  setLayoutTransportPerf as runtimeSetLayoutTransportPerf,
  setLayoutWorkerDebug as runtimeSetLayoutWorkerDebug,
  setPageLayoutVersionToken as runtimeSetPageLayoutVersionToken,
  setPageRenderSignature as runtimeSetPageRenderSignature,
  setPageRenderSignatureVersion as runtimeSetPageRenderSignatureVersion,
  shouldForceLayoutRedraw as runtimeShouldForceLayoutRedraw,
} from "lumenpage-layout-engine";

export const getLayoutChangeSummary = (layout: any): any => runtimeGetLayoutChangeSummary(layout);

export const getLayoutGhostTrace = (layout: any): any[] | null => runtimeGetLayoutGhostTrace(layout);

export const getLayoutPerfSummary = (layout: any): any => runtimeGetLayoutPerfSummary(layout);

export const getLayoutTransportPerf = (layout: any): Record<string, number> | null =>
  runtimeGetLayoutTransportPerf(layout);

export const getLayoutVersion = (layout: any): number | null => runtimeGetLayoutVersion(layout);

export const getLayoutWorkerDebug = (layout: any): any => runtimeGetLayoutWorkerDebug(layout);

export const getPageLayoutVersionToken = (page: any): number | null =>
  runtimeGetPageLayoutVersionToken(page);

export const getPageOffsetDelta = (page: any): number => runtimeGetPageOffsetDelta(page);

export const getPageRenderSignature = (page: any): number | null =>
  runtimeGetPageRenderSignature(page);

export const getPageRenderSignatureVersion = (page: any): number | null =>
  runtimeGetPageRenderSignatureVersion(page);

export const getPageSourcePageIndex = (page: any): number | null =>
  runtimeGetPageSourcePageIndex(page);

export const isPageReused = (page: any): boolean => runtimeIsPageReused(page);

export const isProgressiveLayoutApplied = (layout: any): boolean =>
  runtimeIsProgressiveLayoutApplied(layout);

export const isProgressiveLayoutTruncated = (layout: any): boolean =>
  runtimeIsProgressiveLayoutTruncated(layout);

export const setLayoutChangeSummary = (layout: any, changeSummary: any) =>
  runtimeSetLayoutChangeSummary(layout, changeSummary);

export const setLayoutForceRedraw = (layout: any, forceRedraw: boolean) =>
  runtimeSetLayoutForceRedraw(layout, forceRedraw);

export const setLayoutPerfSummary = (layout: any, summary: any) =>
  runtimeSetLayoutPerfSummary(layout, summary);

export const setLayoutVersion = (layout: any, version: number | null) =>
  runtimeSetLayoutVersion(layout, version);

export const setLayoutTransportPerf = (layout: any, perf: Record<string, number> | null) =>
  runtimeSetLayoutTransportPerf(layout, perf);

export const setLayoutWorkerDebug = (layout: any, workerDebug: any) =>
  runtimeSetLayoutWorkerDebug(layout, workerDebug);

export const setPageLayoutVersionToken = (page: any, version: number | null) =>
  runtimeSetPageLayoutVersionToken(page, version);

export const setPageRenderSignature = (page: any, signature: number | null) =>
  runtimeSetPageRenderSignature(page, signature);

export const setPageRenderSignatureVersion = (page: any, version: number | null) =>
  runtimeSetPageRenderSignatureVersion(page, version);

export const shouldForceLayoutRedraw = (layout: any): boolean =>
  runtimeShouldForceLayoutRedraw(layout);
