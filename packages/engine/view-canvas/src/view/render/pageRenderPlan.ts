import { createPageRenderPasses } from "./pageRenderPassFactory.js";
import type { PageRenderPasses } from "./pageRenderTypes.js";

export type PageRenderPlan = PageRenderPasses;

export const createPageRenderPlan = ({
  page,
  registry,
  nodeViewProvider,
}: {
  page: any;
  registry: any;
  nodeViewProvider: ((line: any) => any) | null;
}): PageRenderPlan => {
  return createPageRenderPasses({
    page,
    registry,
    nodeViewProvider,
  });
};

export type {
  DefaultRender,
  PageCompatPassPlan,
  PageFragmentPassPlan,
  PageRenderPasses,
} from "./pageRenderTypes.js";
export { getRendererPageFragments, getTextLineFragmentKey, isTextLineFragment } from "./pageRenderFragments.js";
export { buildLeafTextLineEntryMap, collectPageLineEntries, isLeafTextExpectedFromFragment } from "./pageLineEntries.js";
