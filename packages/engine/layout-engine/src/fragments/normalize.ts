export type LayoutSplitContinuation = {
  fromPrev?: boolean;
  hasNext?: boolean;
  rowSplit?: boolean;
};

export type LayoutSplitFragment = {
  kind: "visible" | "overflow";
  lines: any[];
  length: number;
  height: number;
  continuation?: LayoutSplitContinuation | null;
};

export type NormalizedSplitFragments = {
  visible: LayoutSplitFragment;
  overflow: LayoutSplitFragment | null;
};

type NormalizeSplitFragmentsOptions = {
  fallbackLineHeight: number;
  expectedLength?: number | null;
  measureLinesHeight: (lines: any[], fallbackLineHeight: number) => number;
};

type CreateAutoSplitResultOptions = {
  remainingLength: number;
  availableHeight: number;
  lineHeightValue: number;
  getFittableLineCount: (lines: any[], availableHeight: number, fallbackLineHeight: number) => number;
  measureLinesHeight: (lines: any[], fallbackLineHeight: number) => number;
  normalizeChunkRelativeY: (lines: any[]) => any[];
};

type LegacySplitResult = {
  lines?: any[];
  length?: number;
  height?: number;
  continuation?: LayoutSplitContinuation | null;
  overflow?: {
    lines?: any[];
    length?: number;
    height?: number;
    continuation?: LayoutSplitContinuation | null;
  } | null;
  fragments?: Array<{
    kind?: "visible" | "overflow";
    lines?: any[];
    length?: number;
    height?: number;
    continuation?: LayoutSplitContinuation | null;
  }> | null;
};

export const inferFragmentLengthFromLines = (lines: any[]) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    if (Number.isFinite(line?.start)) {
      minStart = Math.min(minStart, Number(line.start));
    }
    if (Number.isFinite(line?.end)) {
      maxEnd = Math.max(maxEnd, Number(line.end));
    }
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    return 0;
  }
  return Math.max(0, maxEnd - minStart);
};

const normalizeSplitFragment = (
  fragment: any,
  fallbackLineHeight: number,
  fallbackKind: "visible" | "overflow",
  measureLinesHeight: (lines: any[], fallbackLineHeight: number) => number
): LayoutSplitFragment => {
  const lines = Array.isArray(fragment?.lines) ? fragment.lines : [];
  const inferredLength = inferFragmentLengthFromLines(lines);
  const rawLength = Number(fragment?.length);
  let length = Number.isFinite(rawLength) ? Math.max(0, rawLength) : inferredLength;
  if (inferredLength > 0 && (!Number.isFinite(rawLength) || rawLength <= 0)) {
    length = inferredLength;
  }
  const rawHeight = Number(fragment?.height);
  const height =
    Number.isFinite(rawHeight) && rawHeight >= 0
      ? rawHeight
      : measureLinesHeight(lines, fallbackLineHeight);
  const continuation =
    fragment?.continuation && typeof fragment.continuation === "object"
      ? fragment.continuation
      : null;
  const kind =
    fragment?.kind === "visible" || fragment?.kind === "overflow"
      ? fragment.kind
      : fallbackKind;
  return {
    kind,
    lines,
    length,
    height,
    continuation,
  };
};

const buildLegacySplitFragments = (splitResult: LegacySplitResult) => {
  if (!splitResult || !Array.isArray(splitResult.lines)) {
    return [];
  }
  const fragments = [
    {
      kind: "visible",
      lines: splitResult.lines,
      length: splitResult.length,
      height: splitResult.height,
      continuation: splitResult?.continuation ?? null,
    },
  ];
  const overflow = splitResult.overflow;
  if (
    overflow &&
    (Array.isArray(overflow.lines) ||
      Number.isFinite(overflow.length) ||
      Number.isFinite(overflow.height))
  ) {
    fragments.push({
      kind: "overflow",
      lines: Array.isArray(overflow.lines) ? overflow.lines : [],
      length: overflow.length,
      height: overflow.height,
      continuation: overflow.continuation,
    });
  }
  return fragments;
};

const combineOverflowFragments = (
  fragments: LayoutSplitFragment[],
  fallbackLineHeight: number,
  measureLinesHeight: (lines: any[], fallbackLineHeight: number) => number
): LayoutSplitFragment | null => {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    return null;
  }
  if (fragments.length === 1) {
    return fragments[0];
  }
  const lines = [];
  let length = 0;
  let height = 0;
  let continuation = null;
  for (const fragment of fragments) {
    if (Array.isArray(fragment.lines) && fragment.lines.length > 0) {
      lines.push(...fragment.lines);
    }
    length += Number.isFinite(fragment.length) ? Math.max(0, fragment.length) : 0;
    height += Number.isFinite(fragment.height)
      ? Math.max(0, fragment.height)
      : measureLinesHeight(fragment.lines, fallbackLineHeight);
    if (!continuation && fragment.continuation) {
      continuation = fragment.continuation;
    }
  }
  return {
    kind: "overflow",
    lines,
    length,
    height,
    continuation,
  };
};

export const normalizeSplitFragments = (
  splitResult: LegacySplitResult | null | undefined,
  options: NormalizeSplitFragmentsOptions
): NormalizedSplitFragments | null => {
  if (!splitResult) {
    return null;
  }
  const { fallbackLineHeight, expectedLength, measureLinesHeight } = options;
  const sourceFragments =
    Array.isArray(splitResult.fragments) && splitResult.fragments.length > 0
      ? splitResult.fragments
      : buildLegacySplitFragments(splitResult);
  if (!Array.isArray(sourceFragments) || sourceFragments.length === 0) {
    return null;
  }

  const normalized = sourceFragments.map((fragment, index) =>
    normalizeSplitFragment(
      fragment,
      fallbackLineHeight,
      index === 0 ? "visible" : "overflow",
      measureLinesHeight
    )
  );

  const visible = { ...normalized[0], kind: "visible" as const };
  const overflowFragments = normalized.slice(1).map((fragment) => ({
    ...fragment,
    kind: "overflow" as const,
  }));
  let overflow = combineOverflowFragments(overflowFragments, fallbackLineHeight, measureLinesHeight);

  if (Number.isFinite(expectedLength) && Number(expectedLength) >= 0) {
    const expected = Number(expectedLength);
    if (visible.length > expected) {
      visible.length = expected;
    }
    if (overflow) {
      const overflowMax = Math.max(0, expected - visible.length);
      if (!Number.isFinite(overflow.length) || overflow.length > overflowMax) {
        overflow.length = overflowMax;
      }
      if (overflow.lines.length > 0 && overflow.length === 0) {
        const inferredOverflowLength = inferFragmentLengthFromLines(overflow.lines);
        overflow.length = Math.min(
          overflowMax,
          inferredOverflowLength > 0 ? inferredOverflowLength : overflowMax
        );
      }
    }
    if (visible.lines.length > 0 && visible.length === 0) {
      const inferredVisibleLength = inferFragmentLengthFromLines(visible.lines);
      if (inferredVisibleLength > 0) {
        const visibleMax = overflow ? Math.max(0, expected - overflow.length) : expected;
        visible.length = Math.min(visibleMax, inferredVisibleLength);
      }
    }
  }

  return {
    visible,
    overflow,
  };
};

export const createAutoSplitResult = (
  remainingLines: any[],
  options: CreateAutoSplitResultOptions
) => {
  const {
    remainingLength,
    availableHeight,
    lineHeightValue,
    getFittableLineCount,
    measureLinesHeight,
    normalizeChunkRelativeY,
  } = options;
  if (!Array.isArray(remainingLines) || remainingLines.length === 0) {
    return null;
  }
  const maxLines = Math.max(1, getFittableLineCount(remainingLines, availableHeight, lineHeightValue));
  if (maxLines >= remainingLines.length) {
    return null;
  }
  const visibleLinesRaw = remainingLines.slice(0, maxLines);
  const lastLine = visibleLinesRaw[visibleLinesRaw.length - 1];
  const firstLine = visibleLinesRaw[0];
  const startOffset = typeof firstLine?.start === "number" ? firstLine.start : 0;
  const endOffset = typeof lastLine?.end === "number" ? lastLine.end : remainingLength;
  const visibleLength = Math.max(0, endOffset - startOffset);
  const visibleLines = normalizeChunkRelativeY(visibleLinesRaw);
  const visibleHeight = measureLinesHeight(visibleLines, lineHeightValue);
  const overflowLines = normalizeChunkRelativeY(remainingLines.slice(maxLines));
  const overflowLength = Math.max(0, remainingLength - visibleLength);
  const overflowHeight = measureLinesHeight(overflowLines, lineHeightValue);
  return {
    lines: visibleLines,
    length: visibleLength,
    height: visibleHeight,
    overflow: {
      lines: overflowLines,
      length: overflowLength,
      height: overflowHeight,
    },
    fragments: [
      {
        kind: "visible" as const,
        lines: visibleLines,
        length: visibleLength,
        height: visibleHeight,
        continuation: {
          fromPrev: false,
          hasNext: overflowLines.length > 0,
          rowSplit: false,
        },
      },
      {
        kind: "overflow" as const,
        lines: overflowLines,
        length: overflowLength,
        height: overflowHeight,
        continuation: {
          fromPrev: true,
          hasNext: false,
          rowSplit: false,
        },
      },
    ],
  };
};
