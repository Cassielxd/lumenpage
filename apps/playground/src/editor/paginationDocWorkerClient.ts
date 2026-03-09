type WorkerResponse =
  | { id: number; ok: true; layout: any }
  | { id: number; ok: false; error: string };

export class PaginationDocWorkerClient {
  private worker: Worker | null = null;
  private seq = 0;
  private hasSeedLayout = false;
  private settingsKey = "";
  private pending = new Map<
    number,
    {
      resolve: (layout: any) => void;
      reject: (error: any) => void;
      timeoutId: ReturnType<typeof setTimeout> | null;
    }
  >();

  private buildSettingsKey(settings: any) {
    return JSON.stringify({
      pageWidth: Number(settings?.pageWidth) || 794,
      pageHeight: Number(settings?.pageHeight) || 1123,
      pageGap: Number(settings?.pageGap) || 24,
      marginTop: Number(settings?.margin?.top) || 72,
      marginRight: Number(settings?.margin?.right) || 72,
      marginBottom: Number(settings?.margin?.bottom) || 72,
      marginLeft: Number(settings?.margin?.left) || 72,
      lineHeight: Number(settings?.lineHeight) || 26,
      font: settings?.font || "16px Arial",
      textLocale: settings?.textLocale || "zh-CN",
      wrapTolerance: Number(settings?.wrapTolerance) || 0,
      minLineWidth: Number(settings?.minLineWidth) || 0,
    });
  }

  private serializeSettingsForWorker(settings: any) {
    return {
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
      wrapTolerance: Number(settings?.wrapTolerance) || 0,
      minLineWidth: Number(settings?.minLineWidth) || 0,
      disablePageReuse: settings?.disablePageReuse === true,
      debugPerf: settings?.debugPerf === true,
      paginationWorker: {
        timeoutMs: Number(settings?.paginationWorker?.timeoutMs) || 5000,
      },
    };
  }

  constructor() {
    if (typeof Worker === "undefined") {
      return;
    }
    this.worker = new Worker(new URL("./paginationDoc.worker.ts", import.meta.url), {
      type: "module",
    });
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
        this.hasSeedLayout = true;
        job.resolve(data.layout);
        return;
      }
      const message = "error" in data ? data.error : "worker-failed";
      job.reject(new Error(message || "worker-failed"));
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

  requestLayout(args: {
    doc: any;
    previousLayout: any;
    changeSummary: any;
    settings: any;
    cascadePagination?: boolean;
    cascadeFromPageIndex?: number | null;
  }) {
    if (!this.worker) {
      return Promise.reject(new Error("worker-unavailable"));
    }
    const id = ++this.seq;
    return new Promise<any>((resolve, reject) => {
      const timeoutMs = Number(args?.settings?.paginationWorker?.timeoutMs) || 5000;
      const nextSettingsKey = this.buildSettingsKey(args?.settings);
      const settingsChanged = this.settingsKey !== nextSettingsKey;
      if (settingsChanged) {
        this.settingsKey = nextSettingsKey;
        this.hasSeedLayout = false;
      }
      const hadSeedLayout = this.hasSeedLayout;
      const seedLayout = !this.hasSeedLayout ? args?.previousLayout ?? null : null;
      const timeoutId =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id);
              reject(new Error("worker-timeout"));
            }, timeoutMs)
          : null;
      this.pending.set(id, { resolve, reject, timeoutId });
      this.worker?.postMessage({
        id,
        docJson: args?.doc?.toJSON?.() ?? null,
        seedLayout,
        changeSummary: args?.changeSummary ?? null,
        settings: this.serializeSettingsForWorker(args?.settings ?? null),
        cascadePagination: args?.cascadePagination === true,
        cascadeFromPageIndex: args?.cascadeFromPageIndex ?? null,
        workerDebug: {
          hadSeedLayout,
          sentSeedLayout: !!seedLayout,
          settingsChanged,
          prevPages: args?.previousLayout?.pages?.length ?? 0,
        },
      });
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.hasSeedLayout = false;
    this.settingsKey = "";
    for (const [, job] of this.pending) {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
      job.reject(new Error("worker-destroyed"));
    }
    this.pending.clear();
  }
}
