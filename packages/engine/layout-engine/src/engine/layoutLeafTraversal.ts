import { resolveLeafBlockLayout } from "./leafBlockLayout.js";
import { applyResumeAnchorToLeafBlock, resolveLeafBlockSetup } from "./leafBlockSetup.js";
import { placeForcedFirstLeafLine, placeLeafLinesOnPage } from "./leafPlacement.js";
import {
  getFittableLineCount,
  measureLinesHeight,
  normalizeChunkRelativeY,
} from "./lineLayout.js";
import { applyFragmentContinuation } from "./pageReuseEquivalence.js";
import { appendPageReuseSignature } from "./pageReuseSignature.js";
import {
  consumeForcedFirstLine,
  resolveLeafSplitAction,
} from "../paginationPolicy.js";
import { ensureBlockFragmentOwner } from "lumenpage-render-engine";
import { updateChangedBoundaryProgress } from "./changeBoundary.js";

export function layoutLeafBlockOnPage(options: {
  session: any;
  block: any;
  context: any;
  registry: any;
  baseSettings: any;
  blockCache: Map<any, any>;
  measureTextWidth: (font: string, text: string) => number;
  perf: any;
  now: () => number;
  logLayout: (...args: any[]) => void;
  blockSpacing: number;
  pageHeight: number;
  margin: { top: number; bottom: number };
  lineHeight: number;
  finalizePage: () => boolean;
}) {
  const {
    session,
    block,
    context,
    registry,
    baseSettings,
    blockCache,
    measureTextWidth,
    perf,
    now,
    logLayout,
    blockSpacing,
    pageHeight,
    margin,
    lineHeight,
    finalizePage,
  } = options;

  if (session.shouldStop) {
    return true;
  }

  const leafStart = perf ? now() : 0;

  if (perf) {
    perf.blocks += 1;
  }

  const {
    blockId,
    blockTypeName,
    renderer,
    blockSettings,
    blockAttrs: initialBlockAttrs,
    spacingBefore,
    spacingAfter,
  } = resolveLeafBlockSetup({
    block,
    registry,
    baseSettings,
    indent: context.indent,
    blockSpacing,
    containerStack: context?.containerStack || [],
  });

  if (blockTypeName === "pageBreak") {
    session.textOffset += 1;
    updateChangedBoundaryProgress(session);
    if (session.page.lines.length > 0) {
      if (finalizePage()) {
        return true;
      }
    }
    if (perf) {
      perf.layoutLeafMs += now() - leafStart;
    }
    return session.shouldStop;
  }

  let blockAttrs = initialBlockAttrs;
  const resumeAnchorPlacement = applyResumeAnchorToLeafBlock({
    resumeFromAnchor: session.resumeFromAnchor,
    resumeAnchorApplied: session.resumeAnchorApplied,
    rootIndex: context.rootIndex,
    startBlockIndex: session.startBlockIndex,
    resumeAnchorTargetY: session.resumeAnchorTargetY,
    spacingBefore,
    marginTop: margin.top,
    cursorY: session.cursorY,
  });
  session.cursorY = resumeAnchorPlacement.cursorY;
  session.resumeAnchorApplied = resumeAnchorPlacement.resumeAnchorApplied;

  const {
    blockLines,
    blockLength,
    blockHeight,
    blockAttrs: resolvedBlockAttrs,
    blockLineHeight,
    blockSignature,
    measuredLayoutModel,
  } = resolveLeafBlockLayout({
    block,
    blockId,
    blockSettings,
    renderer,
    registry,
    indent: context.indent,
    containerStack: context.containerStack,
    availableHeight: pageHeight - margin.bottom - session.cursorY,
    lineHeight,
    blockCache,
    measureTextWidth,
    perf,
    now,
    logLayout,
  });
  blockAttrs = resolvedBlockAttrs;

  const lineHeightValue = blockLineHeight || lineHeight;
  const safeLines =
    blockLines.length > 0
      ? blockLines
      : [
          {
            text: "",
            start: 0,
            end: 0,
            width: 0,
            runs: [],
            blockType: block.type.name,
            blockAttrs,
          },
        ];

  let remainingLines = safeLines;
  let remainingLength = blockLength;
  let remainingHeight =
    Number.isFinite(blockHeight) && blockHeight > 0
      ? blockHeight
      : measureLinesHeight(safeLines, lineHeightValue);

  const blockStart = session.textOffset;
  const containerStack = context.containerStack;
  const placeLines = (linesToPlace: any[]) =>
    placeLeafLinesOnPage({
      linesToPlace,
      lineHeightValue,
      block,
      blockId,
      blockSignature,
      blockAttrs,
      blockStart,
      rootIndex: context.rootIndex,
      blockSettings,
      containerStack,
      cursorY: session.cursorY,
      page: session.page,
      pageBoxCollector: session.pageBoxCollector,
      perf,
      ensureBlockFragmentOwner,
      appendPageReuseSignature,
    });
  const placeForcedFirstLine = () => {
    const forcedPlacement = placeForcedFirstLeafLine({
      remainingLines,
      remainingLength,
      remainingHeight,
      lineHeightValue,
      consumeForcedFirstLine,
      placeLines,
    });
    if (!forcedPlacement) {
      return false;
    }
    session.cursorY += forcedPlacement.placedHeight;
    remainingLines = forcedPlacement.nextLines;
    remainingLength = forcedPlacement.nextLength;
    remainingHeight = forcedPlacement.nextHeight;
    return true;
  };

  let hasPlacedContent = false;
  const hasModernPagination = typeof renderer?.paginateBlock === "function";
  if (hasModernPagination && !measuredLayoutModel) {
    throw new Error(
      `[pagination-modernization] Leaf block "${blockTypeName || "unknown"}" did not produce a measured layout model for modern pagination.`,
    );
  }
  let modernCursor =
    hasModernPagination
      ? {
          nodeId: blockId,
          blockId,
          startPos: blockStart,
          endPos: blockStart + Math.max(0, Number(blockLength || 0)),
          localCursor: null,
          meta: {
            source: "layout-leaf-traversal",
          },
        }
      : null;

  while ((modernCursor != null && hasModernPagination) || remainingLines.length > 0) {
    if (session.shouldStop) {
      return true;
    }
    if (!hasPlacedContent && spacingBefore > 0) {
      if (session.cursorY + spacingBefore > pageHeight - margin.bottom) {
        if (finalizePage()) {
          return true;
        }
      }
      session.cursorY += spacingBefore;
    }

    if (modernCursor && hasModernPagination) {
      const availableHeight = pageHeight - margin.bottom - session.cursorY;
      const modernResult = renderer.paginateBlock({
        node: block,
        measured: measuredLayoutModel,
        cursor: modernCursor,
        availableHeight,
        settings: blockSettings,
        registry,
        indent: context.indent,
        containerStack,
        blockAttrs,
        lineHeight: lineHeightValue,
        pageHasLines: session.page.lines.length > 0,
        blockStart,
        rootIndex: context.rootIndex,
      });

      const modernSlice = modernResult?.slice ?? null;
      const modernSliceLines = Array.isArray(modernSlice?.lines) ? modernSlice.lines : [];
      const nextModernCursor = modernResult?.nextCursor ?? modernSlice?.nextCursor ?? null;

      if (modernSlice && modernSliceLines.length > 0) {
        placeLines(modernSliceLines);
        session.cursorY += measureLinesHeight(modernSliceLines, lineHeightValue);
        hasPlacedContent = true;
        modernCursor = nextModernCursor;
        if (modernCursor) {
          if (finalizePage()) {
            return true;
          }
          continue;
        }
        remainingLines = [];
        break;
      }

      if (modernSlice && nextModernCursor && session.page.lines.length > 0) {
        modernCursor = nextModernCursor;
        if (finalizePage()) {
          return true;
        }
        continue;
      }

      modernCursor = null;
    }

    if (remainingLines.length === 0) {
      break;
    }

    const availableHeight = pageHeight - margin.bottom - session.cursorY;
    if (remainingHeight > availableHeight) {
      const splitAction = resolveLeafSplitAction({
        renderer,
        node: block,
        lines: remainingLines,
        remainingLength,
        remainingHeight,
        availableHeight,
        lineHeightValue,
        settings: blockSettings,
        registry,
        indent: context.indent,
        containerStack,
        blockAttrs,
        pageHasLines: session.page.lines.length > 0,
        getFittableLineCount,
        measureLinesHeight,
        normalizeChunkRelativeY,
        applyContinuation: applyFragmentContinuation,
      });
      if (splitAction.kind === "retry-on-fresh-page") {
        if (finalizePage()) {
          return true;
        }
        continue;
      }
      if (splitAction.kind === "force-first-line") {
        if (!placeForcedFirstLine()) {
          break;
        }
        hasPlacedContent = true;
        if (finalizePage()) {
          return true;
        }
        continue;
      }
      if (splitAction.kind === "place-whole-unsplittable") {
        placeLines(remainingLines);
        session.cursorY += remainingHeight;
        hasPlacedContent = true;
        remainingLines = [];
        break;
      }
      if (splitAction.kind === "carry-overflow-after-page-break") {
        if (finalizePage()) {
          return true;
        }
        remainingLines = splitAction.overflow.lines;
        remainingLength = splitAction.overflow.length;
        remainingHeight = splitAction.overflow.height;
        continue;
      }
      if (splitAction.kind === "place-visible-split") {
        placeLines(splitAction.visible.lines);
        session.cursorY += splitAction.visible.height;
        hasPlacedContent = true;
        const hasOverflow = !!splitAction.overflow && splitAction.overflow.lines.length > 0;
        if (finalizePage()) {
          return true;
        }
        if (hasOverflow && splitAction.overflow) {
          remainingLines = splitAction.overflow.lines;
          remainingLength = splitAction.overflow.length;
          remainingHeight = splitAction.overflow.height;
          continue;
        }
        remainingLines = [];
        break;
      }
    }
    placeLines(remainingLines);
    session.cursorY += remainingHeight;
    hasPlacedContent = true;
    remainingLines = [];
  }

  session.textOffset += blockLength;
  updateChangedBoundaryProgress(session);

  if (spacingAfter > 0) {
    session.cursorY += spacingAfter;
  }
  if (session.cursorY + lineHeight > pageHeight - margin.bottom) {
    if (finalizePage()) {
      return true;
    }
  }

  if (perf) {
    perf.layoutLeafMs += now() - leafStart;
  }

  return session.shouldStop;
}




