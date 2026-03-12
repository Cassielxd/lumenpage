export type SliceContinuationFallback = {
  fromPrev?: boolean;
  hasNext?: boolean;
  rowSplit?: boolean;
};

export const readSliceContinuation = (
  sliceLines,
  fallback: SliceContinuationFallback = {}
) => ({
  fromPrev:
    fallback.fromPrev === true ||
    sliceLines.some(
      (line) =>
        line?.blockAttrs?.sliceFromPrev ||
        line?.blockAttrs?.tableSliceFromPrev ||
        line?.tableMeta?.continuedFromPrev
    ),
  hasNext:
    fallback.hasNext === true ||
    sliceLines.some(
      (line) =>
        line?.blockAttrs?.sliceHasNext ||
        line?.blockAttrs?.tableSliceHasNext ||
        line?.tableMeta?.continuesAfter
    ),
  rowSplit:
    fallback.rowSplit === true ||
    sliceLines.some(
      (line) =>
        line?.blockAttrs?.sliceRowSplit ||
        line?.blockAttrs?.tableRowSplit ||
        line?.tableMeta?.rowSplit
    ),
});
