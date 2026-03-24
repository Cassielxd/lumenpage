export const resolveLayoutRunConfig = ({
  options,
  baseSettingsRaw,
  disablePageReuse,
  perf,
}: {
  options: any;
  baseSettingsRaw: any;
  disablePageReuse: boolean;
  perf: any;
}) => {
  const previousLayout = disablePageReuse ? null : (options?.previousLayout ?? null);
  const changeSummary = disablePageReuse ? null : (options?.changeSummary ?? null);
  const docPosToTextOffset = options?.docPosToTextOffset ?? null;

  const cascadePagination = options?.cascadePagination === true;
  const cascadeFromPageIndex = Number.isFinite(options?.cascadeFromPageIndex)
    ? Math.max(0, Number(options.cascadeFromPageIndex))
    : null;
  const incrementalConfig = baseSettingsRaw?.paginationWorker?.incremental ?? null;
  const cascadeMaxPages =
    cascadePagination && Number.isFinite(incrementalConfig?.maxPages)
      ? Math.max(1, Number(incrementalConfig.maxPages))
      : null;
  const cascadeStopPageIndex =
    cascadePagination && cascadeFromPageIndex !== null && Number.isFinite(cascadeMaxPages)
      ? cascadeFromPageIndex + Number(cascadeMaxPages) - 1
      : null;

  if (perf) {
    perf.disablePageReuse = !!disablePageReuse;
    perf.progressiveTruncated = false;
    perf.optionsPrevPages = options?.previousLayout?.pages?.length ?? 0;
    perf.cascadeMaxPages = cascadeMaxPages;
  }

  return {
    previousLayout,
    changeSummary,
    docPosToTextOffset,
    cascadePagination,
    cascadeFromPageIndex,
    cascadeMaxPages,
    cascadeStopPageIndex,
  };
};
