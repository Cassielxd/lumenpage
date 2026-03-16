import { resolveLineRenderPlan } from "./lineRenderPlan";

const TEXT_LINE_FRAGMENT_ROLE = "text-line";

export type DefaultRender = (line: any, pageX: number, pageTop: number, layout: any) => void;

export type PageLineEntry = {
  line: any;
  nodeView: any;
  renderer: any;
  renderPlan: ReturnType<typeof resolveLineRenderPlan>;
  textLineKey: string | null;
};

export type PageRenderPlan = {
  lineEntries: PageLineEntry[];
  compatLineEntries: PageLineEntry[];
  leafTextLineEntries: Map<string, PageLineEntry>;
  renderedLeafTextKeys: Set<string>;
  pageFragments: any[];
};

export const getTextLineFragmentKey = (target: any) => {
  if (!target || typeof target !== "object") {
    return null;
  }
  if (
    typeof target.__textLineFragmentKey === "string" &&
    target.__textLineFragmentKey.length > 0
  ) {
    return target.__textLineFragmentKey;
  }
  if (target.meta && typeof target.meta === "object") {
    const metaLineKey = target.meta.lineKey;
    if (typeof metaLineKey === "string" && metaLineKey.length > 0) {
      return metaLineKey;
    }
  }
  if (
    (String(target?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
      String(target?.type || "") === TEXT_LINE_FRAGMENT_ROLE) &&
    typeof target?.key === "string" &&
    target.key.length > 0
  ) {
    return target.key;
  }
  return null;
};

export const isTextLineFragment = (fragment: any) =>
  String(fragment?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
  String(fragment?.type || "") === TEXT_LINE_FRAGMENT_ROLE;

export const getRendererPageFragments = (page: any) => {
  return Array.isArray(page?.fragments) ? page.fragments : [];
};

const collectPageLineEntries = ({
  page,
  registry,
  nodeViewProvider,
}: {
  page: any;
  registry: any;
  nodeViewProvider: ((line: any) => any) | null;
}) => {
  const pageLines = Array.isArray(page?.lines) ? page.lines : [];
  return pageLines.map((line): PageLineEntry => {
    const nodeView = nodeViewProvider?.(line);
    const renderer = registry?.get(line.blockType);
    const renderPlan = resolveLineRenderPlan(line, renderer, {
      hasNodeViewRender: !!nodeView?.render,
    });
    return {
      line,
      nodeView,
      renderer,
      renderPlan,
      textLineKey: getTextLineFragmentKey(line),
    };
  });
};

const buildLeafTextLineEntryMap = (lineEntries: PageLineEntry[]) => {
  const leafTextLineEntries = new Map<string, PageLineEntry>();
  for (const entry of lineEntries) {
    if (typeof entry.textLineKey !== "string" || entry.textLineKey.length === 0) {
      continue;
    }
    if (!entry.renderPlan.hasTextPayload) {
      continue;
    }
    leafTextLineEntries.set(entry.textLineKey, entry);
  }
  return leafTextLineEntries;
};

const hasCompatContainerWork = (line: any, registry: any) => {
  const containers = Array.isArray(line?.containers) ? line.containers : [];
  if (containers.length === 0 || !registry) {
    return false;
  }
  return containers.some((container) => {
    const containerRenderer = registry.get(container?.type);
    return (
      typeof containerRenderer?.renderContainer === "function" &&
      containerRenderer?.containerRenderMode !== "fragment"
    );
  });
};

const isLeafTextExpectedFromFragment = (entry: PageLineEntry) =>
  typeof entry.textLineKey === "string" &&
  entry.textLineKey.length > 0 &&
  entry.renderPlan.hasFragmentRenderer &&
  entry.renderPlan.hasFragmentOwner &&
  entry.renderPlan.hasTextPayload &&
  !entry.renderPlan.shouldRunNodeViewPass &&
  entry.renderPlan.usesDefaultTextLineRenderer;

const buildCompatLineEntries = (lineEntries: PageLineEntry[], registry: any) =>
  lineEntries.filter((entry) => {
    const fragmentHandlesLeafText = isLeafTextExpectedFromFragment(entry);
    const hasRendererCompatWork =
      entry.renderPlan.shouldRunRendererLinePass && !fragmentHandlesLeafText;
    const hasLeafTextCompatWork =
      entry.renderPlan.shouldRunLeafTextPass && !fragmentHandlesLeafText;

    return (
      hasCompatContainerWork(entry.line, registry) ||
      entry.renderPlan.shouldRunListMarkerPass ||
      entry.renderPlan.shouldRunNodeViewPass ||
      hasRendererCompatWork ||
      hasLeafTextCompatWork
    );
  });

export const createPageRenderPlan = ({
  page,
  registry,
  nodeViewProvider,
}: {
  page: any;
  registry: any;
  nodeViewProvider: ((line: any) => any) | null;
}): PageRenderPlan => {
  const lineEntries = collectPageLineEntries({
    page,
    registry,
    nodeViewProvider,
  });

  return {
    lineEntries,
    compatLineEntries: buildCompatLineEntries(lineEntries, registry),
    leafTextLineEntries: buildLeafTextLineEntryMap(lineEntries),
    renderedLeafTextKeys: new Set<string>(),
    pageFragments: getRendererPageFragments(page),
  };
};
