import type {
  LayoutPageRuntimeMeta,
  LayoutPerfSummary,
  LayoutResultRuntimeMeta,
  LayoutTransportPerf,
  LayoutWorkerDebugInfo,
} from "./engine/types.js";

type LayoutPageLike = {
  runtimeMeta?: LayoutPageRuntimeMeta | null;
  __reused?: boolean;
  __sourcePageIndex?: number | null;
  __pageOffsetDelta?: number | null;
  __signature?: number | null;
  __signatureVersion?: number | null;
  __layoutVersionToken?: number | null;
};

type LayoutResultLike = {
  runtimeMeta?: LayoutResultRuntimeMeta | null;
  __version?: number | null;
  __progressiveApplied?: boolean;
  __progressiveTruncated?: boolean;
  __paginationDiagnostics?: unknown;
  __ghostTrace?: unknown[] | null;
  __changeSummary?: unknown;
  __forceRedraw?: boolean;
  __layoutPerfSummary?: LayoutPerfSummary | null;
  __workerDebug?: LayoutWorkerDebugInfo | null;
  __transportPerf?: LayoutTransportPerf | null;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const readNumber = (value: unknown) => (Number.isFinite(value) ? Number(value) : null);

const ensurePageRuntimeMeta = (page: LayoutPageLike | null | undefined): LayoutPageRuntimeMeta | null => {
  if (!page) {
    return null;
  }
  if (isObjectRecord(page.runtimeMeta)) {
    return page.runtimeMeta as LayoutPageRuntimeMeta;
  }
  const runtimeMeta: LayoutPageRuntimeMeta = {
    reused: page.__reused === true,
    sourcePageIndex: readNumber(page.__sourcePageIndex),
    pageOffsetDelta: readNumber(page.__pageOffsetDelta),
    signature: readNumber(page.__signature),
    signatureVersion: readNumber(page.__signatureVersion),
    layoutVersionToken: readNumber(page.__layoutVersionToken),
  };
  page.runtimeMeta = runtimeMeta;
  return runtimeMeta;
};

const ensureLayoutRuntimeMeta = (
  layout: LayoutResultLike | null | undefined
): LayoutResultRuntimeMeta | null => {
  if (!layout) {
    return null;
  }
  if (isObjectRecord(layout.runtimeMeta)) {
    return layout.runtimeMeta as LayoutResultRuntimeMeta;
  }
  const runtimeMeta: LayoutResultRuntimeMeta = {
    layoutVersion: readNumber(layout.__version),
    progressiveApplied: layout.__progressiveApplied === true,
    progressiveTruncated: layout.__progressiveTruncated === true,
    paginationDiagnostics: layout.__paginationDiagnostics ?? null,
    ghostTrace: Array.isArray(layout.__ghostTrace) ? layout.__ghostTrace : null,
    changeSummary: layout.__changeSummary ?? null,
    forceRedraw: layout.__forceRedraw === true,
    layoutPerfSummary: layout.__layoutPerfSummary ?? null,
    workerDebug: layout.__workerDebug ?? null,
    transportPerf: layout.__transportPerf ?? null,
  };
  layout.runtimeMeta = runtimeMeta;
  return runtimeMeta;
};

export const getPageRuntimeMeta = (page: LayoutPageLike | null | undefined) =>
  ensurePageRuntimeMeta(page);

export const isPageReused = (page: LayoutPageLike | null | undefined) =>
  page?.runtimeMeta?.reused === true || page?.__reused === true;

export const markPageReused = (page: LayoutPageLike | null | undefined, reused = true) => {
  if (!page) {
    return page;
  }
  const runtimeMeta = ensurePageRuntimeMeta(page);
  if (runtimeMeta) {
    runtimeMeta.reused = reused === true;
  }
  page.__reused = reused === true;
  return page;
};

export const markPagesReused = <T extends LayoutPageLike>(pages: T[]) => {
  if (!Array.isArray(pages)) {
    return pages;
  }
  for (const page of pages) {
    markPageReused(page, true);
  }
  return pages;
};

export const getPageSourcePageIndex = (page: LayoutPageLike | null | undefined) =>
  readNumber(page?.runtimeMeta?.sourcePageIndex) ?? readNumber(page?.__sourcePageIndex);

export const setPageSourcePageIndex = (
  page: LayoutPageLike | null | undefined,
  pageIndex: number | null
) => {
  if (!page) {
    return page;
  }
  const runtimeMeta = ensurePageRuntimeMeta(page);
  const nextValue = readNumber(pageIndex);
  if (runtimeMeta) {
    runtimeMeta.sourcePageIndex = nextValue;
  }
  page.__sourcePageIndex = nextValue;
  return page;
};

export const getPageOffsetDelta = (page: LayoutPageLike | null | undefined) =>
  readNumber(page?.runtimeMeta?.pageOffsetDelta) ?? readNumber(page?.__pageOffsetDelta) ?? 0;

export const setPageOffsetDelta = (page: LayoutPageLike | null | undefined, delta: number | null) => {
  if (!page) {
    return page;
  }
  const runtimeMeta = ensurePageRuntimeMeta(page);
  const nextValue = readNumber(delta);
  if (runtimeMeta) {
    runtimeMeta.pageOffsetDelta = nextValue;
  }
  page.__pageOffsetDelta = nextValue;
  return page;
};

export const getPageRenderSignature = (page: LayoutPageLike | null | undefined) =>
  readNumber(page?.runtimeMeta?.signature) ?? readNumber(page?.__signature);

export const setPageRenderSignature = (
  page: LayoutPageLike | null | undefined,
  signature: number | null
) => {
  if (!page) {
    return page;
  }
  const runtimeMeta = ensurePageRuntimeMeta(page);
  const nextValue = readNumber(signature);
  if (runtimeMeta) {
    runtimeMeta.signature = nextValue;
  }
  page.__signature = nextValue;
  return page;
};

export const getPageRenderSignatureVersion = (page: LayoutPageLike | null | undefined) =>
  readNumber(page?.runtimeMeta?.signatureVersion) ?? readNumber(page?.__signatureVersion);

export const setPageRenderSignatureVersion = (
  page: LayoutPageLike | null | undefined,
  version: number | null
) => {
  if (!page) {
    return page;
  }
  const runtimeMeta = ensurePageRuntimeMeta(page);
  const nextValue = readNumber(version);
  if (runtimeMeta) {
    runtimeMeta.signatureVersion = nextValue;
  }
  page.__signatureVersion = nextValue;
  return page;
};

export const clearPageRenderSignature = (page: LayoutPageLike | null | undefined) => {
  if (!page) {
    return page;
  }
  setPageRenderSignature(page, null);
  setPageRenderSignatureVersion(page, null);
  return page;
};

export const getPageLayoutVersionToken = (page: LayoutPageLike | null | undefined) =>
  readNumber(page?.runtimeMeta?.layoutVersionToken) ?? readNumber(page?.__layoutVersionToken);

export const setPageLayoutVersionToken = (
  page: LayoutPageLike | null | undefined,
  version: number | null
) => {
  if (!page) {
    return page;
  }
  const runtimeMeta = ensurePageRuntimeMeta(page);
  const nextValue = readNumber(version);
  if (runtimeMeta) {
    runtimeMeta.layoutVersionToken = nextValue;
  }
  page.__layoutVersionToken = nextValue;
  return page;
};

export const getLayoutRuntimeMeta = (layout: LayoutResultLike | null | undefined) =>
  ensureLayoutRuntimeMeta(layout);

export const getLayoutVersion = (layout: LayoutResultLike | null | undefined) =>
  readNumber(layout?.runtimeMeta?.layoutVersion) ?? readNumber(layout?.__version);

export const setLayoutVersion = (
  layout: LayoutResultLike | null | undefined,
  version: number | null
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  const nextValue = readNumber(version);
  if (runtimeMeta) {
    runtimeMeta.layoutVersion = nextValue;
  }
  layout.__version = nextValue;
  return layout;
};

export const isProgressiveLayoutApplied = (layout: LayoutResultLike | null | undefined) =>
  layout?.runtimeMeta?.progressiveApplied === true || layout?.__progressiveApplied === true;

export const isProgressiveLayoutTruncated = (layout: LayoutResultLike | null | undefined) =>
  layout?.runtimeMeta?.progressiveTruncated === true || layout?.__progressiveTruncated === true;

export const setProgressiveLayoutState = (
  layout: LayoutResultLike | null | undefined,
  state: {
    applied?: boolean;
    truncated?: boolean;
  }
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  if (runtimeMeta) {
    if (typeof state.applied === "boolean") {
      runtimeMeta.progressiveApplied = state.applied;
    }
    if (typeof state.truncated === "boolean") {
      runtimeMeta.progressiveTruncated = state.truncated;
    }
  }
  if (typeof state.applied === "boolean") {
    layout.__progressiveApplied = state.applied;
  }
  if (typeof state.truncated === "boolean") {
    layout.__progressiveTruncated = state.truncated;
  }
  return layout;
};

export const getLayoutPaginationDiagnostics = (layout: LayoutResultLike | null | undefined) =>
  layout?.runtimeMeta?.paginationDiagnostics ?? layout?.__paginationDiagnostics ?? null;

export const setLayoutPaginationDiagnostics = (
  layout: LayoutResultLike | null | undefined,
  diagnostics: unknown
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  if (runtimeMeta) {
    runtimeMeta.paginationDiagnostics = diagnostics ?? null;
  }
  layout.__paginationDiagnostics = diagnostics ?? null;
  return layout;
};

export const getLayoutGhostTrace = (layout: LayoutResultLike | null | undefined) =>
  (Array.isArray(layout?.runtimeMeta?.ghostTrace)
    ? layout.runtimeMeta?.ghostTrace
    : Array.isArray(layout?.__ghostTrace)
      ? layout.__ghostTrace
      : null) ?? null;

export const setLayoutGhostTrace = (
  layout: LayoutResultLike | null | undefined,
  ghostTrace: unknown[] | null
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  const nextValue = Array.isArray(ghostTrace) ? ghostTrace : null;
  if (runtimeMeta) {
    runtimeMeta.ghostTrace = nextValue;
  }
  layout.__ghostTrace = nextValue;
  return layout;
};

export const getLayoutChangeSummary = (layout: LayoutResultLike | null | undefined) =>
  layout?.runtimeMeta?.changeSummary ?? layout?.__changeSummary ?? null;

export const setLayoutChangeSummary = (
  layout: LayoutResultLike | null | undefined,
  changeSummary: unknown
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  if (runtimeMeta) {
    runtimeMeta.changeSummary = changeSummary ?? null;
  }
  layout.__changeSummary = changeSummary ?? null;
  return layout;
};

export const shouldForceLayoutRedraw = (layout: LayoutResultLike | null | undefined) =>
  layout?.runtimeMeta?.forceRedraw === true || layout?.__forceRedraw === true;

export const setLayoutForceRedraw = (
  layout: LayoutResultLike | null | undefined,
  forceRedraw: boolean
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  if (runtimeMeta) {
    runtimeMeta.forceRedraw = forceRedraw === true;
  }
  layout.__forceRedraw = forceRedraw === true;
  return layout;
};

export const getLayoutPerfSummary = (layout: LayoutResultLike | null | undefined) =>
  layout?.runtimeMeta?.layoutPerfSummary ?? layout?.__layoutPerfSummary ?? null;

export const setLayoutPerfSummary = (
  layout: LayoutResultLike | null | undefined,
  summary: LayoutPerfSummary | null | undefined
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  if (runtimeMeta) {
    runtimeMeta.layoutPerfSummary = summary ?? null;
  }
  layout.__layoutPerfSummary = summary ?? null;
  return layout;
};

export const getLayoutWorkerDebug = (layout: LayoutResultLike | null | undefined) =>
  layout?.runtimeMeta?.workerDebug ?? layout?.__workerDebug ?? null;

export const setLayoutWorkerDebug = (
  layout: LayoutResultLike | null | undefined,
  workerDebug: LayoutWorkerDebugInfo | null | undefined
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  if (runtimeMeta) {
    runtimeMeta.workerDebug = workerDebug ?? null;
  }
  layout.__workerDebug = workerDebug ?? null;
  return layout;
};

export const getLayoutTransportPerf = (layout: LayoutResultLike | null | undefined) =>
  layout?.runtimeMeta?.transportPerf ?? layout?.__transportPerf ?? null;

export const setLayoutTransportPerf = (
  layout: LayoutResultLike | null | undefined,
  perf: LayoutTransportPerf | null | undefined
) => {
  if (!layout) {
    return layout;
  }
  const runtimeMeta = ensureLayoutRuntimeMeta(layout);
  if (runtimeMeta) {
    runtimeMeta.transportPerf = perf ?? null;
  }
  layout.__transportPerf = perf ?? null;
  return layout;
};
