import { createPageBoxCollector, type PageBoxCollector } from "../pageBoxes";
import { finalizeCurrentPage } from "./pageLifecycleFinalization";
import { maybeSyncCurrentPage } from "./pageLifecycleSync";

export type LayoutPaginationSession = {
  pages: any[];
  pageIndex: number;
  page: any;
  pageBoxCollector: PageBoxCollector;
  cursorY: number;
  textOffset: number;
  startBlockIndex: number;
  syncAfterIndex: number | null;
  canSync: boolean;
  passedChangedRange: boolean;
  shouldStop: boolean;
  syncFromIndex: number | null;
  progressiveApplied: boolean;
  progressiveTruncated: boolean;
  resumeFromAnchor: boolean;
  resumeAnchorApplied: boolean;
  resumeAnchorTargetY: { y: number; relativeY: number } | null;
};

export const createLayoutPageLifecycle = ({
  session,
  perf,
  previousLayout,
  previousPageReuseIndex,
  previousPageFirstBlockIdIndex,
  previousPageSignatureIndex,
  offsetDelta,
  appendGhostTrace,
  ghostTrace,
  logLayout,
  candidateReuseEnabled,
  pageReuseProbeRadius,
  pageReuseRootIndexProbeRadius,
  cascadePagination,
  cascadeFromPageIndex,
  cascadeStopPageIndex,
  marginTop,
}: {
  session: LayoutPaginationSession;
  perf: any;
  previousLayout: any;
  previousPageReuseIndex: any;
  previousPageFirstBlockIdIndex: Map<string, number[]> | null;
  previousPageSignatureIndex: Map<string, number[]> | null;
  offsetDelta: number;
  appendGhostTrace: (ghostTrace: any[] | null, event: any) => void;
  ghostTrace: any[] | null;
  logLayout: (...args: any[]) => void;
  candidateReuseEnabled: boolean;
  pageReuseProbeRadius: number | null | undefined;
  pageReuseRootIndexProbeRadius: number | null | undefined;
  cascadePagination: boolean;
  cascadeFromPageIndex: number | null;
  cascadeStopPageIndex: number | null;
  marginTop: number;
}) => {
  const syncCurrentPageBoxes = () => {
    session.page.boxes = session.pageBoxCollector.finalize();
    return session.page.boxes;
  };

  const setCurrentPage = (nextPage: any, seedLines: any[] | null = null) => {
    session.page = nextPage;
    if (Array.isArray(seedLines)) {
      session.page.lines = seedLines;
    }
    session.pageBoxCollector = createPageBoxCollector();
    const lines = Array.isArray(session.page?.lines) ? session.page.lines : [];
    for (const line of lines) {
      session.pageBoxCollector.consumeLine(line);
    }
  };

  const maybeSync = () =>
    maybeSyncCurrentPage({
      session,
      perf,
      previousLayout,
      previousPageReuseIndex,
      previousPageFirstBlockIdIndex,
      previousPageSignatureIndex,
      offsetDelta,
      appendGhostTrace,
      ghostTrace,
      logLayout,
      candidateReuseEnabled,
      pageReuseProbeRadius,
      pageReuseRootIndexProbeRadius,
    });

  const finalizePage = () =>
    finalizeCurrentPage({
      session,
      perf,
      previousLayout,
      offsetDelta,
      appendGhostTrace,
      ghostTrace,
      syncCurrentPageBoxes,
      maybeSync,
      setCurrentPage,
      cascadePagination,
      cascadeFromPageIndex,
      cascadeStopPageIndex,
      marginTop,
    });

  return {
    syncCurrentPageBoxes,
    setCurrentPage,
    maybeSync,
    finalizePage,
  };
};
