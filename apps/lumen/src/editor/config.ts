import { createLinebreakSegmentText } from "lumenpage-view-runtime";
import { resolvePlaygroundLocale, type PlaygroundLocale } from "./i18n";

export type PlaygroundDebugFlags = {
  locale: PlaygroundLocale;
  highContrast: boolean;
  permissionMode: "full" | "comment" | "readonly";
  enableInputRules: boolean;
  enableGapCursor: boolean;
  debugPerf: boolean;
  enablePaginationWorker: boolean;
  forcePaginationWorker: boolean;
};

const resolveQueryParam = (key: string) => {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const value = params.get(key);
  if (value == null) {
    return null;
  }
  return value.trim();
};

const resolvePermissionMode = (): "full" | "comment" | "readonly" => {
  const value = (resolveQueryParam("permissionMode") || "").toLowerCase();
  if (value === "comment") {
    return "comment";
  }
  if (value === "readonly" || value === "read-only" || value === "read_only") {
    return "readonly";
  }
  return "full";
};

const resolveBooleanParam = (key: string) => {
  const value = resolveQueryParam(key);
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const resolveHighContrast = () => {
  const contrast = (resolveQueryParam("contrast") || "").toLowerCase();
  if (contrast === "high") {
    return true;
  }
  if (contrast === "normal" || contrast === "default") {
    return false;
  }
  return resolveBooleanParam("highContrast");
};

const resolveNumberParam = (key: string, fallback: number) => {
  const raw = resolveQueryParam(key);
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const resolveWorkerEnabled = () => {
  const paginationWorkerParam = resolveQueryParam("paginationWorker");
  const workerUsedParam = resolveQueryParam("workerUsed");
  if (paginationWorkerParam != null || workerUsedParam != null) {
    return resolveBooleanParam("paginationWorker") || resolveBooleanParam("workerUsed");
  }
  return true;
};

export const createPlaygroundDebugFlags = (): PlaygroundDebugFlags => ({
  locale: resolvePlaygroundLocale(),
  highContrast: resolveHighContrast(),
  permissionMode: resolvePermissionMode(),
  enableInputRules: resolveBooleanParam("inputRules"),
  enableGapCursor: resolveBooleanParam("gapCursor"),
  debugPerf: resolveBooleanParam("debugPerf"),
  enablePaginationWorker: resolveWorkerEnabled(),
  forcePaginationWorker: resolveBooleanParam("paginationWorkerForce"),
});

export const createCanvasSettings = (
  debugPerf: boolean,
  enablePaginationWorker = false,
  forcePaginationWorker = false,
  locale: PlaygroundLocale = "zh-CN",
  highContrast = false
) => {
  const incrementalEnabled = resolveBooleanParam("paginationIncremental")
    ? true
    : resolveBooleanParam("paginationIncrementalOff")
      ? false
      : true;
  const incrementalMaxPages = Math.max(4, Math.floor(resolveNumberParam("paginationMaxPages", 24)));
  const incrementalSettleDelayMs = Math.max(
    0,
    Math.floor(resolveNumberParam("paginationSettleMs", 120))
  );
  const pageReuseProbeRadius = Math.max(2, Math.floor(resolveNumberParam("pageReuseProbe", 8)));
  const pageReuseRootIndexProbeRadius = Math.max(
    0,
    Math.floor(resolveNumberParam("pageReuseRootProbe", 2))
  );

  return {
    pageWidth: 794,
    pageHeight: 1123,
    pageGap: 24,
    margin: {
      top: 72,
      right: 72,
      bottom: 72,
      left: 72,
    },
    lineHeight: 26,
    blockSpacing: 8,
    paragraphSpacingBefore: 0,
    paragraphSpacingAfter: 8,
    font: "16px Arial",
    textLocale: locale,
    highContrast,
    segmentText: createLinebreakSegmentText({ locale }),
    wrapTolerance: 2,
    pageBuffer: 1,
    maxPageCache: 32,
    debugPerf,
    pageReuseProbeRadius,
    pageReuseRootIndexProbeRadius,
    disablePageReuse: false,
    // Lumen shell prefers crisp text over sub-pixel scaling smoothness.
    pixelRatioStrategy: "integer",
    paginationWorker: (enablePaginationWorker
      ? {
          enabled: true,
          mode: "experimental-runs",
          timeoutMs: 5000,
          force: forcePaginationWorker,
          useForDocChanged: true,
          useForInitial: false,
          incremental: {
            enabled: incrementalEnabled,
            maxPages: incrementalMaxPages,
            settleDelayMs: incrementalSettleDelayMs,
          },
        }
      : {
          enabled: false,
        }) as any,
  };
};
