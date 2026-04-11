export type PageFragmentPassRuntime = {
  renderedLeafTextKeys: Set<string>;
};

export const createPageFragmentPassRuntime = (): PageFragmentPassRuntime => ({
  renderedLeafTextKeys: new Set<string>(),
});

export const resetPageFragmentPassRuntime = (runtime: PageFragmentPassRuntime) => {
  runtime.renderedLeafTextKeys.clear();
};
