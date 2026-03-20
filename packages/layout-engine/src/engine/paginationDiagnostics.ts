export type PaginationSyncDiagnostics = {
  source:
    | "maybe-sync"
    | "same-index-boundary-reuse"
    | "same-index-tail-reuse"
    | "progressive-cutoff"
    | null;
  reason: string | null;
  matchPass: string | null;
  equivalenceStage: string | null;
  expectedBoundaryAnchor: string | null;
  boundaryAnchor: string | null;
  matchedOldPageIndex: number | null;
  candidateCount: number | null;
  candidateIndexes: number[] | null;
  fragmentSignatureKey: string | null;
  signatureKey: string | null;
};

export function createPaginationSyncDiagnostics(
  input: Partial<PaginationSyncDiagnostics> | null | undefined
): PaginationSyncDiagnostics {
  const candidateIndexes = Array.isArray(input?.candidateIndexes)
    ? input.candidateIndexes
        .filter((value) => Number.isFinite(value))
        .map((value) => Number(value))
        .slice(0, 20)
    : null;
  return {
    source: typeof input?.source === "string" ? input.source : null,
    reason: typeof input?.reason === "string" ? input.reason : null,
    matchPass: typeof input?.matchPass === "string" ? input.matchPass : null,
    equivalenceStage: typeof input?.equivalenceStage === "string" ? input.equivalenceStage : null,
    expectedBoundaryAnchor:
      typeof input?.expectedBoundaryAnchor === "string" ? input.expectedBoundaryAnchor : null,
    boundaryAnchor: typeof input?.boundaryAnchor === "string" ? input.boundaryAnchor : null,
    matchedOldPageIndex: Number.isFinite(input?.matchedOldPageIndex)
      ? Number(input?.matchedOldPageIndex)
      : null,
    candidateCount: Number.isFinite(input?.candidateCount)
      ? Number(input?.candidateCount)
      : candidateIndexes?.length ?? null,
    candidateIndexes,
    fragmentSignatureKey:
      typeof input?.fragmentSignatureKey === "string" ? input.fragmentSignatureKey : null,
    signatureKey: typeof input?.signatureKey === "string" ? input.signatureKey : null,
  };
}
