import {
  getRendererFragmentPassSignature,
  getRendererLineCompatPassSignature,
  getRendererPageShellSignature,
} from "./pageSignature.js";
import {
  type RendererPageDisplayListItem,
} from "./pageDisplayList.js";
import {
  type DefaultRender,
  type PageRenderPlan,
} from "./pageRenderPlan.js";
import { type PageFragmentPassRuntime } from "./pageFragmentPassRuntime.js";

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

export const renderPageShell = ({
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

export const buildPageShellDisplayListItem = ({
  width,
  height,
  pageIndex,
  layout,
  settings,
}: {
  width: number;
  height: number;
  pageIndex: number;
  layout: any;
  settings: any;
}): RendererPageDisplayListItem => ({
  kind: "page-shell",
  signature: getRendererPageShellSignature({
    width,
    height,
  }),
  width,
  height,
  pageIndex,
  layout,
  settings,
});

export const buildPageFragmentPassDisplayListItem = ({
  layout,
  registry,
  createDefaultRender,
  plan,
  runtime,
}: {
  layout: any;
  registry: any;
  createDefaultRender: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ) => DefaultRender;
  plan: PageRenderPlan;
  runtime: PageFragmentPassRuntime;
}): RendererPageDisplayListItem => ({
  kind: "fragment-pass",
  signature: getRendererFragmentPassSignature({
    plan,
    registry,
  }),
  layout,
  registry,
  createDefaultRender,
  plan,
  runtime,
});

export const buildPageLineCompatDisplayListItem = ({
  layout,
  registry,
  createDefaultRender,
  plan,
  runtime,
}: {
  layout: any;
  registry: any;
  createDefaultRender: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ) => DefaultRender;
  plan: PageRenderPlan;
  runtime: PageFragmentPassRuntime;
}): RendererPageDisplayListItem | null => {
  if (plan.compatPass.lineEntries.length === 0) {
    return null;
  }

  return {
    kind: "line-compat-pass",
    signature: getRendererLineCompatPassSignature({
      plan,
    }),
    layout,
    registry,
    createDefaultRender,
    plan,
    runtime,
  };
};
