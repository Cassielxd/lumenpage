import type { DefaultRender, PageRenderPlan } from "./pageRenderPlan.js";
import type { PageFragmentPassRuntime } from "./pageFragmentPassRuntime.js";

export type RendererPageShellDisplayListItem = {
  kind: "page-shell";
  signature: number | null;
  width: number;
  height: number;
  pageIndex: number;
  layout: any;
  settings: any;
};

export type RendererPageRenderPassDisplayListItem = {
  kind: "fragment-pass" | "line-compat-pass";
  signature: number | null;
  layout: any;
  registry: any;
  createDefaultRender: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ) => DefaultRender;
  plan: PageRenderPlan;
  runtime: PageFragmentPassRuntime;
};

export type RendererPageDisplayListItem =
  | RendererPageShellDisplayListItem
  | RendererPageRenderPassDisplayListItem;

export type RendererPageDisplayList = {
  signature: number | null;
  items: RendererPageDisplayListItem[];
};

const hashNumber = (hash: number, value: unknown) => {
  const num = Number.isFinite(value) ? Math.round(Number(value)) : 0;
  return (hash * 31 + num) | 0;
};

const hashString = (hash: number, value: unknown) => {
  if (!value) {
    return hash;
  }

  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }

  return hash;
};

export const getRendererPageDisplayListSignature = (
  items: RendererPageDisplayListItem[]
): number | null => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  let hash = 17;
  for (const item of items) {
    hash = hashString(hash, item.kind);
    hash = hashNumber(hash, item.signature);
  }

  return hash >>> 0;
};
