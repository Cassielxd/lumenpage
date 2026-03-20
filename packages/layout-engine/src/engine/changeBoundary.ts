import { pageHasFragmentAnchor } from "./fragmentContinuation";

export function resolveSyncAfterTextOffset(changeSummary: any) {
  const newRange = changeSummary?.newRange;
  if (Number.isFinite(newRange?.to)) {
    return Number(newRange.to);
  }
  if (Number.isFinite(newRange?.from)) {
    return Number(newRange.from);
  }
  return null;
}

export function resolveSyncAfterOldTextOffset(changeSummary: any) {
  const oldRange = changeSummary?.oldRange;
  if (Number.isFinite(oldRange?.to)) {
    return Number(oldRange.to);
  }
  if (Number.isFinite(oldRange?.from)) {
    return Number(oldRange.from);
  }
  return null;
}

export function hasPassedChangedTextBoundary(options: {
  syncAfterTextOffset: number | null;
  textOffset: number | null | undefined;
}) {
  return (
    Number.isFinite(options.syncAfterTextOffset) &&
    Number.isFinite(options.textOffset) &&
    Number(options.textOffset) >= Number(options.syncAfterTextOffset)
  );
}

export function updateChangedBoundaryProgress(session: {
  passedChangedRange: boolean;
  syncAfterTextOffset: number | null;
  textOffset: number | null | undefined;
}) {
  if (session.passedChangedRange) {
    return session.passedChangedRange;
  }
  if (
    hasPassedChangedTextBoundary({
      syncAfterTextOffset: session.syncAfterTextOffset,
      textOffset: session.textOffset,
    })
  ) {
    session.passedChangedRange = true;
  }
  return session.passedChangedRange;
}

export function hasPassedChangedFragmentBoundary(options: {
  page: any;
  passedChangedRange: boolean;
  syncAfterFragmentAnchor: string | null;
  syncAfterNewFragmentAnchor: string | null;
}) {
  const hasOldBoundaryAnchor = pageHasFragmentAnchor(options.page, options.syncAfterFragmentAnchor);
  const hasNewBoundaryAnchor = pageHasFragmentAnchor(options.page, options.syncAfterNewFragmentAnchor);
  if (hasOldBoundaryAnchor || hasNewBoundaryAnchor) {
    return true;
  }
  if (!options.syncAfterFragmentAnchor && !options.syncAfterNewFragmentAnchor) {
    return options.passedChangedRange;
  }
  return false;
}

export function updateFragmentBoundaryProgress(session: {
  page: any;
  passedChangedRange: boolean;
  passedChangedFragmentBoundary: boolean;
  syncAfterFragmentAnchor: string | null;
  syncAfterNewFragmentAnchor: string | null;
}) {
  if (session.passedChangedFragmentBoundary) {
    return true;
  }
  if (
    hasPassedChangedFragmentBoundary({
      page: session.page,
      passedChangedRange: session.passedChangedRange,
      syncAfterFragmentAnchor: session.syncAfterFragmentAnchor,
      syncAfterNewFragmentAnchor: session.syncAfterNewFragmentAnchor,
    })
  ) {
    session.passedChangedFragmentBoundary = true;
  }
  return session.passedChangedFragmentBoundary;
}
