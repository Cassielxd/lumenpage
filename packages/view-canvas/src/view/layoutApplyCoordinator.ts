import { now } from "./debugTrace";

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
  const applyLayout = (nextLayout: any, version: number, changeSummary: any, skipIndexBuild = false) => {
    if (!nextLayout) {
      return;
    }
    if (version < getLayoutVersion()) {
      return;
    }
    const applyStartedAt = now();
    const prevLayout = getLayout?.() ?? null;
    nextLayout.__version = version;
    nextLayout.__changeSummary = changeSummary ?? null;
    nextLayout.__forceRedraw = !prevLayout || changeSummary?.docChanged === true;
    const prevLayoutIndex = getLayoutIndex?.() ?? null;
    setLayout(nextLayout);
    const isProgressiveLayout =
      skipIndexBuild ||
      (changeSummary?.docChanged === true && prevLayout && prevLayout.pages.length > 0);
    const indexBuildStart = now();
    if (typeof buildLayoutIndex === "function") {
      setLayoutIndex(buildLayoutIndex(nextLayout, prevLayoutIndex, prevLayout));
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
      progressiveApplied: nextLayout?.__progressiveApplied === true,
      prevPages: prevLayout?.pages?.length ?? 0,
      nextPages: nextLayout?.pages?.length ?? 0,
      indexBuildMs: Math.round(indexBuildMs),
      caretMs: Math.round(caretMs),
      totalApplyMs: Math.round(now() - applyStartedAt),
    });
  };

  return {
    applyLayout,
  };
};
