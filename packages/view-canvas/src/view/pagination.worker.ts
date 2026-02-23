import { LayoutPipeline } from "../layout-pagination/engine";

type PaginationWorkerRequest = {
  id: number;
  runs: any[];
  totalLength: number;
  settings: {
    pageWidth: number;
    pageHeight: number;
    pageGap: number;
    margin: { left: number; right: number; top: number; bottom: number };
    lineHeight: number;
    font: string;
    wrapTolerance?: number;
    minLineWidth?: number;
  };
};

type PaginationWorkerResponse =
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

self.onmessage = (event: MessageEvent<PaginationWorkerRequest>) => {
  const request = event?.data;
  if (!request || !Number.isFinite(request.id)) {
    return;
  }

  try {
    const measureTextWidth = createMeasureTextWidth();
    const pipeline = new LayoutPipeline(
      {
        ...request.settings,
        measureTextWidth,
      },
      null
    );
    const layout = pipeline.layoutFromRuns(request.runs || [], Number(request.totalLength) || 0);
    const response: PaginationWorkerResponse = { id: request.id, ok: true, layout };
    self.postMessage(response);
  } catch (error: any) {
    const response: PaginationWorkerResponse = {
      id: request.id,
      ok: false,
      error: error?.message || String(error),
    };
    self.postMessage(response);
  }
};

