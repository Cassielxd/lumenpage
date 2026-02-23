import { docToRuns } from "../layout-pagination";

type WorkerRequestPayload = {
  runs: any[];
  totalLength: number;
  settings: any;
};

type WorkerResponse =
  | { id: number; ok: true; layout: any }
  | { id: number; ok: false; error: string };

const toSerializableSettings = (settings: any) => ({
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
  font: settings?.font || "16px Arial",
  wrapTolerance: Number(settings?.wrapTolerance) || 0,
  minLineWidth: Number(settings?.minLineWidth) || 0,
});

export const isWorkerPaginationEligibleDoc = (doc: any, registry: any) => {
  if (!doc || !Number.isFinite(doc?.childCount)) {
    return false;
  }
  for (let index = 0; index < doc.childCount; index += 1) {
    const block = doc.child(index);
    const renderer = registry?.get?.(block?.type?.name);
    // 带 layoutBlock/splitBlock 的复杂块（如表格）暂不走 runs-worker，避免行为不一致。
    if (renderer?.layoutBlock || renderer?.splitBlock) {
      return false;
    }
  }
  return true;
};

export const getWorkerPaginationIneligibleReason = (doc: any, registry: any) => {
  if (!doc || !Number.isFinite(doc?.childCount)) {
    return "invalid-doc";
  }
  for (let index = 0; index < doc.childCount; index += 1) {
    const block = doc.child(index);
    const typeName = block?.type?.name || "unknown";
    const renderer = registry?.get?.(typeName);
    if (renderer?.layoutBlock || renderer?.splitBlock) {
      return `complex-block:${typeName}`;
    }
  }
  return null;
};

export const createWorkerPaginationRunsPayload = (doc: any, settings: any, registry: any) => {
  const { runs, length } = docToRuns(doc, settings, registry);
  return {
    runs: runs || [],
    totalLength: Number(length) || 0,
    settings: toSerializableSettings(settings),
  };
};

export class PaginationWorkerClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<
    number,
    {
      resolve: (layout: any) => void;
      reject: (error: any) => void;
      timeoutId: ReturnType<typeof setTimeout> | null;
    }
  >();

  constructor() {
    if (typeof Worker === "undefined") {
      return;
    }
    this.worker = new Worker(new URL("./pagination.worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const data = event?.data;
      if (!data || !Number.isFinite(data.id)) {
        return;
      }
      const job = this.pending.get(data.id);
      if (!job) {
        return;
      }
      this.pending.delete(data.id);
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
      if (data.ok) {
        job.resolve(data.layout);
        return;
      }
      const errorMessage = "error" in data ? data.error : "worker-failed";
      job.reject(new Error(errorMessage || "worker-failed"));
    });
    this.worker.addEventListener("error", (error) => {
      for (const [, job] of this.pending) {
        if (job.timeoutId) {
          clearTimeout(job.timeoutId);
        }
        job.reject(error);
      }
      this.pending.clear();
      this.worker = null;
    });
  }

  requestLayout(payload: WorkerRequestPayload, timeoutMs = 5000) {
    if (!this.worker) {
      return Promise.reject(new Error("worker-unavailable"));
    }
    const id = ++this.seq;
    return new Promise<any>((resolve, reject) => {
      const timeoutId =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id);
              reject(new Error("worker-timeout"));
            }, timeoutMs)
          : null;
      this.pending.set(id, { resolve, reject, timeoutId });
      this.worker?.postMessage({ id, ...payload });
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, job] of this.pending) {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
      job.reject(new Error("worker-destroyed"));
    }
    this.pending.clear();
  }
}
