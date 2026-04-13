import type {
  DefaultRender,
  PageCompatPassPlan,
  PageFragmentPassPlan,
} from "./pageRenderTypes.js";
import type { PageFragmentPassRuntime } from "./pageFragmentPassRuntime.js";

export type RendererPageDisplayListContext = {
  layout: any;
  settings: any;
  registry: any;
  createDefaultRender: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ) => DefaultRender;
  runtime: PageFragmentPassRuntime;
  width: number;
  height: number;
  pageIndex: number;
};

export type RendererPageShellDisplayListItem = {
  kind: "page-shell";
  signature: number | null;
};

export type RendererPageFragmentPassDisplayListItem = {
  kind: "fragment-pass";
  signature: number | null;
  pass: PageFragmentPassPlan;
};

export type RendererPageLineCompatDisplayListItem = {
  kind: "line-compat-pass";
  signature: number | null;
  pass: PageCompatPassPlan;
};

export type RendererPageDisplayListItem =
  | RendererPageShellDisplayListItem
  | RendererPageFragmentPassDisplayListItem
  | RendererPageLineCompatDisplayListItem;

export type RendererPageDisplayListSignatureItem = {
  kind: "page-shell" | "fragment-pass" | "line-compat-pass";
  signature: number | null;
};

export type RendererPageDisplayList = {
  signature: number | null;
  context: RendererPageDisplayListContext;
  items: RendererPageDisplayListItem[];
};
