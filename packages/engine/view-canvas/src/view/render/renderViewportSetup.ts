import { type RendererViewportState } from "./rendererViewportState.js";

import {
  getLayoutChangeSummary,
  getLayoutVersion,
  setLayoutForceRedraw,
  shouldForceLayoutRedraw,
} from "../layoutRuntimeMetadata.js";

const alignToDevicePixel = (value: number, dpr: number) => Math.round(value * dpr) / dpr;
const toDevicePixels = (value: number, dpr: number) => Math.max(1, Math.round(value * dpr));

const resolveChangedRootIndexRange = (changeSummary: any) => {
  const before = changeSummary?.blocks?.before || {};
  const after = changeSummary?.blocks?.after || {};
  const candidates = [before.fromIndex, before.toIndex, after.fromIndex, after.toIndex].filter(
    (value) => Number.isFinite(value)
  );

  if (candidates.length === 0) {
    return null;
  }

  return {
    min: Math.min(...candidates),
    max: Math.max(...candidates),
  };
};

export const prepareRendererViewportSetup = ({
  layout,
  viewport,
  settings,
  pageCache,
  overlayCanvas,
  overlayCtx,
  state,
}: {
  layout: any;
  viewport: any;
  settings: any;
  pageCache: Map<number, any>;
  overlayCanvas: HTMLCanvasElement;
  overlayCtx: CanvasRenderingContext2D;
  state: RendererViewportState;
}) => {
  const cacheClearReasons: string[] = [];
  const layoutVersion = getLayoutVersion(layout);
  const prevLayoutVersion = state.lastLayoutVersion;
  const layoutVersionChanged = layoutVersion !== prevLayoutVersion;
  const skippedLayoutVersions =
    Number.isFinite(layoutVersion) &&
    Number.isFinite(prevLayoutVersion) &&
    Number(layoutVersion) > Number(prevLayoutVersion) + 1;
  const layoutForceRedraw = shouldForceLayoutRedraw(layout);
  let forceRedraw = layoutForceRedraw || skippedLayoutVersions;
  if (forceRedraw) {
    cacheClearReasons.push(layoutForceRedraw ? "layout-force-redraw" : "layout-version-skip");
    pageCache.clear();
    setLayoutForceRedraw(layout, false);
  }

  const { clientWidth, clientHeight, scrollTop } = viewport;
  const rawDpr = window.devicePixelRatio || 1;
  const dprStrategy = settings?.pixelRatioStrategy;
  const dpr = dprStrategy === "integer" ? Math.max(1, Math.ceil(rawDpr)) : rawDpr;
  let nextState: RendererViewportState = {
    ...state,
    lastLayoutVersion: layoutVersionChanged ? layoutVersion : state.lastLayoutVersion,
  };

  if (nextState.lastDpr !== dpr) {
    cacheClearReasons.push(`dpr-change:${nextState.lastDpr}->${dpr}`);
    pageCache.clear();
    nextState = {
      ...nextState,
      lastDpr: dpr,
    };
  }

  if (
    clientWidth !== nextState.lastViewportWidth ||
    clientHeight !== nextState.lastViewportHeight
  ) {
    overlayCanvas.width = toDevicePixels(clientWidth, dpr);
    overlayCanvas.height = toDevicePixels(clientHeight, dpr);
    overlayCanvas.style.width = `${clientWidth}px`;
    overlayCanvas.style.height = `${clientHeight}px`;
    nextState = {
      ...nextState,
      lastViewportWidth: clientWidth,
      lastViewportHeight: clientHeight,
    };
  }

  const overlayDprX = overlayCanvas.width / Math.max(1, clientWidth);
  const overlayDprY = overlayCanvas.height / Math.max(1, clientHeight);
  overlayCtx.setTransform(overlayDprX, 0, 0, overlayDprY, 0, 0);
  overlayCtx.clearRect(0, 0, clientWidth, clientHeight);

  const pageX = alignToDevicePixel(Math.max(0, (clientWidth - layout.pageWidth) / 2), dpr);
  if (settings?.debugLayout) {
    const signature = `${clientWidth}|${layout.pageWidth}|${layout.pageAlign}|${layout.pageOffsetX}|${pageX}`;
    if (signature !== nextState.lastLayoutDebug) {
      nextState = {
        ...nextState,
        lastLayoutDebug: signature,
      };
    }
  }

  return {
    nextState,
    cacheClearReasons,
    layoutVersion,
    prevLayoutVersion,
    layoutVersionChanged,
    skippedLayoutVersions,
    forceRedraw,
    clientHeight,
    scrollTop,
    pageX,
    dpr,
    changedRange: resolveChangedRootIndexRange(getLayoutChangeSummary(layout)),
  };
};
