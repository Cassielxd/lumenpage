import { resolveNodeRendererRenderCapabilities } from "lumenpage-render-engine";
import {
  type DefaultRender,
  type PageFragmentPassPlan,
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
  fragmentPass,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  fragment: any;
  layout: any;
  registry: any;
  defaultRender: DefaultRender;
  fragmentPass: PageFragmentPassPlan;
}) => {
  if (!fragment) {
    return;
  }

  if (isTextLineFragment(fragment)) {
    const textLineKey = getTextLineFragmentKey(fragment);
    const lineEntry =
      typeof textLineKey === "string" ? fragmentPass.leafTextLineEntries.get(textLineKey) : null;
    if (
      lineEntry &&
      !lineEntry.renderPlan.shouldRunNodeViewPass &&
      (!lineEntry.renderPlan.shouldRunRendererLinePass ||
        lineEntry.renderPlan.usesDefaultTextLineRenderer)
    ) {
      defaultRender(lineEntry.line, 0, 0, layout);
      fragmentPass.renderedLeafTextKeys.add(textLineKey);
    }
    return;
  }

  const fragmentRenderer = fragment?.type ? registry?.get(fragment.type) : null;
  const render = resolveNodeRendererRenderCapabilities(fragmentRenderer);
  if (render.renderFragment) {
    render.renderFragment({
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
        fragmentPass,
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
  for (const fragment of plan.fragmentPass.pageFragments) {
    renderFragmentTree({
      ctx,
      fragment,
      layout,
      registry,
      defaultRender,
      fragmentPass: plan.fragmentPass,
    });
  }
};
