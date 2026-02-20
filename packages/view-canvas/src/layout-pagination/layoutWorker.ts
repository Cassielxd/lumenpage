/// <reference lib="webworker" />

import { LayoutPipeline } from "./engine";
import { NodeRendererRegistry } from "./nodeRegistry";
import { Schema } from "lumenpage-model";
import { Step } from "lumenpage-transform";
import { docPosToTextOffset } from "../mapping/offsetMapping";
import { createSegmentText } from "../view/segmenter";

type SegmenterOptions = {
  locale?: string | string[];
  granularity?: "grapheme" | "word" | "sentence";
};

type InitMessage = {
  type: "init";
  requestId: number;
  settings: any;
  modules: string[];
  segmenter?: SegmenterOptions;
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

type WorkerMessage = InitMessage | LayoutMessage;

const ctx: DedicatedWorkerGlobalScope = self as any;

let layoutPipeline: LayoutPipeline | null = null;
let schema: Schema | null = null;
let registry: NodeRendererRegistry | null = null;
let currentDoc: any = null;
let previousLayout: any = null;
let lastVersion = 0;
let settings: any = null;

const moduleLoaders: Record<string, () => Promise<any>> = {
  "lumenpage-kit-basic": () => import("lumenpage-kit-basic"),
};

const loadModule = async (specifier: string) => {
  const loader = moduleLoaders[specifier];
  try {
    if (loader) {
      return await loader();
    }
    return await import(/* @vite-ignore */ specifier);
  } catch (error: any) {
    console.debug("[layout-worker] module-load-failed", specifier, error?.message || String(error));
    throw error;
  }
};

const createMeasureTextWidth = (font: string) => {
  if (typeof OffscreenCanvas === "undefined") {
    return null;
  }
  const canvas = new OffscreenCanvas(1, 1);
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d || !ctx2d.measureText) {
    return null;
  }
  const cache = new Map<string, number>();
  return (fontSpec: string, text: string) => {
    const resolvedFont = fontSpec || font || "16px Arial";
    const key = `${resolvedFont}\n${text}`;
    const cached = cache.get(key);
    if (cached != null) {
      return cached;
    }
    ctx2d.font = resolvedFont;
    const width = ctx2d.measureText(text).width;
    cache.set(key, width);
    if (cache.size > 2000) {
      const first = cache.keys().next();
      if (!first.done) {
        cache.delete(first.value);
      }
    }
    return width;
  };
};

const applySettings = (nextSettings: any, segmenter?: SegmenterOptions) => {
  settings = { ...(nextSettings || {}) };
  const measure = createMeasureTextWidth(settings.font || "16px Arial");
  if (!measure) {
    throw new Error("OffscreenCanvas is not available for layout worker.");
  }
  settings.measureTextWidth = measure;
  if (segmenter) {
    settings.segmentText = createSegmentText(segmenter);
  }
};

const createRegistryFromModules = async (modules: string[]) => {
  let registryInstance: NodeRendererRegistry | null = null;
  for (const specifier of modules) {
    const mod = await loadModule(specifier);
    if (!registryInstance && typeof mod.createDefaultNodeRendererRegistry === "function") {
      registryInstance = mod.createDefaultNodeRendererRegistry();
      continue;
    }
  }
  if (!registryInstance) {
    registryInstance = new NodeRendererRegistry();
  }
  for (const specifier of modules) {
    const mod = await loadModule(specifier);
    if (typeof mod.registerNodeRenderers === "function") {
      mod.registerNodeRenderers(registryInstance);
    }
  }
  return registryInstance;
};

const resolveSchemaFromModules = async (modules: string[], schemaSpec: any) => {
  for (const specifier of modules) {
    const mod = await loadModule(specifier);
    if (mod.schema) {
      return mod.schema as Schema;
    }
  }
  if (schemaSpec && schemaSpec.nodes) {
    return new Schema(schemaSpec);
  }
  return null;
};

const sendInitResult = (requestId: number, ok: boolean, error?: string) => {
  const payload: InitResultMessage = { type: "init-result", requestId, ok, error };
  ctx.postMessage(payload);
};

const sendLayoutResult = (message: LayoutMessage, layout: any) => {
  const payload: LayoutResultMessage = {
    type: "layout-result",
    requestId: message.requestId,
    version: message.version,
    layout,
  };
  ctx.postMessage(payload);
};

const sendLayoutError = (message: LayoutMessage, error: string) => {
  const payload: LayoutErrorMessage = {
    type: "layout-error",
    requestId: message.requestId,
    version: message.version,
    error,
  };
  ctx.postMessage(payload);
};

const handleInit = async (message: InitMessage) => {
  try {
    applySettings(message.settings, message.segmenter);
    registry = await createRegistryFromModules(message.modules || []);
    schema = await resolveSchemaFromModules(message.modules || [], message.schemaSpec);
    if (!schema) {
      throw new Error("Layout worker schema is missing.");
    }
    layoutPipeline = new LayoutPipeline(settings, registry);
    previousLayout = null;
    currentDoc = null;
    lastVersion = 0;
    sendInitResult(message.requestId, true);
  } catch (error: any) {
    sendInitResult(message.requestId, false, error?.message || String(error));
  }
};

const handleLayout = (message: LayoutMessage) => {
  try {
    if (!layoutPipeline || !schema) {
      throw new Error("Layout worker not initialized.");
    }
    if (typeof message.pageWidth === "number" && message.pageWidth > 0) {
      if (settings.pageWidth !== message.pageWidth) {
        settings.pageWidth = message.pageWidth;
        layoutPipeline.clearCache?.();
      }
    }
    const hasDoc = message.doc != null;
    const hasSteps = Array.isArray(message.steps) && message.steps.length > 0;
    let doc = null;
    if (hasDoc) {
      doc = schema.nodeFromJSON(message.doc);
    } else if (hasSteps) {
      if (!currentDoc) {
        throw new Error("Layout worker has no base doc for steps.");
      }
      let nextDoc = currentDoc;
      for (const stepJson of message.steps) {
        const step = Step.fromJSON(schema, stepJson);
        const result = step.apply(nextDoc);
        if (result.failed) {
          throw new Error(result.failed);
        }
        nextDoc = result.doc;
      }
      doc = nextDoc;
    } else {
      throw new Error("Layout worker payload missing doc or steps.");
    }
    currentDoc = doc;
    const canReuse = message.version === lastVersion + 1;
    const baseLayout = canReuse ? previousLayout : null;
    if (settings.debugPerf) {
      console.debug("[layout-worker]", {
        messageVersion: message.version,
        lastVersion,
        canReuse,
        prevPages: previousLayout?.pages?.length ?? 0,
        hasDoc,
        hasSteps,
      });
    }
    const layout = layoutPipeline.layoutFromDoc(doc, {
      previousLayout: baseLayout,
      changeSummary: message.changeSummary,
      docPosToTextOffset,
    });
    previousLayout = layout;
    lastVersion = message.version;
    sendLayoutResult(message, layout);
  } catch (error) {
    sendLayoutError(message, error?.message || String(error));
  }
};

ctx.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (!message || typeof message !== "object") {
    return;
  }
  if (message.type === "init") {
    handleInit(message as InitMessage);
    return;
  }
  if (message.type === "layout") {
    handleLayout(message as LayoutMessage);
  }
};
