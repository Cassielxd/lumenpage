import type { DefaultRender, PageRenderPlan } from "./pageRenderPlan.js";
import type { PageFragmentPassRuntime } from "./pageFragmentPassRuntime.js";

export type RendererPageDisplayListContext = {
  layout: any;
  settings: any;
  registry: any;
  createDefaultRender: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ) => DefaultRender;
  plan: PageRenderPlan;
  runtime: PageFragmentPassRuntime;
  width: number;
  height: number;
  pageIndex: number;
};

export type RendererPageDisplayListItem = {
  kind: "page-shell" | "fragment-pass" | "line-compat-pass";
  signature: number | null;
};

export type RendererPageDisplayList = {
  signature: number | null;
  context: RendererPageDisplayListContext;
  items: RendererPageDisplayListItem[];
};
