import { renderListMarker } from "lumenpage-render-engine";
import type { LineRenderPlan } from "./lineRenderPlan.js";

export const renderLineCompatListMarkerPass = ({
  ctx,
  line,
  layout,
  renderPlan,
  pageTop = 0,
  pageX = 0,
  renderListMarkerImpl = renderListMarker,
}: {
  ctx: any;
  line: any;
  layout: any;
  renderPlan: LineRenderPlan;
  pageTop?: number;
  pageX?: number;
  renderListMarkerImpl?: (args: {
    ctx: any;
    line: any;
    pageTop: number;
    pageX: number;
    layout: any;
  }) => void;
}) => {
  if (!renderPlan.shouldRunListMarkerPass) {
    return false;
  }

  renderListMarkerImpl({
    ctx,
    line,
    pageTop,
    pageX,
    layout,
  });
  return true;
};
