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
      (line) => {
        const tableMeta = line?.tableOwnerMeta || line?.tableMeta;
        return (
          line?.blockAttrs?.sliceFromPrev ||
          line?.blockAttrs?.tableSliceFromPrev ||
          tableMeta?.continuedFromPrev
        );
      }
    ),
  hasNext:
    fallback.hasNext === true ||
    sliceLines.some(
      (line) => {
        const tableMeta = line?.tableOwnerMeta || line?.tableMeta;
        return (
          line?.blockAttrs?.sliceHasNext ||
          line?.blockAttrs?.tableSliceHasNext ||
          tableMeta?.continuesAfter
        );
      }
    ),
  rowSplit:
    fallback.rowSplit === true ||
    sliceLines.some(
      (line) => {
        const tableMeta = line?.tableOwnerMeta || line?.tableMeta;
        return (
          line?.blockAttrs?.sliceRowSplit ||
          line?.blockAttrs?.tableRowSplit ||
          tableMeta?.rowSplit
        );
      }
    ),
});
