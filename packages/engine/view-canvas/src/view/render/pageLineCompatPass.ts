import { renderLineBodyPass } from "./lineBodyPass";
import { resolveLineRenderPlan } from "./lineRenderPlan";
import { type DefaultRender, type PageRenderPlan } from "./pageRenderPlan";

export const renderPageLineCompatPass = ({
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
  for (const entryState of plan.compatLineEntries) {
    const renderPlan = resolveLineRenderPlan(entryState.line, entryState.renderer, {
      hasNodeViewRender: !!entryState.nodeView?.render,
      hasLeafTextFragment:
        typeof entryState.textLineKey === "string" &&
        plan.renderedLeafTextKeys.has(entryState.textLineKey),
    });
    if (!renderPlan.shouldRunCompatPass) {
      continue;
    }
    renderLineBodyPass({
      ctx,
      line: entryState.line,
      layout,
      registry,
      renderer: entryState.renderer,
      nodeView: entryState.nodeView,
      renderPlan,
      defaultRender,
    });
  }
};
