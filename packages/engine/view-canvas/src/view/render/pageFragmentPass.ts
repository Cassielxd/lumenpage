import {
  type DefaultRender,
  type PageRenderPlan,
  getTextLineFragmentKey,
  isTextLineFragment,
} from "./pageRenderPlan";

const renderFragmentTree = ({
  ctx,
  fragment,
  layout,
  registry,
  defaultRender,
  plan,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  fragment: any;
  layout: any;
  registry: any;
  defaultRender: DefaultRender;
  plan: PageRenderPlan;
}) => {
  if (!fragment) {
    return;
  }

  if (isTextLineFragment(fragment)) {
    const textLineKey = getTextLineFragmentKey(fragment);
    const lineEntry =
      typeof textLineKey === "string" ? plan.leafTextLineEntries.get(textLineKey) : null;
    if (
      lineEntry &&
      !lineEntry.renderPlan.shouldRunNodeViewPass &&
      (!lineEntry.renderPlan.shouldRunRendererLinePass ||
        lineEntry.renderPlan.usesDefaultTextLineRenderer)
    ) {
      defaultRender(lineEntry.line, 0, 0, layout);
      plan.renderedLeafTextKeys.add(textLineKey);
    }
    return;
  }

  const fragmentRenderer = fragment?.type ? registry?.get(fragment.type) : null;
  if (fragmentRenderer?.renderFragment) {
    fragmentRenderer.renderFragment({
      ctx,
      fragment,
      pageTop: 0,
      pageX: 0,
      layout,
      defaultRender,
    });
  }

  if (Array.isArray(fragment?.children)) {
    for (const child of fragment.children) {
      renderFragmentTree({
        ctx,
        fragment: child,
        layout,
        registry,
        defaultRender,
        plan,
      });
    }
  }
};

export const renderPageFragmentPass = ({
  ctx,
  layout,
  registry,
  defaultRender,
  plan,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  layout: any;
  registry: any;
  defaultRender: DefaultRender;
  plan: PageRenderPlan;
}) => {
  for (const fragment of plan.pageFragments) {
    renderFragmentTree({
      ctx,
      fragment,
      layout,
      registry,
      defaultRender,
      plan,
    });
  }
};
