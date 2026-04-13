import {
  getRendererFragmentPassSignature,
  getRendererLineCompatPassSignature,
  getRendererPageShellSignature,
} from "./pageSignature.js";
import {
  type RendererPageFragmentPassDisplayListItem,
  type RendererPageLineCompatDisplayListItem,
  type RendererPageDisplayListContext,
  type RendererPageShellDisplayListItem,
} from "./pageDisplayList.js";
import type { PageCompatPassPlan, PageFragmentPassPlan } from "./pageRenderTypes.js";

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
  context,
}: {
  context: RendererPageDisplayListContext;
}): RendererPageShellDisplayListItem => ({
  kind: "page-shell",
  signature: getRendererPageShellSignature({
    width: context.width,
    height: context.height,
  }),
});

export const buildPageFragmentPassDisplayListItem = ({
  fragmentPass,
  registry,
}: {
  fragmentPass: PageFragmentPassPlan;
  registry: any;
}): RendererPageFragmentPassDisplayListItem => ({
  kind: "fragment-pass",
  signature: getRendererFragmentPassSignature({
    fragmentPass,
    registry,
  }),
  pass: fragmentPass,
});

export const buildPageLineCompatDisplayListItem = ({
  compatPass,
}: {
  compatPass: PageCompatPassPlan;
}): RendererPageLineCompatDisplayListItem | null => {
  if (compatPass.lineEntries.length === 0) {
    return null;
  }

  return {
    kind: "line-compat-pass",
    signature: getRendererLineCompatPassSignature({
      compatPass,
    }),
    pass: compatPass,
  };
};
