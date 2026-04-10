type PageRuntimeMetaLike = {
  runtimeMeta?: {
    reused?: boolean;
    sourcePageIndex?: number | null;
    pageOffsetDelta?: number | null;
  } | null;
  __reused?: boolean;
  __sourcePageIndex?: number | null;
  __pageOffsetDelta?: number | null;
};

const readNumber = (value: unknown) => (Number.isFinite(value) ? Number(value) : null);

export const getPageOffsetDelta = (page: PageRuntimeMetaLike | null | undefined) =>
  readNumber(page?.runtimeMeta?.pageOffsetDelta) ?? readNumber(page?.__pageOffsetDelta) ?? 0;

export const isPageReused = (page: PageRuntimeMetaLike | null | undefined) =>
  page?.runtimeMeta?.reused === true || page?.__reused === true;

export const getPageSourcePageIndex = (page: PageRuntimeMetaLike | null | undefined) =>
  readNumber(page?.runtimeMeta?.sourcePageIndex) ?? readNumber(page?.__sourcePageIndex);
