import { Schema } from "lumenpage-model";

export type LayoutWorkerSegmenter = {
  locale?: string | string[];
  granularity?: "grapheme" | "word" | "sentence";
};

export type LayoutWorkerConfig = {
  enabled?: boolean;
  modules?: string[];
  segmenter?: LayoutWorkerSegmenter;
};

type InitMessage = {
  type: "init";
  requestId: number;
  settings: any;
  modules: string[];
  segmenter?: LayoutWorkerSegmenter;
  schemaSpec?: any;
};

type InitResultMessage = {
  type: "init-result";
  requestId: number;
  ok: boolean;
  error?: string;
};

type LayoutMessage = {
  type: "layout";
  requestId: number;
  version: number;
  doc?: any;
  steps?: any[];
  changeSummary?: any;
  pageWidth?: number;
};

type LayoutResultMessage = {
  type: "layout-result";
  requestId: number;
  version: number;
  layout: any;
};

type LayoutErrorMessage = {
  type: "layout-error";
  requestId: number;
  version?: number;
  error: string;
};

type WorkerMessage = InitResultMessage | LayoutResultMessage | LayoutErrorMessage;

type PendingRequest = {
  resolve: (value: LayoutResultMessage) => void;
  reject: (reason?: any) => void;
};

const stripFunctions = (value: any): any => {
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => stripFunctions(entry))
      .filter((entry) => entry !== undefined);
    return items;
  }
  if (value && typeof value === "object") {
    const result: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "function") {
        continue;
      }
      const next = stripFunctions(entry);
      if (next !== undefined) {
        result[key] = next;
      }
    }
    return result;
  }
  if (typeof value === "function") {
    return undefined;
  }
  return value;
};

const serializeSchemaSpec = (schema: Schema) => {
  const nodeSpecs: Record<string, any> = {};
  schema.spec.nodes.forEach((name, spec) => {
    nodeSpecs[name] = stripFunctions(spec);
  });
  const markSpecs: Record<string, any> = {};
  schema.spec.marks.forEach((name, spec) => {
    markSpecs[name] = stripFunctions(spec);
  });
  return { nodes: nodeSpecs, marks: markSpecs };
};

const sanitizeSettings = (settings: any) => {
  if (!settings || typeof settings !== "object") {
    return {};
  }
  return stripFunctions(settings);
};

export type LayoutWorkerRequest = {
  doc?: any;
  steps?: any[];
  changeSummary?: any;
  pageWidth?: number;
  version: number;
};

export type LayoutWorkerClient = {
  requestLayout: (payload: LayoutWorkerRequest) => Promise<LayoutResultMessage>;
  destroy: () => void;
  isActive: () => boolean;
  whenReady: () => Promise<boolean>;
  resetSettings: (nextSettings: any) => Promise<boolean>;
};

export const createLayoutWorkerClient = ({ settings, schema, config }: {
  settings: any;
  schema: Schema;
  config?: LayoutWorkerConfig | null;
}): LayoutWorkerClient | null => {
  const options = config || null;
  if (!options || options.enabled === false) {
    return null;
  }
  if (typeof Worker === "undefined") {
    return null;
  }

  let active = true;
  let ready = false;
  let failed = false;
  let requestId = 0;
  const pending = new Map<number, PendingRequest>();

  let worker: Worker | null = null;
  let initResolve: ((value: boolean) => void) | null = null;
  let initReject: ((reason?: any) => void) | null = null;
  let initPromise = new Promise<boolean>((resolve, reject) => {
    initResolve = resolve;
    initReject = reject;
  });

  const createWorker = () => {
    try {
      return new Worker(new URL("../layout-pagination/layoutWorker.js", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      return null;
    }
  };

  const resetInitPromise = () => {
    initPromise = new Promise<boolean>((resolve, reject) => {
      initResolve = resolve;
      initReject = reject;
    });
  };

  const buildInitPayload = (nextSettings: any): InitMessage => ({
    type: "init",
    requestId: ++requestId,
    settings: sanitizeSettings(nextSettings),
    modules: Array.isArray(options.modules) ? options.modules : [],
    segmenter: options.segmenter,
    schemaSpec: schema ? serializeSchemaSpec(schema) : null,
  });

  const handleInitResult = (message: InitResultMessage) => {
    if (message.ok) {
      ready = true;
      initResolve?.(true);
    } else {
      failed = true;
      initReject?.(new Error(message.error || "Layout worker init failed"));
    }
  };

  const handleLayoutResult = (message: LayoutResultMessage) => {
    const handler = pending.get(message.requestId);
    if (!handler) {
      return;
    }
    pending.delete(message.requestId);
    handler.resolve(message);
  };

  const handleLayoutError = (message: LayoutErrorMessage) => {
    const handler = pending.get(message.requestId);
    if (!handler) {
      return;
    }
    pending.delete(message.requestId);
    handler.reject(new Error(message.error || "Layout worker error"));
  };

  const attachWorkerHandlers = (target: Worker) => {
    target.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (!message) {
        return;
      }
      if (message.type === "init-result") {
        handleInitResult(message);
        return;
      }
      if (message.type === "layout-result") {
        handleLayoutResult(message);
        return;
      }
      if (message.type === "layout-error") {
        handleLayoutError(message);
      }
    };

    target.onerror = () => {
      failed = true;
      initReject?.(new Error("Layout worker crashed"));
      pending.forEach((handler) => handler.reject(new Error("Layout worker crashed")));
      pending.clear();
    };
  };

  const initWorker = (nextSettings: any) => {
    const payload = buildInitPayload(nextSettings);
    worker?.postMessage(payload);
  };

  worker = createWorker();
  if (!worker) {
    return null;
  }
  attachWorkerHandlers(worker);
  initWorker(settings);

  const requestLayout = async (payload: LayoutWorkerRequest) => {
    if (!active) {
      throw new Error("Layout worker is inactive");
    }
    if (failed) {
      throw new Error("Layout worker unavailable");
    }
    await initPromise;
    if (!worker || !ready) {
      throw new Error("Layout worker not ready");
    }
        const message: LayoutMessage = {
      type: "layout",
      requestId: ++requestId,
      version: payload.version,
      doc: payload.doc?.toJSON ? payload.doc.toJSON() : payload.doc,
      steps: payload.steps,
      changeSummary: payload.changeSummary,
      pageWidth: payload.pageWidth,
    };
    return new Promise<LayoutResultMessage>((resolve, reject) => {
      pending.set(message.requestId, { resolve, reject });
      worker?.postMessage(message);
    });
  };

  const destroy = () => {
    active = false;
    pending.forEach((handler) => handler.reject(new Error("Layout worker destroyed")));
    pending.clear();
    worker?.terminate();
    worker = null;
  };

  const isActive = () => active && ready && !failed;

  return {
    requestLayout,
    destroy,
    isActive,
    whenReady: () => initPromise,
    resetSettings: async (nextSettings: any) => {
      if (!active) {
        throw new Error("Layout worker is inactive");
      }
      pending.forEach((handler) => handler.reject(new Error("Layout worker reset")));
      pending.clear();
      failed = false;
      ready = false;
      worker?.terminate();
      worker = createWorker();
      if (!worker) {
        failed = true;
        throw new Error("Layout worker unavailable");
      }
      resetInitPromise();
      attachWorkerHandlers(worker);
      initWorker(nextSettings);
      return initPromise;
    },
  };
};
