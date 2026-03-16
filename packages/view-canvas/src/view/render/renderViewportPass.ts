import { now } from "../debugTrace";
import { type DecorationDrawData } from "./decorations";
import { updatePaginationDebugPanel } from "./paginationDebugPanel";
import { renderOverlayLayer } from "./overlayRenderer";
import {
  completeRendererViewportPass,
} from "./renderViewportCompletion";
import { renderPageSurfacePass } from "./pageSurfacePass";
import {
  prepareRendererViewportSetup,
} from "./renderViewportSetup";
import {
  type RendererPageCacheEntry,
  type RendererPageCanvasSlot,
} from "./pageCanvasCache";
import { type RendererViewportState } from "./rendererViewportState";

export type { RendererViewportState } from "./rendererViewportState";

export const runRendererViewportPass = ({
  layout,
  viewport,
  caret,
  selectionRects = [],
  blockRects = [],
  decorations = null,
  settings,
  pageLayer,
  pageCache,
  pageCanvases,
  overlayCanvas,
  overlayCtx,
  state,
  getPageSignature,
  renderPage,
}: {
  layout: any;
  viewport: any;
  caret: any;
  selectionRects?: any[];
  blockRects?: any[];
  decorations?: DecorationDrawData | null;
  settings: any;
  pageLayer: HTMLElement;
  pageCache: Map<number, RendererPageCacheEntry>;
  pageCanvases: RendererPageCanvasSlot[];
  overlayCanvas: HTMLCanvasElement;
  overlayCtx: CanvasRenderingContext2D;
  state: RendererViewportState;
  getPageSignature: (page: any) => number;
  renderPage: (pageIndex: number, layout: any, entry: RendererPageCacheEntry) => void;
}) => {
  if (!layout) {
    return state;
  }

  const perfStart = settings?.debugPerf ? now() : 0;
  const setup = prepareRendererViewportSetup({
    layout,
    viewport,
    settings,
    pageCache,
    overlayCanvas,
    overlayCtx,
    state,
  });

  const surfacePass = renderPageSurfacePass({
    layout,
    settings,
    pageLayer,
    pageCache,
    pageCanvases,
    scrollTop: setup.scrollTop,
    clientHeight: setup.clientHeight,
    pageX: setup.pageX,
    dpr: setup.dpr,
    layoutVersion: setup.layoutVersion,
    layoutVersionChanged: setup.layoutVersionChanged,
    forceRedraw: setup.forceRedraw,
    changedRange: setup.changedRange,
    getPageSignature,
    renderPage,
  });

  updatePaginationDebugPanel({
    settings,
    layout,
    visible: surfacePass.visible,
  });

  const overlayStart = settings?.debugPerf ? now() : 0;
  renderOverlayLayer({
    ctx: overlayCtx,
    settings,
    clientHeight: setup.clientHeight,
    caret,
    selectionRects,
    blockRects,
    decorations,
  });

  const overlayMs = settings?.debugPerf ? now() - overlayStart : 0;
  return completeRendererViewportPass({
    settings,
    perfStart,
    pageCache,
    state,
    nextState: setup.nextState,
    layout,
    layoutVersion: setup.layoutVersion,
    prevLayoutVersion: setup.prevLayoutVersion,
    layoutVersionChanged: setup.layoutVersionChanged,
    skippedLayoutVersions: setup.skippedLayoutVersions,
    forceRedraw: setup.forceRedraw,
    cacheClearReasons: setup.cacheClearReasons,
    changedRange: setup.changedRange,
    surfacePass,
    overlayMs,
  });
};
