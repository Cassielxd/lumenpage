import { resolveNodeRendererCompatCapabilities } from "lumenpage-render-engine";
import type { LineRenderPlan } from "./lineRenderPlan.js";

export type LineCompatPrimaryPassResult =
  | "node-view"
  | "fragment-skip"
  | "renderer-line"
  | "leaf-text"
  | "noop";

export const renderLineCompatPrimaryPass = ({
  ctx,
  line,
  layout,
  renderer,
  nodeView,
  renderPlan,
  defaultRender,
  pageTop = 0,
  pageX = 0,
}: {
  ctx: any;
  line: any;
  layout: any;
  renderer: any;
  nodeView: any;
  renderPlan: LineRenderPlan;
  defaultRender: (line: any, pageX: number, pageTop: number, layout: any) => void;
  pageTop?: number;
  pageX?: number;
}): LineCompatPrimaryPassResult => {
  const compat = resolveNodeRendererCompatCapabilities(renderer);

  if (renderPlan.shouldRunNodeViewPass && nodeView?.render) {
    nodeView.render({
      ctx,
      line,
      pageTop,
      pageX,
      layout,
      defaultRender,
    });
    return "node-view";
  }

  if (renderPlan.shouldSkipBodyPassAfterFragment) {
    return "fragment-skip";
  }

  if (renderPlan.shouldRunRendererLinePass && compat.renderLine) {
    compat.renderLine({
      ctx,
      line,
      pageTop,
      pageX,
      layout,
      defaultRender,
    });
    return "renderer-line";
  }

  if (renderPlan.shouldRunLeafTextPass) {
    defaultRender(line, pageX, pageTop, layout);
    return "leaf-text";
  }

  return "noop";
};
