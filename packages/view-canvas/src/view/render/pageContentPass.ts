import { renderPageFragmentPass } from "./pageFragmentPass";
import { renderPageLineCompatPass } from "./pageLineCompatPass";
import { createPageRenderPlan, type DefaultRender } from "./pageRenderPlan";

export { getRendererPageFragments } from "./pageRenderPlan";

const drawDefaultPageBackground = ({
  ctx,
  width,
  height,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
}) => {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d1d5db";
  ctx.strokeRect(0, 0, width, height);
};

const drawDefaultPageChrome = () => {};

const renderPageShell = ({
  ctx,
  width,
  height,
  pageIndex,
  layout,
  settings,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  pageIndex: number;
  layout: any;
  settings: any;
}) => {
  const renderPageBackground = settings?.renderPageBackground;
  let backgroundHandled = false;
  if (typeof renderPageBackground === "function") {
    backgroundHandled =
      renderPageBackground({
        ctx,
        width,
        height,
        pageIndex,
        layout,
        drawDefaultBackground: () => drawDefaultPageBackground({ ctx, width, height }),
      }) === true;
  }
  if (!backgroundHandled) {
    drawDefaultPageBackground({ ctx, width, height });
  }

  const renderPageChrome = settings?.renderPageChrome;
  let chromeHandled = false;
  if (typeof renderPageChrome === "function") {
    chromeHandled =
      renderPageChrome({
        ctx,
        width,
        height,
        pageIndex,
        layout,
        drawDefaultCornerMarks: drawDefaultPageChrome,
      }) === true;
  }
  if (!chromeHandled) {
    drawDefaultPageChrome();
  }

  ctx.textBaseline = "top";
};

export const renderPageContentPass = ({
  ctx,
  width,
  height,
  pageIndex,
  page,
  layout,
  settings,
  registry,
  nodeViewProvider,
  defaultRender,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  pageIndex: number;
  page: any;
  layout: any;
  settings: any;
  registry: any;
  nodeViewProvider: ((line: any) => any) | null;
  defaultRender: DefaultRender;
}) => {
  renderPageShell({
    ctx,
    width,
    height,
    pageIndex,
    layout,
    settings,
  });

  const plan = createPageRenderPlan({
    page,
    registry,
    nodeViewProvider,
  });

  renderPageFragmentPass({
    ctx,
    layout,
    registry,
    defaultRender,
    plan,
  });

  renderPageLineCompatPass({
    ctx,
    layout,
    registry,
    defaultRender,
    plan,
  });
};
