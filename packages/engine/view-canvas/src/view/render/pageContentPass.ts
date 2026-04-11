import {
  type RendererPageDisplayList,
} from "./pageDisplayList.js";
import { executeRendererPageDisplayList } from "./pageDisplayListExecutor.js";
import { type DefaultRender } from "./pageRenderPlan.js";
import {
  getPageLayoutVersionToken,
  setPageRenderSignature,
  setPageRenderSignatureVersion,
} from "../layoutRuntimeMetadata.js";
import { syncRendererPageDisplayListMetadata } from "./pageDisplayListMetadata.js";
import { buildRendererPageDisplayList } from "./pageDisplayListBuilder.js";

export { getRendererPageFragments } from "./pageRenderPlan.js";

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
  syncRendererPageDisplayListMetadata({
    page,
    displayList,
    getPageLayoutVersionToken,
    setPageRenderSignature,
    setPageRenderSignatureVersion,
  });
  executeRendererPageDisplayList({
    ctx,
    displayList,
  });
};

export { buildRendererPageDisplayList } from "./pageDisplayListBuilder.js";
