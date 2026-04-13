import type { LineRenderPlan } from "./lineRenderPlan.js";
import {
  resolveCompatLineEntryRenderPlan,
  type PageCompatLineEntry,
} from "./pageLineEntries.js";
import type { PageCompatPassPlan } from "./pageRenderTypes.js";

export type PageCompatRuntimeEntry = {
  entry: PageCompatLineEntry;
  renderPlan: LineRenderPlan;
};

export const collectRunnablePageCompatEntries = ({
  compatPass,
  renderedLeafTextKeys,
}: {
  compatPass: PageCompatPassPlan;
  renderedLeafTextKeys: Set<string>;
}): PageCompatRuntimeEntry[] => {
  const runtimeEntries: PageCompatRuntimeEntry[] = [];
  for (const entry of compatPass.lineEntries) {
    const renderPlan = resolveCompatLineEntryRenderPlan(entry, renderedLeafTextKeys);
    if (!renderPlan.shouldRunCompatPass) {
      continue;
    }
    runtimeEntries.push({
      entry,
      renderPlan,
    });
  }
  return runtimeEntries;
};
