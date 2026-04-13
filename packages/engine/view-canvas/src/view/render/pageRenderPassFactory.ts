import type { PageCompatPassPlan, PageFragmentPassPlan, PageRenderPasses } from "./pageRenderTypes.js";
import {
  buildLeafTextLineEntryMap,
  buildPageCompatLineEntries,
  collectPageLineEntries,
  isLeafTextExpectedFromFragment,
  type PageLineEntry,
} from "./pageLineEntries.js";
import { getRendererPageFragments } from "./pageRenderFragments.js";

const buildFragmentPassPlan = (lineEntries: PageLineEntry[], page: any): PageFragmentPassPlan => ({
  pageFragments: getRendererPageFragments(page),
  leafTextLineEntries: buildLeafTextLineEntryMap(lineEntries),
  fragmentOwnedTextLineEntries: lineEntries.filter((entry) =>
    isLeafTextExpectedFromFragment(entry)
  ),
});

const buildCompatPassPlan = (lineEntries: PageLineEntry[], registry: any): PageCompatPassPlan => ({
  lineEntries: buildPageCompatLineEntries(lineEntries, registry),
});

export const createPageRenderPasses = ({
  page,
  registry,
  nodeViewProvider,
}: {
  page: any;
  registry: any;
  nodeViewProvider: ((line: any) => any) | null;
}): PageRenderPasses => {
  const lineEntries = collectPageLineEntries({
    page,
    registry,
    nodeViewProvider,
  });

  return {
    fragmentPass: buildFragmentPassPlan(lineEntries, page),
    compatPass: buildCompatPassPlan(lineEntries, registry),
  };
};
