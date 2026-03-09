import { schema, createDefaultNodeRendererRegistry } from "lumenpage-kit-basic";
import { LayoutPipeline } from "lumenpage-layout-engine";
import { createLinebreakSegmentText } from "lumenpage-view-runtime";
import { docPosToTextOffset } from "lumenpage-view-canvas";

type PaginationDocWorkerRequest = {
  id: number;
  docJson: any;
  seedLayout: any;
  changeSummary: any;
  settings: any;
  cascadePagination?: boolean;
  cascadeFromPageIndex?: number | null;
  workerDebug?: {
    hadSeedLayout?: boolean;
    sentSeedLayout?: boolean;
    settingsChanged?: boolean;
    prevPages?: number;
  };
};

type PaginationDocWorkerResponse =
  | {
      id: number;
      ok: true;
      layout: any;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };

const createMeasureTextWidth = () => {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      return (font: string, text: string) => {
        ctx.font = font || "16px Arial";
        return ctx.measureText(text || "").width;
      };
    }
  }
  return (_font: string, text: string) => (text || "").length * 8;
};

const registry = createDefaultNodeRendererRegistry();
let pipeline: LayoutPipeline | null = null;
let previousLayoutState: any = null;

const normalizeSettings = (settings: any) => ({
  textLocale: settings?.textLocale || "zh-CN",
  pageWidth: Number(settings?.pageWidth) || 794,
  pageHeight: Number(settings?.pageHeight) || 1123,
  pageGap: Number(settings?.pageGap) || 24,
  margin: {
    left: Number(settings?.margin?.left) || 72,
    right: Number(settings?.margin?.right) || 72,
    top: Number(settings?.margin?.top) || 72,
    bottom: Number(settings?.margin?.bottom) || 72,
  },
  lineHeight: Number(settings?.lineHeight) || 26,
  blockSpacing: Number(settings?.blockSpacing) || 0,
  paragraphSpacingBefore: Number(settings?.paragraphSpacingBefore) || 0,
  paragraphSpacingAfter: Number(settings?.paragraphSpacingAfter) || 0,
  font: settings?.font || "16px Arial",
  segmentText: createLinebreakSegmentText({
    locale: settings?.textLocale || "zh-CN",
  }),
  wrapTolerance: Number(settings?.wrapTolerance) || 0,
  minLineWidth: Number(settings?.minLineWidth) || 0,
  disablePageReuse: settings?.disablePageReuse === true,
  debugPerf: settings?.debugPerf === true,
  measureTextWidth: createMeasureTextWidth(),
});

const ensurePipeline = (settings: any) => {
  const normalized = normalizeSettings(settings);
  if (!pipeline) {
    pipeline = new LayoutPipeline(normalized, registry);
    previousLayoutState = null;
    return pipeline;
  }
  const pageWidthChanged = Number(pipeline.settings?.pageWidth) !== Number(normalized.pageWidth);
  const pageHeightChanged = Number(pipeline.settings?.pageHeight) !== Number(normalized.pageHeight);
  const fontChanged = String(pipeline.settings?.font || "") !== String(normalized.font || "");
  pipeline.settings = { ...pipeline.settings, ...normalized };
  if (pageWidthChanged || pageHeightChanged || fontChanged) {
    pipeline.clearCache?.();
    previousLayoutState = null;
  }
  return pipeline;
};

self.onmessage = (event: MessageEvent<PaginationDocWorkerRequest>) => {
  const request = event?.data;
  if (!request || !Number.isFinite(request.id)) {
    return;
  }
  try {
    const layoutPipeline = ensurePipeline(request.settings);
    const doc = schema.nodeFromJSON(request.docJson);
    const hadPreviousLayoutState = !!previousLayoutState;
    const previousLayoutPagesBeforeSeed = previousLayoutState?.pages?.length ?? 0;
    if (request.seedLayout) {
      previousLayoutState = request.seedLayout;
    }
    const previousLayoutPagesAfterSeed = previousLayoutState?.pages?.length ?? 0;
    const layout = layoutPipeline.layoutFromDoc(
      doc,
      {
        previousLayout: previousLayoutState ?? null,
        changeSummary: request.changeSummary ?? null,
        docPosToTextOffset,
        cascadePagination: request.cascadePagination === true,
        cascadeFromPageIndex: request.cascadeFromPageIndex ?? null,
      } as any
    );
    previousLayoutState = layout;
    const response: PaginationDocWorkerResponse = {
      id: request.id,
      ok: true,
      layout: {
        ...layout,
        __layoutPerfSummary: layoutPipeline?.settings?.__perf?.layout ?? null,
        __workerDebug: {
          clientHadSeedLayout: request.workerDebug?.hadSeedLayout ?? null,
          clientSentSeedLayout: request.workerDebug?.sentSeedLayout ?? null,
          clientSettingsChanged: request.workerDebug?.settingsChanged ?? null,
          clientPrevPages: request.workerDebug?.prevPages ?? null,
          workerHadPreviousLayoutState: hadPreviousLayoutState,
          workerPrevPagesBeforeSeed: previousLayoutPagesBeforeSeed,
          workerPrevPagesAfterSeed: previousLayoutPagesAfterSeed,
          workerNextPages: layout?.pages?.length ?? 0,
        },
      },
    };
    self.postMessage(response);
  } catch (error: any) {
    const response: PaginationDocWorkerResponse = {
      id: request.id,
      ok: false,
      error: error?.message || String(error),
    };
    self.postMessage(response);
  }
};
