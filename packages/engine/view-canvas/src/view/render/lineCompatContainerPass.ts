import { resolveNodeRendererCompatCapabilities } from "lumenpage-render-engine";

export type LineCompatContainerPassEntry = {
  container: any;
  renderContainer: (ctx: {
    ctx: any;
    line: any;
    pageTop: number;
    pageX: number;
    layout: any;
    container: any;
    defaultRender: (line: any, pageX: number, pageTop: number, layout: any) => void;
  }) => void;
};

export const collectLineCompatContainerPassEntries = ({
  line,
  registry,
}: {
  line: any;
  registry: any;
}): LineCompatContainerPassEntry[] => {
  if (!Array.isArray(line?.containers) || line.containers.length === 0 || !registry) {
    return [];
  }

  const entries: LineCompatContainerPassEntry[] = [];
  for (const container of line.containers) {
    const containerRenderer = registry.get(container.type);
    const containerCompat = resolveNodeRendererCompatCapabilities(containerRenderer);
    if (containerCompat.containerRenderMode === "fragment") {
      continue;
    }
    if (typeof containerCompat.renderContainer !== "function") {
      continue;
    }
    entries.push({
      container,
      renderContainer: containerCompat.renderContainer,
    });
  }

  return entries;
};

export const renderLineCompatContainerPasses = ({
  ctx,
  line,
  layout,
  defaultRender,
  entries,
  pageTop = 0,
  pageX = 0,
}: {
  ctx: any;
  line: any;
  layout: any;
  defaultRender: (line: any, pageX: number, pageTop: number, layout: any) => void;
  entries: LineCompatContainerPassEntry[];
  pageTop?: number;
  pageX?: number;
}) => {
  for (const entry of entries) {
    entry.renderContainer({
      ctx,
      line,
      pageTop,
      pageX,
      layout,
      container: entry.container,
      defaultRender,
    });
  }
};
