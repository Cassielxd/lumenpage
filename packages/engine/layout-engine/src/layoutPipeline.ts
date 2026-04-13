/**
 * 布局主流程的过渡入口。
 * 当前这里仍负责文档递归、分页控制和页复用主循环，
 * 纯几何、签名与文本折行能力已经逐步下沉到 engine/ 目录。
 */
import {
  applyIncrementalBootstrap,
  resolveIncrementalBootstrapState,
} from "./engine/incrementalBootstrap.js";
import { completeLayoutRun } from "./engine/layoutCompletion.js";
import { createLayoutInstrumentation } from "./engine/layoutInstrumentation.js";
import { resolveLayoutRunConfig } from "./engine/layoutRunConfig.js";
import { createLayoutPipelineSession } from "./engine/layoutSession.js";
import { createLayoutTraversalController } from "./engine/layoutTraversal.js";
import { createLayoutPageLifecycle } from "./engine/pageLifecycle.js";
import { resolveDisablePageReuse } from "./engine/reuseDecision.js";
import type { LayoutFromDocOptions } from "./engine/types.js";
import {
  ENABLE_CROSS_PAGE_CANDIDATE_REUSE,
  ENABLE_RESUME_FROM_ANCHOR_REUSE,
} from "./engine/pageReuseFlags.js";
import { appendGhostTrace, isGhostTraceEnabled } from "./engine/pageReuseTrace.js";
import { populatePageDerivedState } from "./engine/pageState.js";
import { layoutFromRunsWithSettings, layoutFromTextWithSettings } from "./engine/textLayout.js";

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
    let disablePageReuse = resolveDisablePageReuse({
      doc,
      baseSettingsRaw,
      previousLayout: options?.previousLayout ?? null,
      changeSummary: options?.changeSummary ?? null,
      registry: this.registry,
    });
    const ghostTraceEnabled = isGhostTraceEnabled(baseSettingsRaw);
    const ghostTrace = ghostTraceEnabled ? [] : null;
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
    const {
      perf,
      measureTextWidth,
      baseSettings,
      logLayout,
    } = createLayoutInstrumentation({
      baseSettingsRaw,
      now,
    });
    // 这一组局部状态会随着分页推进不断变化，是整个主循环的共享上下文。
    const { pageHeight, pageGap, margin, lineHeight, font } = baseSettings;
    const blockSpacing = Number.isFinite(baseSettings.blockSpacing) ? baseSettings.blockSpacing : 0;
    const rootMarginLeft = margin.left;
    const {
      previousLayout,
      changeSummary,
      docPosToTextOffset,
      cascadePagination,
      cascadeFromPageIndex,
      cascadeMaxPages,
      cascadeStopPageIndex,
    } = resolveLayoutRunConfig({
      options,
      baseSettingsRaw,
      disablePageReuse,
      perf,
    });
    void cascadeMaxPages;
    const session = createLayoutPipelineSession({
      marginTop: margin.top,
    });
    let resumeAnchorPageIndex = null;
    let resumeAnchorLineIndex = null;
    let resumeAnchorMatchKey = null;
    let resumeAnchorSkippedReason = null;
    let reusedPrefixPages = 0;
    let reusedPrefixLines = 0;
    const incrementalBootstrap = resolveIncrementalBootstrapState({
      previousLayout,
      changeSummary,
      doc,
      docPosToTextOffset,
      enabled: ENABLE_RESUME_FROM_ANCHOR_REUSE,
      pageHeight,
      pageWidth: baseSettings.pageWidth,
      pageGap,
      lineHeight,
      margin,
    });
    const {
      previousPageReuseIndex,
      previousPageFirstBlockIdIndex,
      previousPageSignatureIndex,
      offsetDelta,
    } = incrementalBootstrap;
    const pageLifecycle = createLayoutPageLifecycle({
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
      candidateReuseEnabled: ENABLE_CROSS_PAGE_CANDIDATE_REUSE,
      pageReuseProbeRadius: baseSettings?.pageReuseProbeRadius,
      pageReuseRootIndexProbeRadius: baseSettings?.pageReuseRootIndexProbeRadius,
      cascadePagination,
      cascadeFromPageIndex,
      cascadeStopPageIndex,
      marginTop: margin.top,
    });
    const syncCurrentPageBoxes = () => pageLifecycle.syncCurrentPageBoxes();
    const setCurrentPage = (nextPage, seedLines = null) =>
      pageLifecycle.setCurrentPage(nextPage, seedLines);
    ({
      resumeAnchorPageIndex,
      resumeAnchorLineIndex,
      resumeAnchorMatchKey,
      resumeAnchorSkippedReason,
      reusedPrefixPages,
      reusedPrefixLines,
    } = applyIncrementalBootstrap({
      bootstrap: incrementalBootstrap,
      previousLayout,
      session,
      setCurrentPage,
      appendGhostTrace,
      ghostTrace,
      logLayout,
    }));
    const { maybeSync, finalizePage } = pageLifecycle;
    const traversalController = createLayoutTraversalController({
      session,
      registry: this.registry,
      baseSettings,
      blockCache: this.blockCache,
      measureTextWidth,
      perf,
      now,
      logLayout,
      blockSpacing,
      rootMarginLeft,
      pageHeight,
      margin,
      lineHeight,
      finalizePage,
    });
    traversalController.walkRootBlocks(doc);

    if (!session.shouldStop) {
      if (session.page.lines.length > 0) {
        syncCurrentPageBoxes();
        populatePageDerivedState(session.page);
        session.pages.push(session.page);
      }
      if (maybeSync()) {
      }
    }
    return completeLayoutRun({
      session,
      pageHeight,
      pageGap,
      pageWidth: baseSettings.pageWidth,
      margin,
      lineHeight,
      font,
      previousLayout,
      changeSummary,
      offsetDelta,
      appendGhostTrace,
      ghostTrace,
      perf,
      now,
      baseSettingsRaw,
      resumeAnchorPageIndex,
      resumeAnchorLineIndex,
      resumeAnchorMatchKey,
      resumeAnchorSkippedReason,
      reusedPrefixPages,
      reusedPrefixLines,
      logLayout,
    });
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


