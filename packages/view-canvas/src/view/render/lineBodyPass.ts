import { renderListMarker } from "lumenpage-render-engine";
import type { LineRenderPlan } from "./lineRenderPlan";

type RenderLineBodyPassArgs = {
  ctx: any;
  line: any;
  layout: any;
  registry: any;
  renderer: any;
  nodeView: any;
  renderPlan: LineRenderPlan;
  defaultRender: (line: any, pageTop: number, pageX: number, layout: any) => void;
  pageTop?: number;
  pageX?: number;
};

/**
 * Transitional line-pass executor.
 * Complex blocks should already have painted through fragment recursion.
 * The remaining line pass only keeps auxiliary chrome and leaf text rendering alive.
 */
export const renderLineBodyPass = ({
  ctx,
  line,
  layout,
  registry,
  renderer,
  nodeView,
  renderPlan,
  defaultRender,
  pageTop = 0,
  pageX = 0,
}: RenderLineBodyPassArgs) => {
  if (renderPlan.shouldRunContainerPass && Array.isArray(line?.containers) && registry) {
    for (const container of line.containers) {
      const containerRenderer = registry.get(container.type);
      if (containerRenderer?.renderContainer) {
        containerRenderer.renderContainer({
          ctx,
          line,
          pageTop,
          pageX,
          layout,
          container,
          defaultRender,
        });
      }
    }
  }

  if (renderPlan.shouldRunListMarkerPass) {
    renderListMarker({
      ctx,
      line,
      pageTop,
      pageX,
      layout,
    });
  }

  if (renderPlan.shouldRunNodeViewPass && nodeView?.render) {
    nodeView.render({
      ctx,
      line,
      pageTop,
      pageX,
      layout,
      defaultRender,
    });
    return;
  }

  if (renderPlan.shouldSkipBodyPassAfterFragment) {
    return;
  }

  if (renderPlan.shouldRunRendererLinePass && renderer?.renderLine) {
    renderer.renderLine({
      ctx,
      line,
      pageTop,
      pageX,
      layout,
      defaultRender,
    });
    return;
  }

  if (renderPlan.shouldRunLeafTextPass) {
    defaultRender(line, pageTop, pageX, layout);
  }
};
