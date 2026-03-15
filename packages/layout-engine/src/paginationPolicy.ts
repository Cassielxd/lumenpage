import { validateNormalizedSplitFragments } from "./fragments/invariants";
import {
  type LayoutSplitContinuation,
  createAutoSplitResult,
  normalizeSplitFragments,
} from "./fragments/normalize";
import type { NodeRenderer } from "./nodeRegistry";
import { resolveLineHeight } from "./engine/lineLayout";
import { resolveRendererFragmentModel } from "lumenpage-render-engine";

export type RendererReusePolicy = "none" | "actual-slice-only" | "always-sensitive";

export const resolveRendererReusePolicy = (
  renderer: Pick<NodeRenderer, "pagination" | "splitBlock"> | null | undefined
): RendererReusePolicy =>
  renderer?.pagination?.reusePolicy ||
  (resolveRendererFragmentModel(renderer) === "continuation" ? "actual-slice-only" : "none");

export const resolveRendererPagination = (
  renderer: NodeRenderer | null | undefined
): {
  canSplit: boolean;
  fragmentModel: "none" | "continuation";
  splitBlock: NodeRenderer["splitBlock"] | null;
  reusePolicy: RendererReusePolicy;
} => ({
  canSplit: renderer?.allowSplit ?? !renderer?.layoutBlock,
  fragmentModel: resolveRendererFragmentModel(renderer),
  splitBlock: typeof renderer?.splitBlock === "function" ? renderer.splitBlock : null,
  reusePolicy: resolveRendererReusePolicy(renderer),
});

type ResolveNormalizedSplitFragmentsOptions = {
  renderer: NodeRenderer | null | undefined;
  node: any;
  lines: any[];
  remainingLength: number;
  remainingHeight: number;
  availableHeight: number;
  lineHeightValue: number;
  settings: any;
  registry: any;
  indent: number;
  containerStack: any[];
  blockAttrs: any;
  getFittableLineCount: (lines: any[], availableHeight: number, fallbackLineHeight: number) => number;
  measureLinesHeight: (lines: any[], fallbackLineHeight: number) => number;
  normalizeChunkRelativeY: (lines: any[]) => any[];
};

type MaterializedSplitChunk = {
  lines: any[];
  length: number;
  height: number;
  continuation: LayoutSplitContinuation | null;
};

export type MaterializedSplitResult = {
  visible: MaterializedSplitChunk;
  overflow: MaterializedSplitChunk | null;
};

export type ForcedFirstLinePlacement = {
  line: any;
  height: number;
  nextLines: any[];
  nextLength: number;
  nextHeight: number;
};

export type LeafOverflowDecision =
  | "retry-on-fresh-page"
  | "force-first-line"
  | "place-whole-unsplittable"
  | "split";

export type EmptyVisibleSplitDecision =
  | "retry-on-fresh-page"
  | "force-first-line"
  | "carry-overflow-after-page-break";

export type LeafSplitAction =
  | { kind: "retry-on-fresh-page" }
  | { kind: "force-first-line" }
  | { kind: "place-whole-unsplittable" }
  | {
      kind: "carry-overflow-after-page-break";
      overflow: NonNullable<MaterializedSplitResult["overflow"]>;
    }
  | {
      kind: "place-visible-split";
      visible: MaterializedSplitResult["visible"];
      overflow: MaterializedSplitResult["overflow"];
    };

export const resolveNormalizedSplitFragments = ({
  renderer,
  node,
  lines,
  remainingLength,
  remainingHeight,
  availableHeight,
  lineHeightValue,
  settings,
  registry,
  indent,
  containerStack,
  blockAttrs,
  getFittableLineCount,
  measureLinesHeight,
  normalizeChunkRelativeY,
}: ResolveNormalizedSplitFragmentsOptions) => {
  const pagination = resolveRendererPagination(renderer);
  let splitResult = null;
  if (pagination.splitBlock) {
    splitResult = pagination.splitBlock({
      node,
      lines,
      length: remainingLength,
      height: remainingHeight,
      availableHeight,
      lineHeight: lineHeightValue,
      settings,
      registry,
      indent,
      containerStack,
      blockAttrs,
    });
  }

  const autoSplitResult = createAutoSplitResult(lines, {
    remainingLength,
    availableHeight,
    lineHeightValue,
    getFittableLineCount,
    measureLinesHeight,
    normalizeChunkRelativeY,
  });

  if (!splitResult) {
    splitResult = autoSplitResult;
  }

  let splitFragments = normalizeSplitFragments(splitResult, {
    fallbackLineHeight: lineHeightValue,
    expectedLength: remainingLength,
    measureLinesHeight,
  });
  let splitValidation = validateNormalizedSplitFragments(splitFragments, remainingLength);

  if (!splitFragments && splitResult) {
    splitFragments = normalizeSplitFragments(autoSplitResult, {
      fallbackLineHeight: lineHeightValue,
      expectedLength: remainingLength,
      measureLinesHeight,
    });
    splitValidation = validateNormalizedSplitFragments(splitFragments, remainingLength);
  }

  if (splitFragments && !splitValidation.ok) {
    splitFragments = normalizeSplitFragments(autoSplitResult, {
      fallbackLineHeight: lineHeightValue,
      expectedLength: remainingLength,
      measureLinesHeight,
    });
    splitValidation = validateNormalizedSplitFragments(splitFragments, remainingLength);
  }

  return splitFragments && splitValidation.ok ? splitFragments : null;
};

export const materializeSplitResult = ({
  splitFragments,
  lineHeightValue,
  measureLinesHeight,
  applyContinuation,
}: {
  splitFragments: NonNullable<ReturnType<typeof normalizeSplitFragments>>;
  lineHeightValue: number;
  measureLinesHeight: (lines: any[], fallbackLineHeight: number) => number;
  applyContinuation: (lines: any[], continuation: LayoutSplitContinuation | null | undefined) => any[];
}): MaterializedSplitResult => {
  const visibleLines = applyContinuation(
    splitFragments.visible.lines,
    splitFragments.visible.continuation
  );
  const visibleHeight = Number.isFinite(splitFragments.visible.height)
    ? Number(splitFragments.visible.height)
    : measureLinesHeight(visibleLines, lineHeightValue);

  const overflowLines =
    splitFragments.overflow && splitFragments.overflow.lines.length > 0
      ? applyContinuation(splitFragments.overflow.lines, splitFragments.overflow.continuation)
      : null;

  return {
    visible: {
      lines: visibleLines,
      length: splitFragments.visible.length,
      height: visibleHeight,
      continuation: splitFragments.visible.continuation ?? null,
    },
    overflow:
      splitFragments.overflow && overflowLines
        ? {
            lines: overflowLines,
            length: splitFragments.overflow.length,
            height: Number.isFinite(splitFragments.overflow.height)
              ? Number(splitFragments.overflow.height)
              : measureLinesHeight(overflowLines, lineHeightValue),
            continuation: splitFragments.overflow.continuation ?? null,
          }
        : null,
  };
};

export const consumeForcedFirstLine = ({
  remainingLines,
  remainingLength,
  remainingHeight,
  lineHeightValue,
}: {
  remainingLines: any[];
  remainingLength: number;
  remainingHeight: number;
  lineHeightValue: number;
}): ForcedFirstLinePlacement | null => {
  const forcedLine = Array.isArray(remainingLines) && remainingLines.length > 0 ? remainingLines[0] : null;
  if (!forcedLine) {
    return null;
  }
  const forcedStart = typeof forcedLine?.start === "number" ? forcedLine.start : 0;
  const forcedEnd = typeof forcedLine?.end === "number" ? forcedLine.end : forcedStart;
  const forcedLength = Math.max(0, forcedEnd - forcedStart);
  const forcedHeight = Number.isFinite(forcedLine?.lineHeight)
    ? Number(forcedLine.lineHeight)
    : lineHeightValue;
  return {
    line: forcedLine,
    height: forcedHeight,
    nextLines: remainingLines.slice(1),
    nextLength: Math.max(0, remainingLength - forcedLength),
    nextHeight: Math.max(0, remainingHeight - forcedHeight),
  };
};

export const resolveLeafOverflowDecision = ({
  availableHeight,
  fullAvailableHeight,
  firstLineHeight,
  canSplit,
  pageHasLines,
}: {
  availableHeight: number;
  fullAvailableHeight: number;
  firstLineHeight: number;
  canSplit: boolean;
  pageHasLines: boolean;
}): LeafOverflowDecision => {
  if (availableHeight < firstLineHeight) {
    return fullAvailableHeight >= firstLineHeight ? "retry-on-fresh-page" : "force-first-line";
  }
  if (!canSplit) {
    return pageHasLines ? "retry-on-fresh-page" : "place-whole-unsplittable";
  }
  return "split";
};

export const resolveEmptyVisibleSplitDecision = ({
  pageHasLines,
  hasRemainingLines,
  remainingHeight,
  fullAvailableHeight,
}: {
  pageHasLines: boolean;
  hasRemainingLines: boolean;
  remainingHeight: number;
  fullAvailableHeight: number;
}): EmptyVisibleSplitDecision => {
  if (!pageHasLines && hasRemainingLines) {
    return remainingHeight <= fullAvailableHeight ? "retry-on-fresh-page" : "force-first-line";
  }
  return "carry-overflow-after-page-break";
};

/**
 * 统一解析叶子块在当前页放不下时的后续动作，主循环只负责执行结果。
 */
export const resolveLeafSplitAction = ({
  renderer,
  node,
  lines,
  remainingLength,
  remainingHeight,
  availableHeight,
  lineHeightValue,
  settings,
  registry,
  indent,
  containerStack,
  blockAttrs,
  pageHasLines,
  getFittableLineCount,
  measureLinesHeight,
  normalizeChunkRelativeY,
  applyContinuation,
}: ResolveNormalizedSplitFragmentsOptions & {
  pageHasLines: boolean;
  applyContinuation: (lines: any[], continuation: LayoutSplitContinuation | null | undefined) => any[];
}): LeafSplitAction => {
  const fullAvailableHeight = settings.pageHeight - settings.margin.top - settings.margin.bottom;
  const firstLineHeight = resolveLineHeight(lines[0], lineHeightValue);
  const overflowDecision = resolveLeafOverflowDecision({
    availableHeight,
    fullAvailableHeight,
    firstLineHeight,
    canSplit: resolveRendererPagination(renderer).canSplit,
    pageHasLines,
  });

  if (overflowDecision === "retry-on-fresh-page") {
    return { kind: "retry-on-fresh-page" };
  }
  if (overflowDecision === "force-first-line") {
    return { kind: "force-first-line" };
  }
  if (overflowDecision === "place-whole-unsplittable") {
    return { kind: "place-whole-unsplittable" };
  }

  const splitFragments = resolveNormalizedSplitFragments({
    renderer,
    node,
    lines,
    remainingLength,
    remainingHeight,
    availableHeight,
    lineHeightValue,
    settings,
    registry,
    indent,
    containerStack,
    blockAttrs,
    getFittableLineCount,
    measureLinesHeight,
    normalizeChunkRelativeY,
  });
  if (!splitFragments) {
    return { kind: "retry-on-fresh-page" };
  }

  const materializedSplit = materializeSplitResult({
    splitFragments,
    lineHeightValue,
    measureLinesHeight,
    applyContinuation,
  });

  if (
    materializedSplit.visible.lines.length === 0 &&
    materializedSplit.overflow &&
    materializedSplit.overflow.lines.length > 0
  ) {
    const emptyVisibleSplitDecision = resolveEmptyVisibleSplitDecision({
      pageHasLines,
      hasRemainingLines: lines.length > 0,
      remainingHeight,
      fullAvailableHeight,
    });
    if (emptyVisibleSplitDecision === "retry-on-fresh-page") {
      return { kind: "retry-on-fresh-page" };
    }
    if (emptyVisibleSplitDecision === "force-first-line") {
      return { kind: "force-first-line" };
    }
    return {
      kind: "carry-overflow-after-page-break",
      overflow: materializedSplit.overflow,
    };
  }

  if (materializedSplit.visible.lines.length > 0) {
    return {
      kind: "place-visible-split",
      visible: materializedSplit.visible,
      overflow: materializedSplit.overflow,
    };
  }

  return { kind: "retry-on-fresh-page" };
};
