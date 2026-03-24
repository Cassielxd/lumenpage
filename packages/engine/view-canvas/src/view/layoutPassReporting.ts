import { emitGhostTrace, now } from "./debugTrace";

export const applyResolvedLayoutAndReport = ({
  layout,
  source = "sync",
  computeMs = null,
  version,
  doc,
  passStartedAt,
  changeSummary,
  isLayoutProgressive,
  docChanged,
  settingsChanged,
  useCascadePagination,
  cascadeFromPageIndex,
  preferSyncIncrementalPass,
  canUseWorkerProvider,
  canUseWorker,
  workerIneligibleReason,
  prevLayout,
  getEditorState,
  emitPerfLog,
  onApplyLayout,
  layoutPipeline,
  progressiveLayoutController,
  incrementalEnabled,
  settleDelayMs,
  layoutSettingsSignature,
  setLastLayoutSettingsSignature,
}: {
  layout: any;
  source?: string;
  computeMs?: number | null;
  version: number;
  doc: any;
  passStartedAt: number;
  changeSummary: any;
  isLayoutProgressive: any;
  docChanged: boolean;
  settingsChanged: boolean;
  useCascadePagination: boolean;
  cascadeFromPageIndex: number | null;
  preferSyncIncrementalPass: boolean;
  canUseWorkerProvider: boolean;
  canUseWorker: boolean;
  workerIneligibleReason: string | null;
  prevLayout: any;
  getEditorState: () => any;
  emitPerfLog: (type: string, summary: Record<string, unknown>) => void;
  onApplyLayout: (args: {
    layout: any;
    version: number;
    changeSummary: any;
    isLayoutProgressive: boolean;
  }) => void;
  layoutPipeline: any;
  progressiveLayoutController: any;
  incrementalEnabled: boolean;
  settleDelayMs: number;
  layoutSettingsSignature: string;
  setLastLayoutSettingsSignature: (value: string) => void;
}) => {
  if (getEditorState()?.doc !== doc) {
    emitPerfLog("layout-pass", {
      layoutVersion: version,
      source,
      discarded: true,
      docChanged,
      settingsChanged,
      useCascadePagination,
      cascadeFromPageIndex,
      computeMs: computeMs == null ? null : Math.round(computeMs),
      totalPassMs: Math.round(now() - passStartedAt),
    });
    return;
  }

  setLastLayoutSettingsSignature(layoutSettingsSignature);
  const applyStartedAt = now();
  onApplyLayout({
    layout,
    version,
    changeSummary,
    isLayoutProgressive,
  });
  const layoutPerf = layout?.__layoutPerfSummary ?? layoutPipeline?.settings?.__perf?.layout ?? null;
  const workerDebug = layout?.__workerDebug ?? null;

  emitPerfLog("layout-pass", {
    layoutVersion: version,
    source,
    discarded: false,
    docChanged,
    settingsChanged,
    useCascadePagination,
    cascadeFromPageIndex,
    preferSyncIncrementalPass,
    usedWorkerProvider: canUseWorkerProvider,
    usedWorker: canUseWorker,
    workerIneligibleReason,
    computeMs: computeMs == null ? null : Math.round(computeMs),
    applyMs: Math.round(now() - applyStartedAt),
    totalPassMs: Math.round(now() - passStartedAt),
    prevPages: prevLayout?.pages?.length ?? 0,
    nextPages: layout?.pages?.length ?? 0,
    progressiveApplied: layout?.__progressiveApplied === true,
    progressiveTruncated: layout?.__progressiveTruncated === true,
    reusedPages: layoutPerf?.reusedPages ?? null,
    reuseReason: layoutPerf?.reuseReason ?? null,
    disablePageReuse: layoutPerf?.disablePageReuse ?? null,
    maybeSyncReason: layoutPerf?.maybeSyncReason ?? null,
    cascadeMaxPages: layoutPerf?.cascadeMaxPages ?? null,
    syncAfterIndex: layoutPerf?.syncAfterIndex ?? null,
    syncFromIndex: layoutPerf?.syncFromIndex ?? null,
    resumeFromAnchor: layoutPerf?.resumeFromAnchor ?? null,
    resumeAnchorPageIndex: layoutPerf?.resumeAnchorPageIndex ?? null,
    resumeAnchorLineIndex: layoutPerf?.resumeAnchorLineIndex ?? null,
    resumeAnchorMatchKey: layoutPerf?.resumeAnchorMatchKey ?? null,
    resumeAnchorSkippedReason: layoutPerf?.resumeAnchorSkippedReason ?? null,
    reusedPrefixPages: layoutPerf?.reusedPrefixPages ?? null,
    reusedPrefixLines: layoutPerf?.reusedPrefixLines ?? null,
    blockCacheHitRate: layoutPerf?.blockCacheHitRate ?? null,
    breakLinesMs: layoutPerf?.breakLinesMs ?? null,
    layoutLeafMs: layoutPerf?.layoutLeafMs ?? null,
    clientHadSeedLayout: workerDebug?.clientHadSeedLayout ?? null,
    clientSentSeedLayout: workerDebug?.clientSentSeedLayout ?? null,
    clientSettingsChanged: workerDebug?.clientSettingsChanged ?? null,
    clientPrevPages: workerDebug?.clientPrevPages ?? null,
    workerHadPreviousLayoutState: workerDebug?.workerHadPreviousLayoutState ?? null,
    workerPrevPagesBeforeSeed: workerDebug?.workerPrevPagesBeforeSeed ?? null,
    workerPrevPagesAfterSeed: workerDebug?.workerPrevPagesAfterSeed ?? null,
  });

  emitGhostTrace(
    "layout-pass",
    {
      layoutVersion: version,
      source,
      docChanged,
      settingsChanged,
      useCascadePagination,
      cascadeFromPageIndex,
      prevPages: prevLayout?.pages?.length ?? 0,
      nextPages: layout?.pages?.length ?? 0,
      progressiveApplied: layout?.__progressiveApplied === true,
      progressiveTruncated: layout?.__progressiveTruncated === true,
      reusedPages: layoutPerf?.reusedPages ?? null,
      reuseReason: layoutPerf?.reuseReason ?? null,
      disablePageReuse: layoutPerf?.disablePageReuse ?? null,
      maybeSyncReason: layoutPerf?.maybeSyncReason ?? null,
      syncAfterIndex: layoutPerf?.syncAfterIndex ?? null,
      syncFromIndex: layoutPerf?.syncFromIndex ?? null,
      resumeFromAnchor: layoutPerf?.resumeFromAnchor ?? null,
      resumeAnchorPageIndex: layoutPerf?.resumeAnchorPageIndex ?? null,
      resumeAnchorLineIndex: layoutPerf?.resumeAnchorLineIndex ?? null,
      resumeAnchorMatchKey: layoutPerf?.resumeAnchorMatchKey ?? null,
      resumeAnchorSkippedReason: layoutPerf?.resumeAnchorSkippedReason ?? null,
      reusedPrefixPages: layoutPerf?.reusedPrefixPages ?? null,
      reusedPrefixLines: layoutPerf?.reusedPrefixLines ?? null,
      ghostTrace: Array.isArray(layout?.__ghostTrace) ? layout.__ghostTrace : [],
    },
    layoutPipeline?.settings
  );

  progressiveLayoutController.onLayoutApplied({
    layout,
    prevLayout,
    incrementalEnabled,
    settleDelayMs,
  });
};
