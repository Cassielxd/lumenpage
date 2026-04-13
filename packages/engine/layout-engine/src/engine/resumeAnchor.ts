import { findBlockAnchor, findBlockFirstOccurrence, getAnchorMatch, getDocChildStartPos } from "./anchors.js";
import {
  hasPassedChangedTextBoundary,
  resolveSyncAfterOldTextOffset,
  resolveSyncAfterTextOffset,
} from "./changeBoundary.js";
import { findFirstFragmentAnchorAfterBoundary } from "./fragmentContinuation.js";

type ResolveResumeAnchorPlanOptions = {
  enabled: boolean;
  previousLayout: any;
  changeSummary: any;
  doc: any;
  docPosToTextOffset: ((doc: any, pos: number) => number) | null;
  pageHeight: number;
  pageWidth: number;
  pageGap: number;
  lineHeight: number;
  margin: { left: number; right: number; top: number; bottom: number };
};

/**
 * 计算增量布局是否可以从旧布局中的锚点直接恢复，并返回恢复计划。
 */
export function resolveResumeAnchorPlan({
  enabled,
  previousLayout,
  changeSummary,
  doc,
  docPosToTextOffset,
  pageHeight,
  pageWidth,
  pageGap,
  lineHeight,
  margin,
}: ResolveResumeAnchorPlanOptions) {
  if (
    !enabled ||
    !previousLayout ||
    changeSummary?.docChanged !== true ||
    typeof docPosToTextOffset !== "function"
  ) {
    return null;
  }

  const settingsMatch =
    previousLayout.pageHeight === pageHeight &&
    previousLayout.pageWidth === pageWidth &&
    previousLayout.pageGap === pageGap &&
    previousLayout.lineHeight === lineHeight &&
    previousLayout.margin?.left === margin.left &&
    previousLayout.margin?.right === margin.right &&
    previousLayout.margin?.top === margin.top &&
    previousLayout.margin?.bottom === margin.bottom;

  if (!settingsMatch || !previousLayout.pages?.length) {
    return null;
  }

  const before = changeSummary.blocks?.before || {};
  const after = changeSummary.blocks?.after || {};
  const oldRange = changeSummary.oldRange || {};
  const startIndexOld = Number.isFinite(before.fromIndex) ? before.fromIndex : null;
  const startIndexNew = Number.isFinite(after.fromIndex)
    ? after.fromIndex
    : Number.isFinite(startIndexOld)
      ? startIndexOld
      : null;
  const lastIndexNew = Number.isFinite(after.toIndex)
    ? after.toIndex
    : Number.isFinite(after.fromIndex)
      ? after.fromIndex
      : Number.isFinite(before.toIndex)
        ? before.toIndex
        : Number.isFinite(before.fromIndex)
          ? before.fromIndex
          : null;

  if (
    !Number.isFinite(startIndexOld) ||
    !Number.isFinite(startIndexNew) ||
    startIndexNew >= doc.childCount
  ) {
    return null;
  }

  const blockPos = getDocChildStartPos(doc, startIndexNew);
  const startOffset = docPosToTextOffset(doc, blockPos);
  const blockNode = doc.child(startIndexNew);
  const blockId = blockNode?.attrs?.id ?? null;
  const anchor = findBlockAnchor(previousLayout, {
    rootIndex: startIndexOld,
    blockId,
    blockStart: startOffset,
  });

  if (!anchor) {
    return {
      startIndexOld,
      startIndexNew,
      lastIndexNew,
      startOffset,
      blockId,
      anchorFound: false,
    };
  }

  const firstOccurrence = findBlockFirstOccurrence(previousLayout, {
    rootIndex: startIndexOld,
    blockId,
    blockStart: startOffset,
  });
  const anchorRef = firstOccurrence || anchor;
  const anchorPage = previousLayout.pages[anchorRef.pageIndex];
  const anchorLines = anchorPage?.lines || [];
  let anchorLineIndex = anchorRef.lineIndex;
  if (anchorLines.length > 0) {
    const matchIndex = anchorLines.findIndex((line) => {
      const match = getAnchorMatch(line, {
        rootIndex: startIndexOld,
        blockId,
        blockStart: startOffset,
      });
      return !!match && match.score >= (anchorRef.match?.score || 0);
    });
    if (matchIndex >= 0) {
      anchorLineIndex = matchIndex;
    }
  }

  const anchorMatch = anchorRef.match || anchor.match || null;
  const canResumeAnchor = anchorLineIndex === 0 && anchorMatch?.blockIdMatches === true;
  const skippedReason = canResumeAnchor
    ? null
    : anchorLineIndex !== 0
      ? "anchor-not-at-page-start"
      : "anchor-missing-block-id-match";

  if (!canResumeAnchor) {
    return {
      startIndexOld,
      startIndexNew,
      lastIndexNew,
      startOffset,
      blockId,
      anchorFound: true,
      anchorPageIndex: anchorRef.pageIndex,
      anchorLineIndex,
      anchorMatchKey: anchorMatch?.matchKey || null,
      blockIdMatches: anchorMatch?.blockIdMatches === true,
      blockStartMatches: anchorMatch?.blockStartMatches === true,
      rootIndexMatches: anchorMatch?.rootIndexMatches === true,
      canResumeAnchor,
      skippedReason,
    };
  }

  const anchorLine = anchorLines[anchorLineIndex] || anchorRef.line;
  const reusedLines = anchorLines.slice(0, anchorLineIndex);
  const anchorY = Number.isFinite(anchorLine?.y) ? anchorLine.y : margin.top;
  const anchorRelativeY = Number.isFinite(anchorLine?.relativeY) ? anchorLine.relativeY : 0;
  const syncAfterIndex = Number.isFinite(lastIndexNew) ? Number(lastIndexNew) : null;
  const syncAfterTextOffset = resolveSyncAfterTextOffset(changeSummary);
  const syncAfterOldTextOffset = resolveSyncAfterOldTextOffset(changeSummary);
  const syncAfterOldIndex = Number.isFinite(before.toIndex)
    ? Number(before.toIndex)
    : Number.isFinite(before.fromIndex)
      ? Number(before.fromIndex)
      : null;
  const syncAfterFragmentAnchorRef = findFirstFragmentAnchorAfterBoundary(previousLayout, {
    textOffset: syncAfterOldTextOffset,
    rootIndex: syncAfterOldIndex,
  });
  const syncAfterFragmentAnchor = syncAfterFragmentAnchorRef?.anchor ?? null;
  const syncAfterFragmentPageIndex = Number.isFinite(syncAfterFragmentAnchorRef?.pageIndex)
    ? Number(syncAfterFragmentAnchorRef.pageIndex)
    : null;
  const canSync =
    Number.isFinite(syncAfterIndex) ||
    Number.isFinite(syncAfterTextOffset) ||
    Number.isFinite(syncAfterOldTextOffset) ||
    !!syncAfterFragmentAnchor;
  const passedChangedFragmentAnchor =
    !!syncAfterFragmentAnchor &&
    syncAfterFragmentPageIndex != null &&
    anchorRef.pageIndex > syncAfterFragmentPageIndex;
  const passedChangedRange = hasPassedChangedTextBoundary({
    syncAfterTextOffset,
    textOffset: startOffset,
  });
  const passedChangedFragmentBoundary =
    passedChangedFragmentAnchor || (!syncAfterFragmentAnchor && passedChangedRange);

  return {
    startIndexOld,
    startIndexNew,
    lastIndexNew,
    startOffset,
    blockId,
    anchorFound: true,
    anchorPageIndex: anchorRef.pageIndex,
    anchorLineIndex,
    anchorMatchKey: anchorMatch?.matchKey || null,
    blockIdMatches: anchorMatch?.blockIdMatches === true,
    blockStartMatches: anchorMatch?.blockStartMatches === true,
    rootIndexMatches: anchorMatch?.rootIndexMatches === true,
    canResumeAnchor,
    skippedReason,
    reusedPrefixPages: anchorRef.pageIndex,
    reusedPrefixLines: reusedLines.length,
    reusedLines,
    pageIndex: anchorRef.pageIndex,
    anchorTargetY: { y: anchorY, relativeY: anchorRelativeY },
    textOffset: Number.isFinite(startOffset) ? Number(startOffset) : 0,
    startBlockIndex: startIndexNew,
    syncAfterIndex,
    syncAfterTextOffset,
    syncAfterOldTextOffset,
    syncAfterFragmentAnchor,
    syncAfterFragmentPageIndex,
    canSync,
    passedChangedRange,
    passedChangedFragmentAnchor,
    passedChangedFragmentBoundary,
  };
}
