import { renderLineBodyPass } from "./lineBodyPass.js";
import { resolveCompatLineEntryRenderPlan } from "./pageLineEntries.js";
import {
  type PageCompatPassPlan,
  type DefaultRender,
} from "./pageRenderTypes.js";
import { type PageFragmentPassRuntime } from "./pageFragmentPassRuntime.js";

export const renderPageLineCompatPass = ({
  ctx,
  layout,
  registry,
  defaultRender,
  compatPass,
  runtime,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  layout: any;
  registry: any;
  defaultRender: DefaultRender;
  compatPass: PageCompatPassPlan;
  runtime: PageFragmentPassRuntime;
}) => {
  for (const entryState of compatPass.lineEntries) {
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
