import type { PageCompatLineEntry, PageLineEntry } from "./pageLineEntries.js";

export type DefaultRender = (line: any, pageX: number, pageTop: number, layout: any) => void;

export type PageFragmentPassPlan = {
  pageFragments: any[];
  leafTextLineEntries: Map<string, PageLineEntry>;
  fragmentOwnedTextLineEntries: PageLineEntry[];
};

export type PageCompatPassPlan = {
  lineEntries: PageCompatLineEntry[];
};

export type PageRenderPasses = {
  fragmentPass: PageFragmentPassPlan;
  compatPass: PageCompatPassPlan;
};
