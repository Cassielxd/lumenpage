import { createPageFragmentPassRuntime } from "./pageFragmentPassRuntime.js";
import {
  getRendererPageDisplayListSignature,
  type RendererPageDisplayList,
  type RendererPageDisplayListItem,
} from "./pageDisplayList.js";
import { createPageRenderPlan, type DefaultRender } from "./pageRenderPlan.js";
import {
  buildPageFragmentPassDisplayListItem,
  buildPageLineCompatDisplayListItem,
  buildPageShellDisplayListItem,
} from "./pageDisplayListItems.js";

export type BuildRendererPageDisplayListOptions = {
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
}: BuildRendererPageDisplayListOptions): RendererPageDisplayList => {
  const plan = createPageRenderPlan({
    page,
    registry,
    nodeViewProvider,
  });
  const fragmentPassRuntime = createPageFragmentPassRuntime();
  const items: RendererPageDisplayListItem[] = [
    buildPageShellDisplayListItem({
      width,
      height,
      pageIndex,
      layout,
      settings,
    }),
    buildPageFragmentPassDisplayListItem({
      layout,
      registry,
      createDefaultRender,
      plan,
      runtime: fragmentPassRuntime,
    }),
  ];
  const compatItem = buildPageLineCompatDisplayListItem({
    layout,
    registry,
    createDefaultRender,
    plan,
    runtime: fragmentPassRuntime,
  });
  if (compatItem) {
    items.push(compatItem);
  }
  const signature = getRendererPageDisplayListSignature(items);

  return {
    signature: Number.isFinite(signature) ? Number(signature) : null,
    items,
  };
};
