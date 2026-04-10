import { now } from "./debugTrace";
import {
  isProgressiveLayoutApplied,
  setLayoutChangeSummary,
  setLayoutForceRedraw,
  setLayoutVersion,
} from "./layoutRuntimeMetadata";
import { resolveLayoutIndexApplyPlan } from "./layoutApplyPlan";

type CreateLayoutApplyCoordinatorArgs = {
  getEditorState: () => any;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getLayoutVersion: () => number;
  setLayout: (layout: any) => void;
  setLayoutIndex: (layoutIndex: any) => void;
  buildLayoutIndex?: (layout: any, prevLayoutIndex: any, prevLayout: any) => any;
  spacer: { style: { height: string } };
  clampOffset: (offset: number) => number;
  docPosToTextOffset: (doc: any, pos: number) => number;
  setCaretOffsetValue: (offset: number) => void;
  updateCaret: (updatePreferred: boolean) => void;
  updateStatus: () => void;
  flushPendingScrollIntoView: () => void;
  scheduleRender: () => void;
  emitPerfLog: (type: string, summary: Record<string, unknown>) => void;
  onLayoutApplied?: (layout: any) => void;
};

export const createLayoutApplyCoordinator = ({
  getEditorState,
  getLayout,
  getLayoutIndex,
  getLayoutVersion,
  setLayout,
  setLayoutIndex,
  buildLayoutIndex,
  spacer,
  clampOffset,
  docPosToTextOffset,
  setCaretOffsetValue,
  updateCaret,
  updateStatus,
  flushPendingScrollIntoView,
  scheduleRender,
  emitPerfLog,
  onLayoutApplied,
}: CreateLayoutApplyCoordinatorArgs) => {
  const applyLayout = (
    nextLayout: any,
    version: number,
    changeSummary: any,
    progressiveHint = false
  ) => {
    if (!nextLayout) {
      return;
    }
    if (version < getLayoutVersion()) {
      return;
    }
    const applyStartedAt = now();
    const prevLayout = getLayout?.() ?? null;
    setLayoutVersion(nextLayout, version);
    setLayoutChangeSummary(nextLayout, changeSummary ?? null);
    // Let page-level signatures drive redraws for doc edits; full cache invalidation is only
    // needed for the first layout when no previous page surfaces exist yet.
    setLayoutForceRedraw(nextLayout, !prevLayout);
    const prevLayoutIndex = getLayoutIndex?.() ?? null;
    setLayout(nextLayout);
    const isProgressiveLayout =
      progressiveHint ||
      (changeSummary?.docChanged === true && prevLayout && prevLayout.pages.length > 0);
    const indexBuildStart = now();
    const { nextLayoutIndex, partialIndexApplied, stablePrefixPages } =
      resolveLayoutIndexApplyPlan({
        nextLayout,
        prevLayout,
        prevLayoutIndex,
        buildLayoutIndex,
      });
    if (typeof buildLayoutIndex === "function") {
      setLayoutIndex(nextLayoutIndex);
    }
    const indexBuildMs = now() - indexBuildStart;
    onLayoutApplied?.(nextLayout);
    spacer.style.height = `${nextLayout.totalHeight}px`;
    const latestState = getEditorState();
    const latestCaretOffset = clampOffset(
      docPosToTextOffset(latestState.doc, latestState.selection.head)
    );
    setCaretOffsetValue(latestCaretOffset);
    const caretStartedAt = now();
    updateCaret(true);
    const caretMs = now() - caretStartedAt;
    updateStatus();
    flushPendingScrollIntoView();
    scheduleRender();
    emitPerfLog("layout-apply", {
      layoutVersion: version,
      docChanged: changeSummary?.docChanged === true,
      progressiveHint: isProgressiveLayout,
      progressiveApplied: isProgressiveLayoutApplied(nextLayout),
      prevPages: prevLayout?.pages?.length ?? 0,
      nextPages: nextLayout?.pages?.length ?? 0,
      partialIndexApplied,
      stablePrefixPages,
      indexBuildMs: Math.round(indexBuildMs),
      caretMs: Math.round(caretMs),
      totalApplyMs: Math.round(now() - applyStartedAt),
    });
  };

  return {
    applyLayout,
  };
};
