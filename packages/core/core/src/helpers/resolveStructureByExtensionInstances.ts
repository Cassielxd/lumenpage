import type { MarkSpec, NodeSpec } from "lumenpage-model";
import type { NodeViewFactory } from "lumenpage-view-canvas";

import { applyCanvasHooks } from "./applyCanvasHooks";
import { applyExtensionSchema } from "./applyExtensionSchema";
import { applyGlobalAttributesToSchema } from "./applyGlobalAttributesToSchema";
import { createResolvedCanvas } from "./createResolvedCanvas";
import { createResolvedLayout } from "./createResolvedLayout";
import { createResolvedSchema } from "./createResolvedSchema";
import { getExtensionField } from "./getExtensionField";
import { callOrReturn } from "../utilities/callOrReturn";
import type {
  CanvasHooks,
  ExtensionContext,
  ExtensionInstance,
  GlobalAttributes,
  LayoutHooks,
  MarkAdapter,
  MarkAdapterMap,
  MarkAnnotationResolver,
  MarkAnnotationResolverMap,
  ResolvedStructure,
} from "../types";

export const resolveStructureByExtensionInstances = ({
  instances,
  getContext,
  resolveDirectSchema,
  resolveGlobalAttributes,
}: {
  instances: ExtensionInstance[];
  getContext: (instance: ExtensionInstance) => ExtensionContext;
  resolveDirectSchema: (
    instance: ExtensionInstance,
    ctx: ExtensionContext
  ) => NodeSpec | MarkSpec | null;
  resolveGlobalAttributes: (instances: ExtensionInstance[]) => GlobalAttributes;
}): Omit<ResolvedStructure, "instances"> => {
  const schema = createResolvedSchema();
  const layout = createResolvedLayout();
  const canvas = createResolvedCanvas();

  for (const instance of instances) {
    const ctx = getContext(instance);

    const directSchema = resolveDirectSchema(instance, ctx);

    if (directSchema) {
      applyExtensionSchema({
        target: schema,
        instance,
        schemaSpec: directSchema,
      });
    }

    const layoutHooks = callOrReturn(
      getExtensionField<() => LayoutHooks | null>(instance.extension, "layout", ctx),
      null
    );

    if (layoutHooks) {
      layout.byNodeName.set(instance.name, layoutHooks);
    }

    const canvasHooks = callOrReturn(
      getExtensionField<() => CanvasHooks | null>(instance.extension, "canvas", ctx),
      null
    );

    if (canvasHooks) {
      applyCanvasHooks(canvas, canvasHooks);
    }

    const markAdapters = callOrReturn(
      getExtensionField<() => MarkAdapterMap>(instance.extension, "addMarkAdapters", ctx),
      {}
    );

    if (markAdapters && Object.keys(markAdapters).length) {
      canvas.markAdapters = {
        ...canvas.markAdapters,
        ...markAdapters,
      };
    }

    const markAnnotationResolvers = callOrReturn(
      getExtensionField<() => MarkAnnotationResolverMap>(instance.extension, "addMarkAnnotations", ctx),
      {}
    );

    if (markAnnotationResolvers && Object.keys(markAnnotationResolvers).length) {
      canvas.markAnnotationResolvers = {
        ...canvas.markAnnotationResolvers,
        ...markAnnotationResolvers,
      };
    }

    if (instance.type === "node") {
      const renderPreset = callOrReturn(
        getExtensionField<() => string | null>(instance.extension, "renderPreset", ctx),
        null
      );

      if (renderPreset) {
        layout.renderPresetsByNodeName.set(instance.name, renderPreset);
      }

      const nodeView = callOrReturn(
        getExtensionField<() => NodeViewFactory | null>(instance.extension, "addNodeView", ctx),
        null
      );

      if (nodeView) {
        canvas.nodeViews[instance.name] = nodeView;
      }
    }

    if (instance.type === "mark") {
      const markAdapter = callOrReturn(
        getExtensionField<() => MarkAdapter | null>(instance.extension, "addMarkAdapter", ctx),
        null
      );

      if (typeof markAdapter === "function") {
        canvas.markAdapters[instance.name] = markAdapter;
      }

      const markAnnotationResolver = callOrReturn(
        getExtensionField<() => MarkAnnotationResolver | null>(instance.extension, "addMarkAnnotation", ctx),
        null
      );

      if (typeof markAnnotationResolver === "function") {
        canvas.markAnnotationResolvers[instance.name] = markAnnotationResolver;
      }
    }
  }

  applyGlobalAttributesToSchema(schema, resolveGlobalAttributes(instances));

  canvas.nodeSelectionTypes = Array.from(new Set(canvas.nodeSelectionTypes));

  return {
    schema,
    layout,
    canvas,
  };
};
