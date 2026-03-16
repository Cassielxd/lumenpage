export const createLayoutInstrumentation = ({
  baseSettingsRaw,
  now,
}: {
  baseSettingsRaw: any;
  now: () => number;
}) => {
  const debugPerf = !!baseSettingsRaw?.debugPerf;
  const logLayout = (..._args: any[]) => {};
  const perf = debugPerf
    ? {
        start: now(),
        blocks: 0,
        cachedBlocks: 0,
        lines: 0,
        pages: 0,
        measureCalls: 0,
        measureChars: 0,
        reusedPages: 0,
        breakLinesMs: 0,
        layoutLeafMs: 0,
        reuseReason: "unknown",
        syncAfterIndex: null,
        canSync: false,
        passedChangedRange: false,
        syncFromIndex: null,
        resumeFromAnchor: false,
        resumeAnchorPageIndex: null,
        resumeAnchorLineIndex: null,
        resumeAnchorMatchKey: null,
        resumeAnchorSkippedReason: null,
        reusedPrefixPages: 0,
        reusedPrefixLines: 0,
        maybeSyncReason: "unknown",
        disablePageReuse: false,
        progressiveTruncated: false,
        cascadeMaxPages: null,
        optionsPrevPages: 0,
        maybeSyncCalled: false,
        maybeSyncFailSnapshot: null,
      }
    : null;

  const baseMeasure = baseSettingsRaw.measureTextWidth;
  const measureTextWidth = debugPerf
    ? (font: string, text: string) => {
        perf.measureCalls += 1;
        perf.measureChars += text ? text.length : 0;
        return baseMeasure(font, text);
      }
    : baseMeasure;

  return {
    debugPerf,
    logLayout,
    perf,
    measureTextWidth,
    baseSettings: debugPerf ? { ...baseSettingsRaw, measureTextWidth } : baseSettingsRaw,
  };
};
