import type { ContainerStyle, NodeRenderer } from "./node";

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
  const style =
    typeof renderer?.getContainerStyle === "function"
      ? renderer.getContainerStyle({ node, settings, registry })
      : null;
  const indent = Number.isFinite(style?.indent) ? Number(style.indent) : 0;
  const shouldPush = indent > 0 || !!renderer?.renderContainer || !!style;

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
          type: node.type.name,
          offset: context.indent,
          indent,
          baseX: baseX + context.indent,
        },
      ],
    },
  };
};
