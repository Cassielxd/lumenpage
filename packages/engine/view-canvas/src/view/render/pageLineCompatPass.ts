import { renderLineBodyPass } from "./lineBodyPass.js";
import {
  resolveCompatLineEntryRenderPlan,
  type DefaultRender,
  type PageRenderPlan,
} from "./pageRenderPlan.js";
import { type PageFragmentPassRuntime } from "./pageFragmentPassRuntime.js";

export const renderPageLineCompatPass = ({
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
  for (const entryState of plan.compatPass.lineEntries) {
    const renderPlan = resolveCompatLineEntryRenderPlan(entryState, runtime.renderedLeafTextKeys);
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
