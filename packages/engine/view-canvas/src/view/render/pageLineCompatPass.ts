import { renderLineBodyPass } from "./lineBodyPass";
import {
  resolveCompatLineEntryRenderPlan,
  type DefaultRender,
  type PageRenderPlan,
} from "./pageRenderPlan";

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
  for (const entryState of plan.compatPass.lineEntries) {
    const renderPlan = resolveCompatLineEntryRenderPlan(entryState, plan.fragmentPass);
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
