/* Offscreen page renderer orchestration. */

import {
  buildRendererPageDisplayList,
} from "./render/pageContentPass";
import {
  type RendererPageCacheEntry,
  type RendererPageCanvasSlot,
} from "./render/pageCanvasCache";
import {
  executeRendererPageDisplayList,
  type RendererPageDisplayList,
} from "./render/pageDisplayList";
import { renderTextLine } from "./render/textLinePainter";
import { runRendererViewportPass } from "./render/renderViewportPass";

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

  constructor(pageLayer: HTMLElement, overlayCanvas: HTMLCanvasElement, settings: any, registry = null) {
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

  buildPageDisplayList(pageIndex: number, layout: any): RendererPageDisplayList {
    const page = layout.pages[pageIndex];
    return buildRendererPageDisplayList({
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
