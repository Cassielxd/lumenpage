type MaybeSyncPrecheckOptions = {
  candidateReuseEnabled: boolean;
  canSync: boolean;
  passedChangedRange: boolean;
  passedChangedFragmentAnchor: boolean;
  passedChangedFragmentBoundary: boolean;
  syncAfterFragmentAnchor: string | null;
  syncAfterNewFragmentAnchor: string | null;
  previousLayout: any;
  pageIndex: number;
};

/**
 * 统一判断当前页是否具备跨页同步的前置条件。
 */
export function resolveMaybeSyncPrecheck({
  candidateReuseEnabled,
  canSync,
  passedChangedRange,
  passedChangedFragmentAnchor,
  passedChangedFragmentBoundary,
  syncAfterFragmentAnchor,
  syncAfterNewFragmentAnchor,
  previousLayout,
  pageIndex,
}: MaybeSyncPrecheckOptions) {
  if (!candidateReuseEnabled) {
    return {
      ok: false as const,
      reason: "candidate-reuse-disabled" as const,
      trace: {
        event: "maybe-sync-skipped" as const,
        reason: "candidate-reuse-disabled" as const,
        pageIndex,
        canSync,
        passedChangedRange,
        passedChangedFragmentAnchor,
        passedChangedFragmentBoundary,
      },
    };
  }

  const useFragmentBoundary = !!syncAfterFragmentAnchor || !!syncAfterNewFragmentAnchor;
  const passedSyncBoundary = useFragmentBoundary
    ? passedChangedFragmentBoundary
    : passedChangedRange;
  if (!canSync || !passedSyncBoundary || !previousLayout) {
    return {
      ok: false as const,
      reason: "precheck-failed" as const,
      perfSnapshot: {
        canSync,
        passedChangedRange,
        passedChangedFragmentAnchor,
        passedChangedFragmentBoundary,
        syncAfterFragmentAnchor,
        syncAfterNewFragmentAnchor,
        passedSyncBoundary,
        useFragmentBoundary,
        hasPrev: !!previousLayout,
      },
    };
  }

  const oldPage = previousLayout.pages?.[pageIndex];
  if (!oldPage) {
    return {
      ok: false as const,
      reason: "old-page-missing" as const,
    };
  }

  const previousPageCount = previousLayout.pages?.length ?? 0;
  if (pageIndex >= previousPageCount - 1) {
    return {
      ok: false as const,
      reason: "old-tail-missing" as const,
    };
  }

  return {
    ok: true as const,
    oldPage,
  };
}
