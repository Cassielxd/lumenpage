import type { PageRenderPasses } from "./pageRenderTypes.js";
import { collectPageLineEntries } from "./pageLineEntries.js";
import { createPageCompatPassPlan } from "./pageCompatPassFactory.js";
import { createPageFragmentPassPlan } from "./pageFragmentPassFactory.js";

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
    fragmentPass: createPageFragmentPassPlan({
      page,
      lineEntries,
    }),
    compatPass: createPageCompatPassPlan({
      lineEntries,
    }),
  };
};
