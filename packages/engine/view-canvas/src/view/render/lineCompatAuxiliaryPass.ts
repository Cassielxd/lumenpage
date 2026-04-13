import type { LineRenderPlan } from "./lineRenderPlan.js";
import {
  collectLineCompatContainerPassEntries,
  renderLineCompatContainerPasses,
  type LineCompatContainerPassEntry,
} from "./lineCompatContainerPass.js";
import { renderLineCompatListMarkerPass } from "./lineCompatListMarkerPass.js";

export const renderLineCompatAuxiliaryPasses = ({
  ctx,
  line,
  layout,
  registry,
  renderPlan,
  containerEntries,
  defaultRender,
  pageTop = 0,
  pageX = 0,
}: {
  ctx: any;
  line: any;
  layout: any;
  registry?: any;
  renderPlan: LineRenderPlan;
  containerEntries?: LineCompatContainerPassEntry[] | null;
  defaultRender: (line: any, pageX: number, pageTop: number, layout: any) => void;
  pageTop?: number;
  pageX?: number;
}) => {
  if (renderPlan.shouldRunContainerPass) {
    const resolvedContainerEntries =
      Array.isArray(containerEntries)
        ? containerEntries
        : collectLineCompatContainerPassEntries({
            line,
            registry,
          });
    renderLineCompatContainerPasses({
      ctx,
      line,
      layout,
      defaultRender,
      entries: resolvedContainerEntries,
      pageTop,
      pageX,
    });
  }

  renderLineCompatListMarkerPass({
    ctx,
    line,
    layout,
    renderPlan,
    pageTop,
    pageX,
  });
};
