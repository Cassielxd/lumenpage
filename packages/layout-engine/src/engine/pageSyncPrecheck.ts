type MaybeSyncPrecheckOptions = {
  candidateReuseEnabled: boolean;
  canSync: boolean;
  passedChangedRange: boolean;
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
      },
    };
  }

  if (!canSync || !passedChangedRange || !previousLayout) {
    return {
      ok: false as const,
      reason: "precheck-failed" as const,
      perfSnapshot: {
        canSync,
        passedChangedRange,
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

  return {
    ok: true as const,
    oldPage,
  };
}
