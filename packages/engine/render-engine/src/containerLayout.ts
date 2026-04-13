import {
  resolveNodeRendererCompatCapabilities,
  resolveNodeRendererRenderCapabilities,
  type ContainerStyle,
  type NodeRenderer,
} from "./node.js";

type BaseContainerContext = {
  indent: number;
  containerStack: any[];
  [key: string]: unknown;
};

export type ResolvedContainerLayoutContext<T extends BaseContainerContext> = {
  style: ContainerStyle | null;
  indent: number;
  shouldPush: boolean;
  nextContext: T;
};

const getContainerFragmentKey = (node: any, baseX: number, depth: number) => {
  if (node?.attrs?.id) {
    return `container:${node.type.name}:${node.attrs.id}`;
  }
  if (typeof node?.hashCode === "function") {
    const hash = node.hashCode();
    if (hash != null) {
      return `container:${node.type.name}:${String(hash)}`;
    }
  }
  return `container:${node?.type?.name || "container"}:${depth}:${baseX}`;
};

export const resolveContainerLayoutContext = <T extends BaseContainerContext>({
  renderer,
  node,
  settings,
  registry,
  context,
  baseX,
}: {
  renderer: Pick<NodeRenderer, "getContainerStyle" | "renderContainer"> | null | undefined;
  node: any;
  settings: any;
  registry: any;
  context: T;
  baseX: number;
}): ResolvedContainerLayoutContext<T> => {
  const render = resolveNodeRendererRenderCapabilities(renderer);
  const compat = resolveNodeRendererCompatCapabilities(renderer);
  const style =
    typeof render.getContainerStyle === "function"
      ? render.getContainerStyle({ node, settings, registry })
      : null;
  const indent = Number.isFinite(style?.indent) ? Number(style.indent) : 0;
  const shouldPush = indent > 0 || !!compat.renderContainer || !!style;

  if (!shouldPush) {
    return {
      style,
      indent,
      shouldPush,
      nextContext: context,
    };
  }

  return {
    style,
    indent,
    shouldPush,
    nextContext: {
      ...context,
      indent: context.indent + indent,
      containerStack: [
        ...context.containerStack,
        {
          ...style,
          key: getContainerFragmentKey(node, baseX + context.indent, context.containerStack.length),
          type: node.type.name,
          role: "container",
          nodeId: node?.attrs?.id ?? null,
          blockId: node?.attrs?.id ?? null,
          offset: context.indent,
          indent,
          baseX: baseX + context.indent,
        },
      ],
    },
  };
};
