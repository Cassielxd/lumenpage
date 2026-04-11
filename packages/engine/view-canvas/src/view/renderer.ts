/* Offscreen page renderer orchestration. */

import { buildRendererPageDisplayList } from "./render/pageDisplayListBuilder.js";
import { syncRendererPageDisplayListMetadata } from "./render/pageDisplayListMetadata";
import {
  getRendererPageCacheEntry,
  type RendererPageCacheEntry,
  type RendererPageCanvasSlot,
} from "./render/pageCanvasCache";
import {
  type RendererPageDisplayList,
} from "./render/pageDisplayList";
import { executeRendererPageDisplayList } from "./render/pageDisplayListExecutor.js";
import { renderTextLine } from "./render/textLinePainter";
import { runRendererViewportPass } from "./render/renderViewportPass";
import {
  getPageLayoutVersionToken,
  setPageRenderSignature,
  setPageRenderSignatureVersion,
} from "./layoutRuntimeMetadata";

export class Renderer {
  pageLayer: HTMLElement;
  overlayCanvas: HTMLCanvasElement;
  overlayCtx: CanvasRenderingContext2D;
  settings: any;
  registry: any;
  pageCache: Map<number, RendererPageCacheEntry>;
  pageCanvases: RendererPageCanvasSlot[];
  lastDpr: number;
  lastLayoutDebug: string | null;
  nodeViewProvider: ((line: any) => any) | null;
  lastPerfLog: number;
  lastLayoutVersion: number | null;
  lastViewportWidth: number;
  lastViewportHeight: number;

  constructor(
    pageLayer: HTMLElement,
    overlayCanvas: HTMLCanvasElement,
    settings: any,
    registry = null
  ) {
    this.pageLayer = pageLayer;
    this.overlayCanvas = overlayCanvas;

    const overlayCtx = overlayCanvas.getContext("2d");
    if (!overlayCtx) {
      throw new Error("Renderer overlay canvas requires 2d context.");
    }

    this.overlayCtx = overlayCtx;
    this.settings = settings;
    this.registry = registry;
    this.pageCache = new Map();
    this.pageCanvases = [];
    this.lastDpr = 1;
    this.lastLayoutDebug = null;
    this.nodeViewProvider = null;
    this.lastPerfLog = 0;
    this.lastLayoutVersion = null;
    this.lastViewportWidth = 0;
    this.lastViewportHeight = 0;
  }

  setNodeViewProvider(provider: (line: any) => any) {
    this.nodeViewProvider = provider;
    return this;
  }

  getPageCache(pageIndex: number, layout: any, dpr: number) {
    return getRendererPageCacheEntry({
      pageCache: this.pageCache,
      pageIndex,
      layout,
      dpr,
    });
  }

  buildPageDisplayList(pageIndex: number, layout: any): RendererPageDisplayList {
    const page = layout.pages[pageIndex];
    const displayList = buildRendererPageDisplayList({
      width: layout.pageWidth,
      height: layout.pageHeight,
      pageIndex,
      page,
      layout,
      settings: this.settings,
      registry: this.registry,
      nodeViewProvider: this.nodeViewProvider,
      createDefaultRender: (ctx) => (line, pageX, pageTop, layoutRef) =>
        renderTextLine({
          ctx,
          line,
          pageX,
          pageTop,
          layout: layoutRef,
        }),
    });
    syncRendererPageDisplayListMetadata({
      page,
      displayList,
      getPageLayoutVersionToken,
      setPageRenderSignature,
      setPageRenderSignatureVersion,
    });
    return displayList;
  }

  renderPage(pageIndex: number, layout: any, entry: RendererPageCacheEntry) {
    const { ctx, width, height, dprX, dprY } = entry;

    ctx.setTransform(dprX, 0, 0, dprY, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!entry.displayList) {
      entry.displayList = this.buildPageDisplayList(pageIndex, layout);
    }
    executeRendererPageDisplayList({
      ctx,
      displayList: entry.displayList,
    });

    entry.dirty = false;
  }

  render(
    layout: any,
    viewport: any,
    caret: any,
    selectionRects = [],
    blockRects = [],
    decorations = null
  ) {
    const nextState = runRendererViewportPass({
      layout,
      viewport,
      caret,
      selectionRects,
      blockRects,
      decorations,
      settings: this.settings,
      pageLayer: this.pageLayer,
      pageCache: this.pageCache,
      pageCanvases: this.pageCanvases,
      overlayCanvas: this.overlayCanvas,
      overlayCtx: this.overlayCtx,
      state: {
        lastDpr: this.lastDpr,
        lastLayoutDebug: this.lastLayoutDebug,
        lastLayoutVersion: this.lastLayoutVersion,
        lastViewportWidth: this.lastViewportWidth,
        lastViewportHeight: this.lastViewportHeight,
        lastPerfLog: this.lastPerfLog,
      },
      buildPageDisplayList: (pageIndex, currentLayout) =>
        this.buildPageDisplayList(pageIndex, currentLayout),
      renderPage: (pageIndex, currentLayout, pageEntry) =>
        this.renderPage(pageIndex, currentLayout, pageEntry),
    });

    this.lastDpr = nextState.lastDpr;
    this.lastLayoutDebug = nextState.lastLayoutDebug;
    this.lastLayoutVersion = nextState.lastLayoutVersion;
    this.lastViewportWidth = nextState.lastViewportWidth;
    this.lastViewportHeight = nextState.lastViewportHeight;
    this.lastPerfLog = nextState.lastPerfLog;
  }
}
