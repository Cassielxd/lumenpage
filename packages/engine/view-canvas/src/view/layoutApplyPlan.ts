import {
  buildPartialLayoutIndex,
  mergeLayoutIndex,
  resolveStablePageEntryPrefixCount,
} from "./layoutIndex";

type ResolveLayoutIndexApplyPlanArgs = {
  nextLayout: any;
  prevLayout: any;
  prevLayoutIndex: any;
  buildLayoutIndex?: (layout: any, prevLayoutIndex: any, prevLayout: any) => any;
};

export type LayoutIndexApplyPlan = {
  nextLayoutIndex: any;
  partialIndexApplied: boolean;
  stablePrefixPages: number;
};

export const resolveLayoutIndexApplyPlan = ({
  nextLayout,
  prevLayout,
  prevLayoutIndex,
  buildLayoutIndex,
}: ResolveLayoutIndexApplyPlanArgs): LayoutIndexApplyPlan => {
  if (typeof buildLayoutIndex !== "function") {
    return {
      nextLayoutIndex: null,
      partialIndexApplied: false,
      stablePrefixPages: 0,
    };
  }

  const stablePrefixPages =
    prevLayout && prevLayoutIndex
      ? resolveStablePageEntryPrefixCount(nextLayout, prevLayout, prevLayoutIndex)
      : 0;
  const partialIndexApplied = stablePrefixPages > 0;
  const nextLayoutIndex = partialIndexApplied
    ? mergeLayoutIndex(
        prevLayoutIndex,
        buildPartialLayoutIndex(nextLayout, stablePrefixPages, prevLayout, prevLayoutIndex),
        stablePrefixPages
      )
    : buildLayoutIndex(nextLayout, prevLayoutIndex, prevLayout);

  return {
    nextLayoutIndex,
    partialIndexApplied,
    stablePrefixPages,
  };
};
