import {
  getDefaultNodeRenderer,
  mergeNodeRenderers,
  NodeRendererRegistry,
  type NodeRenderer,
  resolveNodeRendererViewCapabilities,
} from "lumenpage-render-engine";

type ResolvedExtensionRuntime = {
  schema?: {
    nodes?: Record<string, any>;
  };
  layout: {
    byNodeName: Map<
      string,
      {
        renderer?: any;
        pagination?: unknown;
      }
    >;
    renderPresetsByNodeName?: Map<string, string>;
  };
  canvas: {
    nodeViews?: Record<string, any>;
    markAdapters?: Record<string, any>;
    markAnnotationResolvers?: Record<string, any>;
  };
};

export const createNodeRegistry = (resolved: ResolvedExtensionRuntime) => {
  const registry = new NodeRendererRegistry();
  const layoutMap = resolved.layout?.byNodeName || new Map();
  const presetMap = resolved.layout?.renderPresetsByNodeName || new Map();
  const nodeViews = resolved.canvas?.nodeViews || {};
  const markAdapters = resolved.canvas?.markAdapters || {};
  const markAnnotationResolvers = resolved.canvas?.markAnnotationResolvers || {};
  const nodeNames = new Set<string>([
    ...Object.keys(resolved.schema?.nodes || {}),
    ...layoutMap.keys(),
    ...presetMap.keys(),
    ...Object.keys(nodeViews),
  ]);

  for (const nodeName of nodeNames) {
    const preset = presetMap.get(nodeName) || nodeName;
    const defaultRenderer = getDefaultNodeRenderer(preset);
    const layoutHooks = layoutMap.get(nodeName);
    const explicitRenderer = (layoutHooks?.renderer || null) as NodeRenderer & {
      pagination?: unknown;
    } | null;
    const mergedRenderer = mergeNodeRenderers(defaultRenderer, explicitRenderer);
    const resolvedView = resolveNodeRendererViewCapabilities(mergedRenderer);
    const createNodeView =
      nodeViews[nodeName] || resolvedView.createNodeView || defaultRenderer?.createNodeView;
    mergedRenderer.view = {
      ...(mergedRenderer.view || {}),
      ...(createNodeView ? { createNodeView } : null),
    };
    if (createNodeView) {
      mergedRenderer.createNodeView = createNodeView;
    }
    const pagination =
      layoutHooks?.pagination || mergedRenderer.layout?.pagination || mergedRenderer.pagination;
    if (pagination) {
      mergedRenderer.layout = {
        ...(mergedRenderer.layout || {}),
        pagination,
      };
      mergedRenderer.pagination = pagination;
    }

    if (!Object.values(mergedRenderer).some((value) => value != null)) {
      continue;
    }

    registry.register(nodeName, mergedRenderer);
  }

  for (const [markName, adapter] of Object.entries(markAdapters)) {
    if (adapter != null) {
      registry.registerMarkAdapter(markName, adapter);
    }
  }

  for (const [markName, resolver] of Object.entries(markAnnotationResolvers)) {
    if (resolver != null) {
      registry.registerMarkAnnotationResolver(markName, resolver);
    }
  }

  return registry;
};
