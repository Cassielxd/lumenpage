import { renderPageFragmentPass } from "./pageFragmentPass";
import { renderPageLineCompatPass } from "./pageLineCompatPass";
import {
  executeRendererPageDisplayList,
  getRendererPageDisplayListSignature,
  type RendererPageDisplayList,
  type RendererPageDisplayListItem,
} from "./pageDisplayList";
import {
  getRendererFragmentPassSignature,
  getRendererLineCompatPassSignature,
  getRendererPageShellSignature,
} from "./pageSignature";
import { createPageRenderPlan, type DefaultRender } from "./pageRenderPlan";
import {
  getPageLayoutVersionToken,
  setPageRenderSignature,
  setPageRenderSignatureVersion,
} from "../layoutRuntimeMetadata";

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
  const displayList = buildRendererPageDisplayList({
    width,
    height,
    pageIndex,
    page,
    layout,
    settings,
    registry,
    nodeViewProvider,
    createDefaultRender: () => defaultRender,
  });
  executeRendererPageDisplayList({
    ctx,
    displayList,
  });
};

export const buildRendererPageDisplayList = ({
  width,
  height,
  pageIndex,
  page,
  layout,
  settings,
  registry,
  nodeViewProvider,
  createDefaultRender,
}: {
  width: number;
  height: number;
  pageIndex: number;
  page: any;
  layout: any;
  settings: any;
  registry: any;
  nodeViewProvider: ((line: any) => any) | null;
  createDefaultRender: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ) => DefaultRender;
}): RendererPageDisplayList => {
  const plan = createPageRenderPlan({
    page,
    registry,
    nodeViewProvider,
  });
  const items: RendererPageDisplayListItem[] = [
    {
      kind: "page-shell",
      signature: getRendererPageShellSignature({
        width,
        height,
      }),
      paint: (ctx) =>
        renderPageShell({
          ctx,
          width,
          height,
          pageIndex,
          layout,
          settings,
        }),
    },
    {
      kind: "fragment-pass",
      signature: getRendererFragmentPassSignature({
        plan,
        registry,
      }),
      paint: (ctx) =>
        renderPageFragmentPass({
          ctx,
          layout,
          registry,
          defaultRender: createDefaultRender(ctx),
          plan,
        }),
    },
  ];
  if (plan.compatPass.lineEntries.length > 0) {
    items.push({
      kind: "line-compat-pass",
      signature: getRendererLineCompatPassSignature({
        plan,
      }),
      paint: (ctx) =>
        renderPageLineCompatPass({
          ctx,
          layout,
          registry,
          defaultRender: createDefaultRender(ctx),
          plan,
        }),
    });
  }
  const signature = getRendererPageDisplayListSignature(items);
  const layoutVersion = getPageLayoutVersionToken(page);

  if (page) {
    setPageRenderSignature(page, signature);
    if (layoutVersion != null) {
      setPageRenderSignatureVersion(page, layoutVersion);
    }
  }

  return {
    signature: Number.isFinite(signature) ? Number(signature) : null,
    items,
  };
};
