import type { PageFragmentPassPlan } from "./pageRenderTypes.js";
import {
  buildLeafTextLineEntryMap,
  isLeafTextExpectedFromFragment,
  type PageLineEntry,
} from "./pageLineEntries.js";
import { getRendererPageFragments } from "./pageRenderFragments.js";

export const createPageFragmentPassPlan = ({
  page,
  lineEntries,
}: {
  page: any;
  lineEntries: PageLineEntry[];
}): PageFragmentPassPlan => ({
  pageFragments: getRendererPageFragments(page),
  leafTextLineEntries: buildLeafTextLineEntryMap(lineEntries),
  fragmentOwnedTextLineEntries: lineEntries.filter((entry) =>
    isLeafTextExpectedFromFragment(entry)
  ),
});
