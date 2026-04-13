import { patchViewOptimizationPerf } from "./settingsRuntimeState.js";

export type OptimizationPolicy = {
  enableExperimentalOptimizations: boolean;
  fastSelectionShortCircuit: boolean;
  singlePageInlineRelayout: boolean;
  overlayHotzoneClip: boolean;
  overlayClipMargin: number;
  indexedCaretLookup: boolean;
  indexedSelectionRects: boolean;
  layoutFrontierDebug: boolean;
  stablePageMinStreak: number;
  compareMode: boolean;
  autoFallbackOnMismatch: boolean;
};

const DEFAULT_OPTIMIZATION_POLICY: OptimizationPolicy = Object.freeze({
  enableExperimentalOptimizations: true,
  fastSelectionShortCircuit: true,
  singlePageInlineRelayout: true,
  overlayHotzoneClip: true,
  overlayClipMargin: 320,
  indexedCaretLookup: true,
  indexedSelectionRects: true,
  layoutFrontierDebug: true,
  stablePageMinStreak: 1,
  compareMode: false,
  autoFallbackOnMismatch: true,
});

const clampNonNegativeNumber = (value: unknown, fallback: number) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Number(value));
};

const clampMinNumber = (value: unknown, fallback: number, min: number) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Number(value));
};

export const resolveOptimizationPolicy = (settings: Record<string, any> | null | undefined) => {
  const patch = settings?.optimizationPolicy || {};
  return {
    ...DEFAULT_OPTIMIZATION_POLICY,
    ...patch,
    enableExperimentalOptimizations:
      patch.enableExperimentalOptimizations !== false &&
      DEFAULT_OPTIMIZATION_POLICY.enableExperimentalOptimizations,
    fastSelectionShortCircuit:
      patch.fastSelectionShortCircuit !== false &&
      DEFAULT_OPTIMIZATION_POLICY.fastSelectionShortCircuit,
    singlePageInlineRelayout:
      patch.singlePageInlineRelayout !== false &&
      DEFAULT_OPTIMIZATION_POLICY.singlePageInlineRelayout,
    overlayHotzoneClip:
      patch.overlayHotzoneClip !== false && DEFAULT_OPTIMIZATION_POLICY.overlayHotzoneClip,
    indexedCaretLookup:
      patch.indexedCaretLookup !== false && DEFAULT_OPTIMIZATION_POLICY.indexedCaretLookup,
    indexedSelectionRects:
      patch.indexedSelectionRects !== false && DEFAULT_OPTIMIZATION_POLICY.indexedSelectionRects,
    layoutFrontierDebug:
      patch.layoutFrontierDebug !== false && DEFAULT_OPTIMIZATION_POLICY.layoutFrontierDebug,
    compareMode: patch.compareMode === true,
    autoFallbackOnMismatch:
      patch.autoFallbackOnMismatch !== false &&
      DEFAULT_OPTIMIZATION_POLICY.autoFallbackOnMismatch,
    overlayClipMargin: clampNonNegativeNumber(
      patch.overlayClipMargin,
      DEFAULT_OPTIMIZATION_POLICY.overlayClipMargin
    ),
    stablePageMinStreak: clampMinNumber(
      patch.stablePageMinStreak,
      DEFAULT_OPTIMIZATION_POLICY.stablePageMinStreak,
      1
    ),
  } satisfies OptimizationPolicy;
};

export const getVisibleYRange = (
  scrollTop: number,
  viewportHeight: number,
  clipMargin = 0
) => {
  const margin = clampNonNegativeNumber(clipMargin, 0);
  const height = clampNonNegativeNumber(viewportHeight, 0);
  return {
    top: -margin,
    bottom: height + margin,
    absoluteTop: clampNonNegativeNumber(scrollTop, 0) - margin,
    absoluteBottom: clampNonNegativeNumber(scrollTop, 0) + height + margin,
  };
};

export const rectIntersectsVisibleYRange = (
  rect: { y?: number; height?: number } | null | undefined,
  visibleYRange: { top: number; bottom: number } | null | undefined
) => {
  if (!rect || !visibleYRange) {
    return true;
  }
  const rectTop = Number.isFinite(rect.y) ? Number(rect.y) : Number.NaN;
  const rectHeight = Number.isFinite(rect.height) ? Math.max(0, Number(rect.height)) : Number.NaN;
  if (!Number.isFinite(rectTop) || !Number.isFinite(rectHeight)) {
    return true;
  }
  const rectBottom = rectTop + rectHeight;
  return rectBottom >= visibleYRange.top && rectTop <= visibleYRange.bottom;
};

export const filterRectsByVisibleYRange = <
  T extends {
    y?: number;
    height?: number;
  },
>(
  rects: T[] | null | undefined,
  visibleYRange: { top: number; bottom: number } | null | undefined
) => {
  if (!Array.isArray(rects) || rects.length === 0) {
    return [];
  }
  if (!visibleYRange) {
    return rects.slice();
  }
  return rects.filter((rect) => rectIntersectsVisibleYRange(rect, visibleYRange));
};

export const recordOptimizationPerf = (
  settings: Record<string, any> | null | undefined,
  patch: Record<string, any>
) => {
  if (!settings || typeof settings !== "object" || !patch || typeof patch !== "object") {
    return null;
  }
  return patchViewOptimizationPerf(settings, patch);
};
