import type { PageCompatPassPlan } from "./pageRenderTypes.js";
import { buildPageCompatLineEntries, type PageLineEntry } from "./pageLineEntries.js";

export const createPageCompatPassPlan = ({
  lineEntries,
}: {
  lineEntries: PageLineEntry[];
}): PageCompatPassPlan => ({
  lineEntries: buildPageCompatLineEntries(lineEntries),
});
