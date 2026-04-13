import { renderLineBodyPass } from "./lineBodyPass.js";
import type { DefaultRender } from "./pageRenderTypes.js";
import type { PageCompatRuntimeEntry } from "./pageCompatPassRuntime.js";

export const renderPageCompatRuntimeEntry = ({
  ctx,
  layout,
  defaultRender,
  runtimeEntry,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  layout: any;
  defaultRender: DefaultRender;
  runtimeEntry: PageCompatRuntimeEntry;
}) => {
  const { entry, renderPlan } = runtimeEntry;
  renderLineBodyPass({
    ctx,
    line: entry.line,
    layout,
    renderer: entry.renderer,
    nodeView: entry.nodeView,
    renderPlan,
    containerEntries: entry.containerCompatEntries,
    defaultRender,
  });
};
