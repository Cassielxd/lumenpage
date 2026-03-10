import { LayoutPipeline } from "lumenpage-layout-engine";
import { createLinebreakSegmentText, measureTextWidth } from "lumenpage-view-runtime";

export type PaginationDocWorkerRequest = {
  id: number;
  docJson: any;
  seedLayout: any;
  changeSummary: any;
  settings: any;
   cascadePagination?: boolean;
   cascadeFromPageIndex?: number | null;
};

export type PaginationDocWorkerResponse =
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

type WorkerScopeLike = {
  onmessage: ((event: MessageEvent<PaginationDocWorkerRequest>) => void) | null;
  postMessage: (message: PaginationDocWorkerResponse) => void;
};

type PaginationDocWorkerSchema = {
  nodeFromJSON: (json: any) => any;
};

type AttachPaginationDocWorkerArgs = {
  workerScope: WorkerScopeLike;
  schema: PaginationDocWorkerSchema;
  createNodeRendererRegistry: () => any;
  docPosToTextOffset: (doc: any, pos: number) => number;
};

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
  measureTextWidth,
});

export const attachPaginationDocWorker = ({
  workerScope,
  schema,
  createNodeRendererRegistry,
  docPosToTextOffset,
}: AttachPaginationDocWorkerArgs) => {
  const registry = createNodeRendererRegistry();
  let pipeline: LayoutPipeline | null = null;
  let previousLayoutState: any = null;

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

  const handleMessage = (event: MessageEvent<PaginationDocWorkerRequest>) => {
    const request = event?.data;
    if (!request || !Number.isFinite(request.id)) {
      return;
    }
    const perf: Record<string, number> = {};
    const mark = (name: string) => {
      perf[name] = (perf[name] || 0) + (performance.now() - (perf._start || 0));
      perf._start = performance.now();
    };
    perf._start = performance.now();
    try {
      mark("init");
      const layoutPipeline = ensurePipeline(request.settings);
      mark("ensurePipeline");
      const doc = schema.nodeFromJSON(request.docJson);
      mark("nodeFromJSON");
      if (request.seedLayout) {
        previousLayoutState = request.seedLayout;
      }
      mark("beforeLayoutFromDoc");
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
      mark("layoutFromDoc");
      previousLayoutState = layout;
      const response: PaginationDocWorkerResponse = {
        id: request.id,
        ok: true,
        layout: {
          ...layout,
          __perf: perf,
        },
      };
      mark("postMessage");
      workerScope.postMessage(response);
    } catch (error: any) {
      const response: PaginationDocWorkerResponse = {
        id: request.id,
        ok: false,
        error: error?.message || String(error),
      };
      workerScope.postMessage(response);
    }
  };

  workerScope.onmessage = handleMessage;

  return {
    dispose: () => {
      if (workerScope.onmessage === handleMessage) {
        workerScope.onmessage = null;
      }
    },
  };
};
