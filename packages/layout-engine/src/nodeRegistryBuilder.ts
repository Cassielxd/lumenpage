import { NodeRendererRegistry, type NodeRenderer } from "./nodeRegistry";

type ResolvedExtensionRuntime = {
  layout: {
    byNodeName: Map<
      string,
      {
        renderer?: any;
        pagination?: unknown;
      }
    >;
  };
  canvas: {
    nodeViews: Record<string, any>;
  };
};

export const createNodeRegistry = (resolved: ResolvedExtensionRuntime) => {
  const registry = new NodeRendererRegistry();

  for (const [nodeName, layoutHooks] of resolved.layout.byNodeName.entries()) {
    const baseRenderer = (layoutHooks?.renderer || {}) as NodeRenderer & {
      pagination?: unknown;
    };
    const createNodeView = resolved.canvas.nodeViews[nodeName];

    registry.register(nodeName, {
      ...baseRenderer,
      pagination: layoutHooks?.pagination || baseRenderer?.pagination,
      createNodeView: createNodeView || baseRenderer?.createNodeView,
    });
  }

  return registry;
};
