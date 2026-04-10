import { finalizeLayoutPages } from "./layoutFinalization";
import { finalizeLayoutPerf } from "./perfSummary";
import { materializeLayoutGeometry } from "../pageGeometry";
import {
  setLayoutGhostTrace,
  setLayoutPaginationDiagnostics,
  setLayoutPerfSummary,
  setProgressiveLayoutState,
} from "../runtimeMetadata";
import { getLayoutSettingsPerfSummary, setLayoutSettingsPerfSummary } from "../settingsRuntimeState";

export const completeLayoutRun = ({
  session,
  pageHeight,
  pageGap,
  pageWidth,
  margin,
  lineHeight,
  font,
  previousLayout,
  changeSummary,
  offsetDelta,
  appendGhostTrace,
  ghostTrace,
  perf,
  now,
  baseSettingsRaw,
  resumeAnchorPageIndex,
  resumeAnchorLineIndex,
  resumeAnchorMatchKey,
  resumeAnchorSkippedReason,
  reusedPrefixPages,
  reusedPrefixLines,
  logLayout,
}: {
  session: any;
  pageHeight: number;
  pageGap: number;
  pageWidth: number;
  margin: any;
  lineHeight: number;
  font: string;
  previousLayout: any;
  changeSummary: any;
  offsetDelta: number;
  appendGhostTrace: (ghostTrace: any[] | null, event: any) => void;
  ghostTrace: any[] | null;
  perf: any;
  now: () => number;
  baseSettingsRaw: any;
  resumeAnchorPageIndex: number | null;
  resumeAnchorLineIndex: number | null;
  resumeAnchorMatchKey: string | null;
  resumeAnchorSkippedReason: string | null;
  reusedPrefixPages: number;
  reusedPrefixLines: number;
  logLayout: (...args: any[]) => void;
}) => {
  const finalPages = finalizeLayoutPages({
    pages: session.pages,
    shouldStop: session.shouldStop,
    previousLayout,
    syncFromIndex: session.syncFromIndex,
    syncMatchPass: session.syncMatchPass,
    syncDiagnostics: session.syncDiagnostics,
    offsetDelta,
    appendGhostTrace,
    ghostTrace,
  });
  session.pages = finalPages.pages;
  // Finalize box/fragment geometry at the layout boundary so view/runtime consumers
  // can treat page geometry as stable output instead of rebuilding it during render.
  materializeLayoutGeometry({ pages: session.pages });
  if (perf) {
    perf.reusedPages = finalPages.reusedTailCount;
  }

  const totalHeight =
    session.pages.length * pageHeight + Math.max(0, session.pages.length - 1) * pageGap;

  if (perf) {
    const summary = finalizeLayoutPerf({
      perf,
      now,
      pages: session.pages,
      previousLayout,
      changeSummary,
      syncAfterIndex: session.syncAfterIndex,
      syncAfterTextOffset: session.syncAfterTextOffset,
      syncAfterOldTextOffset: session.syncAfterOldTextOffset,
      syncAfterNewFragmentAnchor: session.syncAfterNewFragmentAnchor,
      canSync: session.canSync,
      passedChangedRange: session.passedChangedRange,
      passedChangedFragmentBoundary: session.passedChangedFragmentBoundary,
      syncFromIndex: session.syncFromIndex,
      syncMatchPass: session.syncMatchPass,
      syncDiagnostics: session.syncDiagnostics,
      resumeFromAnchor: session.resumeFromAnchor,
      resumeAnchorPageIndex,
      resumeAnchorLineIndex,
      resumeAnchorMatchKey,
      resumeAnchorSkippedReason,
      reusedPrefixPages,
      reusedPrefixLines,
    });
    setLayoutSettingsPerfSummary(baseSettingsRaw, summary);
    logLayout(`[layout-engine] perf:`, summary);
  }

  logLayout(
    `[layout-engine] DONE pages:${session.pages.length}, progressiveApplied:${session.progressiveApplied}, prevPages:${previousLayout?.pages?.length ?? 0}`
  );

  const layout: any = {
    pages: session.pages,
    pageHeight,
    pageWidth,
    pageGap,
    margin,
    lineHeight,
    font,
    totalHeight,
  };
  setProgressiveLayoutState(layout, {
    applied: session.progressiveApplied,
    truncated: session.progressiveTruncated,
  });
  setLayoutPaginationDiagnostics(layout, {
    sync: session.syncDiagnostics ?? null,
    resumeAnchor: {
      applied: session.resumeFromAnchor,
      pageIndex: resumeAnchorPageIndex,
      lineIndex: resumeAnchorLineIndex,
      matchKey: resumeAnchorMatchKey,
      skippedReason: resumeAnchorSkippedReason,
    },
  });
  setLayoutGhostTrace(layout, ghostTrace);
  const layoutPerfSummary = getLayoutSettingsPerfSummary(baseSettingsRaw);
  if (perf && layoutPerfSummary) {
    setLayoutPerfSummary(layout, layoutPerfSummary);
  }
  return layout;
};
