import { resolveNodeRendererRenderCapabilities } from "lumenpage-render-engine";
import {
  type DefaultRender,
  type PageFragmentPassPlan,
  type PageRenderPlan,
  getTextLineFragmentKey,
  isTextLineFragment,
} from "./pageRenderPlan.js";
import {
  resetPageFragmentPassRuntime,
  type PageFragmentPassRuntime,
} from "./pageFragmentPassRuntime.js";

const renderFragmentTree = ({
  ctx,
  fragment,
  layout,
  registry,
  defaultRender,
  fragmentPass,
  runtime,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  fragment: any;
  layout: any;
  registry: any;
  defaultRender: DefaultRender;
  fragmentPass: PageFragmentPassPlan;
  runtime: PageFragmentPassRuntime;
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
      runtime.renderedLeafTextKeys.add(textLineKey);
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
        runtime,
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
  runtime,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  layout: any;
  registry: any;
  defaultRender: DefaultRender;
  plan: PageRenderPlan;
  runtime: PageFragmentPassRuntime;
}) => {
  resetPageFragmentPassRuntime(runtime);
  for (const fragment of plan.fragmentPass.pageFragments) {
    renderFragmentTree({
      ctx,
      fragment,
      layout,
      registry,
      defaultRender,
      fragmentPass: plan.fragmentPass,
      runtime,
    });
  }
};
