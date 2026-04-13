import type { LineRenderPlan } from "./lineRenderPlan.js";
import type { LineCompatContainerPassEntry } from "./lineCompatContainerPass.js";
import { renderLineCompatAuxiliaryPasses } from "./lineCompatAuxiliaryPass.js";
import { renderLineCompatPrimaryPass } from "./lineCompatPrimaryPass.js";

type RenderLineBodyPassArgs = {
  ctx: any;
  line: any;
  layout: any;
  renderer: any;
  nodeView: any;
  renderPlan: LineRenderPlan;
  containerEntries?: LineCompatContainerPassEntry[] | null;
  defaultRender: (line: any, pageX: number, pageTop: number, layout: any) => void;
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
  renderer,
  nodeView,
  renderPlan,
  containerEntries,
  defaultRender,
  pageTop = 0,
  pageX = 0,
}: RenderLineBodyPassArgs) => {
  renderLineCompatAuxiliaryPasses({
    ctx,
    line,
    layout,
    renderPlan,
    containerEntries,
    defaultRender,
    pageTop,
    pageX,
  });

  renderLineCompatPrimaryPass({
    ctx,
    line,
    layout,
    renderer,
    nodeView,
    renderPlan,
    defaultRender,
    pageTop,
    pageX,
  });
};
