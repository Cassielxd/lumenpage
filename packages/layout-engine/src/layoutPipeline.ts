/**
 * 布局主流程的过渡入口。
 * 当前这里仍负责文档递归、分页控制和页复用主循环，
 * 纯几何、签名与文本折行能力已经逐步下沉到 engine/ 目录。
 */
import { createPageBoxCollector } from "./pageBoxes";
import { resolveLayoutOffsetDelta, resolvePreviousPageReuseState } from "./engine/incrementalState";
import { finalizeLayoutPages } from "./engine/layoutFinalization";
import { resolveLeafBlockLayout } from "./engine/leafBlockLayout";
import { applyResumeAnchorToLeafBlock, resolveLeafBlockSetup } from "./engine/leafBlockSetup";
import { finalizeLayoutPerf } from "./engine/perfSummary";
import {
  resolveFinalizePageReuseDecision,
  shouldStopAtProgressiveCutoff,
} from "./engine/pageContinuation";
import { resolveResumeAnchorPlan } from "./engine/resumeAnchor";
import {
  resolveMaybeSyncDecision,
} from "./engine/pageSync";
import type { LayoutFromDocOptions } from "./engine/types";
import { newPage, markReusedPages, populatePageDerivedState } from "./engine/pageState";
import { placeForcedFirstLeafLine, placeLeafLinesOnPage } from "./engine/leafPlacement";
import {
  getFittableLineCount,
  measureLinesHeight,
  normalizeChunkRelativeY,
  resolveLineHeight,
} from "./engine/lineLayout";
import { layoutFromRunsWithSettings, layoutFromTextWithSettings } from "./engine/textLayout";
import {
  ENABLE_CROSS_PAGE_CANDIDATE_REUSE,
  ENABLE_RESUME_FROM_ANCHOR_REUSE,
  appendGhostTrace,
  appendPageReuseSignature,
  applyFragmentContinuation,
  isGhostTraceEnabled,
} from "./engine/pageReuse";
import {
} from "./engine/anchors";
import { shouldDisableReuseForSensitiveChange } from "./engine/sensitiveReuse";
import {
  consumeForcedFirstLine,
  resolveLeafSplitAction,
  resolveRendererReusePolicy,
} from "./paginationPolicy";
import {
  ensureBlockFragmentOwner,
  isLeafLayoutNode,
  resolveContainerLayoutContext,
} from "lumenpage-render-engine";

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * LayoutPipeline 仍然是布局主入口。
 * 后续会继续把分页决策和块布局逻辑下沉到更细的 helper。
 */
export class LayoutPipeline {
  settings;
  registry;
  blockCache;

  /**
   * 初始化布局管线，并准备块级缓存。
   */
  constructor(settings, registry = null) {
    this.settings = settings;
    this.registry = registry;
    this.blockCache = new Map();
  }

  /**
   * 按 block id 清理缓存，保证指定块会重新布局。
   */
  invalidateBlocks(ids = []) {
    for (const id of ids) {
      if (!id) {
        continue;
      }
      const prefix = `${id}:`;
      for (const key of this.blockCache.keys()) {
        if (key === id || String(key).startsWith(prefix)) {
          this.blockCache.delete(key);
        }
      }
    }
  }

  /**
   * 清空当前实例持有的全部块布局缓存。
   */
  clearCache() {
    this.blockCache.clear();
  }

  /**
   * 返回当前块缓存的简单统计信息，便于调试。
   */
  getCacheStats() {
    return {
      size: this.blockCache.size,
      keys: Array.from(this.blockCache.keys()).slice(0, 10),
    };
  }

  /**
   * 从文档树执行完整布局，包含增量复用、分页和派生几何物化。
   */
  layoutFromDoc(doc, options: LayoutFromDocOptions = {}) {
    // 先准备本次布局使用的基础设置，并决定是否允许复用旧页。
    const baseSettingsRaw = options?.layoutSettingsOverride ?? this.settings;
    let disablePageReuse = !!baseSettingsRaw.disablePageReuse;
    const ghostTraceEnabled = isGhostTraceEnabled(baseSettingsRaw);
    const ghostTrace = ghostTraceEnabled ? [] : null;
    if (!disablePageReuse) {
      const changeSummary = options?.changeSummary ?? null;
      const previousLayout = options?.previousLayout ?? null;
      const isSensitiveNodeByRenderer = (node) => {
        const typeName = node?.type?.name;
        if (!typeName || !this.registry?.get) {
          return false;
        }
        const renderer = this.registry.get(typeName);
        return resolveRendererReusePolicy(renderer) === "always-sensitive";
      };
      const isSensitiveLineByRenderer = (line) => {
        const blockType = line?.blockType;
        if (!blockType || !this.registry?.get) {
          return false;
        }
        const renderer = this.registry.get(blockType);
        return resolveRendererReusePolicy(renderer) === "always-sensitive";
      };
      const defaultDecision = shouldDisableReuseForSensitiveChange(
        doc,
        changeSummary,
        previousLayout,
        this.registry
          ? {
              isSensitiveNode: isSensitiveNodeByRenderer,
              isSensitiveLine: isSensitiveLineByRenderer,
            }
          : undefined
      );
      const customGuard = baseSettingsRaw?.shouldDisablePageReuseForChange;
      if (typeof customGuard === "function") {
        try {
          const customDecision = customGuard({
            doc,
            changeSummary,
            previousLayout,
            defaultDecision,
            shouldDisableReuseForSensitiveChange,
          });
          if (customDecision === true || customDecision === false) {
            disablePageReuse = customDecision;
          } else {
            disablePageReuse = defaultDecision;
          }
        } catch (_error) {
          disablePageReuse = defaultDecision;
        }
      } else {
        disablePageReuse = defaultDecision;
      }
    }
    appendGhostTrace(ghostTrace, {
      event: "layout-start",
      docChanged: options?.changeSummary?.docChanged === true,
      disablePageReuse,
      hasPreviousLayout: !!options?.previousLayout,
      previousPages: options?.previousLayout?.pages?.length ?? 0,
      cascadePagination: options?.cascadePagination === true,
      cascadeFromPageIndex: Number.isFinite(options?.cascadeFromPageIndex)
        ? Number(options.cascadeFromPageIndex)
        : null,
    });
    // 调试性能统计只在显式开启时启用，避免污染常规路径。
    const debugPerf = !!baseSettingsRaw.debugPerf;
    const logLayout = (..._args: any[]) => {};
    const perf = debugPerf
      ? {
          start: now(),
          blocks: 0,
          cachedBlocks: 0,
          lines: 0,
          pages: 0,
          measureCalls: 0,
          measureChars: 0,
          reusedPages: 0,
          breakLinesMs: 0,
          layoutLeafMs: 0,
          reuseReason: "unknown",
          syncAfterIndex: null,
          canSync: false,
          passedChangedRange: false,
          syncFromIndex: null,
          resumeFromAnchor: false,
          resumeAnchorPageIndex: null,
          resumeAnchorLineIndex: null,
          resumeAnchorMatchKey: null,
          resumeAnchorSkippedReason: null,
          reusedPrefixPages: 0,
          reusedPrefixLines: 0,
          maybeSyncReason: "unknown",
          disablePageReuse: false,
          progressiveTruncated: false,
          cascadeMaxPages: null,
          optionsPrevPages: 0,
          maybeSyncCalled: false,
          maybeSyncFailSnapshot: null,
        }
      : null;
    const baseMeasure = baseSettingsRaw.measureTextWidth;
    const measureTextWidth = debugPerf
      ? (font, text) => {
          perf.measureCalls += 1;
          perf.measureChars += text ? text.length : 0;
          return baseMeasure(font, text);
        }
      : baseMeasure;
    // 这一组局部状态会随着分页推进不断变化，是整个主循环的共享上下文。
    const baseSettings = debugPerf ? { ...baseSettingsRaw, measureTextWidth } : baseSettingsRaw;
    const { pageHeight, pageGap, margin, lineHeight, font } = baseSettings;
    const blockSpacing = Number.isFinite(baseSettings.blockSpacing) ? baseSettings.blockSpacing : 0;
    const rootMarginLeft = margin.left;
    let previousLayout = disablePageReuse ? null : (options?.previousLayout ?? null);
    let changeSummary = disablePageReuse ? null : (options?.changeSummary ?? null);
    if (perf) {
      perf.disablePageReuse = !!disablePageReuse;
      perf.progressiveTruncated = false;
      perf.optionsPrevPages = options?.previousLayout?.pages?.length ?? 0;
    }
    const docPosToTextOffset = options?.docPosToTextOffset ?? null;
    
    const cascadePagination = options?.cascadePagination === true;
    const cascadeFromPageIndex = Number.isFinite(options?.cascadeFromPageIndex)
      ? Math.max(0, Number(options.cascadeFromPageIndex))
      : null;
    const incrementalConfig = baseSettingsRaw?.paginationWorker?.incremental ?? null;
    const cascadeMaxPages =
      cascadePagination && Number.isFinite(incrementalConfig?.maxPages)
        ? Math.max(1, Number(incrementalConfig.maxPages))
        : null;
    const cascadeStopPageIndex =
      cascadePagination && cascadeFromPageIndex !== null && Number.isFinite(cascadeMaxPages)
        ? cascadeFromPageIndex + Number(cascadeMaxPages) - 1
        : null;
    if (perf) {
      perf.cascadeMaxPages = cascadeMaxPages;
    }
    
    let progressiveApplied = false;
    let progressiveTruncated = false;
    let pages = [];
    let pageIndex = 0;
    let page = newPage(pageIndex);
    let pageBoxCollector = createPageBoxCollector();
    const syncCurrentPageBoxes = () => {
      page.boxes = pageBoxCollector.finalize();
      return page.boxes;
    };
    const setCurrentPage = (nextPage, seedLines = null) => {
      page = nextPage;
      if (Array.isArray(seedLines)) {
        page.lines = seedLines;
      }
      pageBoxCollector = createPageBoxCollector();
      const lines = Array.isArray(page?.lines) ? page.lines : [];
      for (const line of lines) {
        pageBoxCollector.consumeLine(line);
      }
    };
    let cursorY = margin.top;
    let textOffset = 0;
    let startBlockIndex = 0;
    let syncAfterIndex = null;
    let canSync = false;
    let passedChangedRange = false;
    let shouldStop = false;
    let syncFromIndex = null;
    let resumeFromAnchor = false;
    let resumeHasPrefixLines = false;
    let resumeAnchorTargetY: { y: number; relativeY: number } | null = null;
    let resumeAnchorApplied = false;
    let resumeAnchorPageIndex = null;
    let resumeAnchorLineIndex = null;
    let resumeAnchorMatchKey = null;
    let resumeAnchorSkippedReason = null;
    let reusedPrefixPages = 0;
    let reusedPrefixLines = 0;
    const {
      previousPageReuseIndex,
      previousPageFirstBlockIdIndex,
      previousPageSignatureIndex,
    } = resolvePreviousPageReuseState(previousLayout);
    const offsetDelta = resolveLayoutOffsetDelta(changeSummary);
    const resumeAnchorPlan = resolveResumeAnchorPlan({
      enabled: ENABLE_RESUME_FROM_ANCHOR_REUSE,
      previousLayout,
      changeSummary,
      doc,
      docPosToTextOffset,
      pageHeight,
      pageWidth: baseSettings.pageWidth,
      pageGap,
      lineHeight,
      margin,
    });
    if (resumeAnchorPlan) {
      if (previousLayout?.pages?.length) {
        logLayout(`[layout-engine] incremental mode, prevPages:${previousLayout.pages.length}`);
      }
      if (resumeAnchorPlan.anchorFound) {
        resumeAnchorPageIndex = resumeAnchorPlan.anchorPageIndex;
        resumeAnchorLineIndex = resumeAnchorPlan.anchorLineIndex;
        resumeAnchorMatchKey = resumeAnchorPlan.anchorMatchKey;
        appendGhostTrace(ghostTrace, {
          event: "resume-anchor-found",
          pageIndex: resumeAnchorPlan.anchorPageIndex,
          lineIndex: resumeAnchorPlan.anchorLineIndex,
          startIndexOld: resumeAnchorPlan.startIndexOld,
          startIndexNew: resumeAnchorPlan.startIndexNew,
          startOffset:
            Number.isFinite(resumeAnchorPlan.startOffset) ? Number(resumeAnchorPlan.startOffset) : null,
          blockId: resumeAnchorPlan.blockId ?? null,
          matchKey: resumeAnchorPlan.anchorMatchKey,
          blockIdMatches: resumeAnchorPlan.blockIdMatches === true,
          blockStartMatches: resumeAnchorPlan.blockStartMatches === true,
          rootIndexMatches: resumeAnchorPlan.rootIndexMatches === true,
          canResumeAnchor: resumeAnchorPlan.canResumeAnchor === true,
        });
        logLayout(
          `[layout-engine] anchor FOUND: pageIndex=${resumeAnchorPlan.anchorPageIndex}, lineIndex=${resumeAnchorPlan.anchorLineIndex}, match=${resumeAnchorPlan.anchorMatchKey}`
        );
        if (!resumeAnchorPlan.canResumeAnchor) {
          resumeAnchorSkippedReason = resumeAnchorPlan.skippedReason;
          appendGhostTrace(ghostTrace, {
            event: "resume-anchor-skipped",
            reason: resumeAnchorSkippedReason,
            pageIndex: resumeAnchorPlan.anchorPageIndex,
            lineIndex: resumeAnchorPlan.anchorLineIndex,
            matchKey: resumeAnchorPlan.anchorMatchKey,
          });
        } else {
          reusedPrefixPages = resumeAnchorPlan.reusedPrefixPages;
          reusedPrefixLines = resumeAnchorPlan.reusedPrefixLines;
          pages = markReusedPages(previousLayout.pages.slice(0, resumeAnchorPlan.reusedPrefixPages));
          pageIndex = resumeAnchorPlan.pageIndex;
          setCurrentPage(newPage(pageIndex), resumeAnchorPlan.reusedLines);
          cursorY = resumeAnchorPlan.anchorTargetY.y;
          resumeAnchorTargetY = resumeAnchorPlan.anchorTargetY;
          textOffset = resumeAnchorPlan.textOffset;
          startBlockIndex = resumeAnchorPlan.startBlockIndex;
          syncAfterIndex = resumeAnchorPlan.syncAfterIndex;
          logLayout(
            `[layout-engine] syncAfterIndex=${syncAfterIndex}, startBlockIndex=${startBlockIndex}`
          );
          canSync = resumeAnchorPlan.canSync;
          passedChangedRange = resumeAnchorPlan.passedChangedRange;
          logLayout(`[layout-engine] canSync=${canSync}, passedChangedRange=${passedChangedRange}`);
          resumeFromAnchor = true;
          resumeHasPrefixLines = resumeAnchorPlan.reusedLines.length > 0;
          resumeAnchorApplied = false;
        }
      }
    }
    // 尝试把当前页与旧布局中的候选页对齐，成功后可以直接复用后续页。
    const maybeSync = () => {
      if (perf) {
        perf.maybeSyncCalled = true;
      }
      const maybeSyncDecision = resolveMaybeSyncDecision({
        candidateReuseEnabled: ENABLE_CROSS_PAGE_CANDIDATE_REUSE,
        canSync,
        passedChangedRange,
        previousLayout,
        pageIndex,
        page,
        previousPageFirstBlockIdIndex,
        previousPageSignatureIndex,
        previousPageReuseIndex,
        syncAfterIndex,
        pageReuseProbeRadius: baseSettings?.pageReuseProbeRadius,
        pageReuseRootIndexProbeRadius: baseSettings?.pageReuseRootIndexProbeRadius,
        offsetDelta,
        createDiff: () => (perf ? {} : null),
      });
      if (!maybeSyncDecision.ok) {
        if (maybeSyncDecision.reason === "candidate-reuse-disabled" && maybeSyncDecision.trace) {
          appendGhostTrace(ghostTrace, maybeSyncDecision.trace);
        }
        if (perf) {
          perf.maybeSyncReason = maybeSyncDecision.reason;
          if (maybeSyncDecision.reason === "precheck-failed") {
            perf.maybeSyncFailSnapshot = maybeSyncDecision.perfSnapshot;
          }
        }
        logLayout(
          `[layout-engine] maybeSync FAILED precheck: reason=${maybeSyncDecision.reason}, canSync=${canSync}, passedChangedRange=${passedChangedRange}`
        );
        if (maybeSyncDecision.reason === "page-not-equivalent") {
          appendGhostTrace(ghostTrace, {
            event: "maybe-sync-miss",
            pageIndex,
            reason: "page-not-equivalent",
            candidateCount: maybeSyncDecision.candidateIndexes.length,
          });
          logLayout(
            `[layout-engine] maybeSync FAILED: page-not-equivalent, pageIndex=${pageIndex}, candidates checked`
          );
        }
        return false;
      }
      logLayout(
        `[layout-engine] maybeSync checking: canSync=${canSync}, passedChangedRange=${passedChangedRange}, pageIndex=${pageIndex}`
      );
      appendGhostTrace(ghostTrace, {
        event: "maybe-sync-candidates",
        pageIndex,
        candidateIndexes: maybeSyncDecision.candidateIndexes.slice(0, 20),
        candidateCount: maybeSyncDecision.candidateIndexes.length,
        signatureKey: maybeSyncDecision.signatureKey,
        syncAfterIndex,
      });
      if (perf) {
        perf.maybeSyncReason = "reuse-ok";
      }
      appendGhostTrace(ghostTrace, {
        event: "maybe-sync-hit",
        pageIndex,
        matchedOldPageIndex: maybeSyncDecision.matchedOldPageIndex,
      });
      logLayout(
        `[layout-engine] maybeSync SUCCESS: matchedOldPageIndex=${maybeSyncDecision.matchedOldPageIndex}`
      );
      syncFromIndex = maybeSyncDecision.matchedOldPageIndex;
      shouldStop = true;
      // Mark progressive as applied since we're reusing pages from previous layout
      progressiveApplied = true;
      return true;
    };
    const finalizePage = () => {
      if (page.lines.length > 0) {
        syncCurrentPageBoxes();
        populatePageDerivedState(page);
        pages.push(page);

        const finalizeReuseDecision = resolveFinalizePageReuseDecision({
          cascadePagination,
          cascadeFromPageIndex,
          pageIndex,
          page,
          previousLayout,
          offsetDelta,
        });
        if (finalizeReuseDecision) {
          appendGhostTrace(ghostTrace, finalizeReuseDecision.trace);
          syncFromIndex = finalizeReuseDecision.syncFromIndex;
          progressiveApplied = true;
          shouldStop = true;
          if (perf) {
            perf.maybeSyncReason = finalizeReuseDecision.reason;
          }
          return true;
        }
      }
      if (maybeSync()) {
        return true;
      }
      if (
        shouldStopAtProgressiveCutoff({
          cascadePagination,
          previousLayout,
          cascadeStopPageIndex,
          pageIndex,
        })
      ) {
        syncFromIndex = pageIndex;
        progressiveApplied = true;
        progressiveTruncated = true;
        shouldStop = true;
        if (perf) {
          perf.progressiveTruncated = true;
          perf.maybeSyncReason = "progressive-cutoff";
        }
        return true;
      }
      pageIndex += 1;
      setCurrentPage(newPage(pageIndex));
      cursorY = margin.top;
      return false;
    };
    // 叶子块会在这里完成缓存命中、切页、续页和行落位。
    const layoutLeafBlock = (block, context) => {
      if (shouldStop) {
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
        registry: this.registry,
        baseSettings,
        indent: context.indent,
        blockSpacing,
        containerStack: context?.containerStack || [],
      });

      // Hard page break: finish current page and continue from next page top.
      if (blockTypeName === "pageBreak") {
        textOffset += 1;
        if (page.lines.length > 0) {
          if (finalizePage()) {
            return true;
          }
        }
        if (perf) {
          perf.layoutLeafMs += now() - leafStart;
        }
        return shouldStop;
      }

      let blockAttrs = initialBlockAttrs;
      const resumeAnchorPlacement = applyResumeAnchorToLeafBlock({
        resumeFromAnchor,
        resumeAnchorApplied,
        rootIndex: context.rootIndex,
        startBlockIndex,
        resumeAnchorTargetY,
        spacingBefore,
        marginTop: margin.top,
        cursorY,
      });
      cursorY = resumeAnchorPlacement.cursorY;
      resumeAnchorApplied = resumeAnchorPlacement.resumeAnchorApplied;

      const {
        blockLines,
        blockLength,
        blockHeight,
        blockAttrs: resolvedBlockAttrs,
        blockLineHeight,
        blockSignature,
      } = resolveLeafBlockLayout({
        block,
        blockId,
        blockSettings,
        renderer,
        registry: this.registry,
        indent: context.indent,
        containerStack: context.containerStack,
        availableHeight: pageHeight - margin.bottom - cursorY,
        lineHeight,
        blockCache: this.blockCache,
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

      const blockStart = textOffset;
      const containerStack = context.containerStack;
      const placeLines = (linesToPlace) =>
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
          cursorY,
          page,
          pageBoxCollector,
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
        cursorY += forcedPlacement.placedHeight;
        remainingLines = forcedPlacement.nextLines;
        remainingLength = forcedPlacement.nextLength;
        remainingHeight = forcedPlacement.nextHeight;
        return true;
      };

      while (remainingLines.length > 0) {
        if (shouldStop) {
          return true;
        }
        if (remainingLines === safeLines && spacingBefore > 0) {
          if (cursorY + spacingBefore > pageHeight - margin.bottom) {
            if (finalizePage()) {
              return true;
            }
          }
          cursorY += spacingBefore;
        }
        const availableHeight = pageHeight - margin.bottom - cursorY;
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
            registry: this.registry,
            indent: context.indent,
            containerStack,
            blockAttrs,
            pageHasLines: page.lines.length > 0,
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
            if (finalizePage()) {
              return true;
            }
            continue;
          }
          if (splitAction.kind === "place-whole-unsplittable") {
            placeLines(remainingLines);
            cursorY += remainingHeight;
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
            cursorY += splitAction.visible.height;
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
        cursorY += remainingHeight;
        remainingLines = [];
      }

      textOffset += blockLength;

      if (spacingAfter > 0) {
        cursorY += spacingAfter;
      }
      if (cursorY + lineHeight > pageHeight - margin.bottom) {
        if (finalizePage()) {
          return true;
        }
      }

      if (perf) {
        perf.layoutLeafMs += now() - leafStart;
      }

      return shouldStop;
    };
    // 容器块递归下钻，真正产出可绘制行的仍然是叶子块。
    const walkBlocks = (node, context) => {
      if (shouldStop) {
        return true;
      }
      const renderer = this.registry?.get(node.type.name);
      const isLeaf = isLeafLayoutNode(renderer, node);

      if (isLeaf) {
        return layoutLeafBlock(node, context);
      }
      const { nextContext } = resolveContainerLayoutContext({
        renderer,
        node,
        settings: baseSettings,
        registry: this.registry,
        context,
        baseX: rootMarginLeft,
      });

      for (let index = 0; index < node.childCount; index += 1) {
        const child = node.child(index);
        if (walkBlocks(child, nextContext)) {
          return true;
        }
        if (index < node.childCount - 1) {
          textOffset += 1;
        }
      }

      return shouldStop;
    };
    for (let index = startBlockIndex; index < doc.childCount; index += 1) {
      if (shouldStop) {
        break;
      }
      const block = doc.child(index);
      const renderer = this.registry?.get(block.type.name);
      const isLeaf = isLeafLayoutNode(renderer, block);
      if (walkBlocks(block, { indent: 0, containerStack: [], rootIndex: index })) {
        break;
      }
      if (!isLeaf && blockSpacing > 0 && index < doc.childCount - 1) {
        cursorY += blockSpacing;
        if (cursorY + lineHeight > pageHeight - margin.bottom) {
          if (finalizePage()) {
            break;
          }
        }
      }
      if (index < doc.childCount - 1) {
        textOffset += 1;
      }
      if (canSync && syncAfterIndex != null && index >= syncAfterIndex) {
        passedChangedRange = true;
      }
    }

    if (!shouldStop) {
      if (page.lines.length > 0) {
        syncCurrentPageBoxes();
        populatePageDerivedState(page);
        pages.push(page);
      }
      if (maybeSync()) {
      }
    }
    const finalPages = finalizeLayoutPages({
      pages,
      shouldStop,
      previousLayout,
      syncFromIndex,
      offsetDelta,
      appendGhostTrace,
      ghostTrace,
    });
    pages = finalPages.pages;
    if (perf) {
      perf.reusedPages = finalPages.reusedTailCount;
    }
    // 对外结果结构保持不变，最终高度仍按页高和页间距汇总。
    const totalHeight = pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;

    if (perf) {
      const summary = finalizeLayoutPerf({
        perf,
        now,
        pages,
        previousLayout,
        changeSummary,
        syncAfterIndex,
        canSync,
        passedChangedRange,
        syncFromIndex,
        resumeFromAnchor,
        resumeAnchorPageIndex,
        resumeAnchorLineIndex,
        resumeAnchorMatchKey,
        resumeAnchorSkippedReason,
        reusedPrefixPages,
        reusedPrefixLines,
      });
      if (baseSettingsRaw?.__perf) {
        baseSettingsRaw.__perf.layout = summary;
      }
      logLayout(`[layout-engine] perf:`, summary);
    }

    logLayout(`[layout-engine] DONE pages:${pages.length}, progressiveApplied:${progressiveApplied}, prevPages:${previousLayout?.pages?.length ?? 0}`);

    return {
      pages,
      pageHeight,
      pageWidth: baseSettings.pageWidth,
      pageGap,
      margin,
      lineHeight,
      font,
      totalHeight,
      __progressiveApplied: progressiveApplied,
      __progressiveTruncated: progressiveTruncated,
      __ghostTrace: ghostTrace,
    };
  }
  /**
   * 从纯文本快速生成布局结果，供简单场景复用。
   */
  layoutFromText(text) {
    return layoutFromTextWithSettings(this.settings, text);
  }
  /**
   * 从已经排好样式的 runs 直接生成布局结果。
   */
  layoutFromRuns(runs, totalLength) {
    return layoutFromRunsWithSettings(this.settings, runs, totalLength);
  }
}


