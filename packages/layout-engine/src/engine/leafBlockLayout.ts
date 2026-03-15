import { docToRuns, textblockToRuns } from "../textRuns";
import { getBlockLayoutSignature } from "./signature";
import { breakRunsWithSettings } from "./textLayout";

type ResolveLeafBlockLayoutOptions = {
  block: any;
  blockId: string | null;
  blockSettings: any;
  renderer: any;
  registry: any;
  indent: number;
  containerStack: any[];
  availableHeight: number;
  lineHeight: number;
  blockCache: Map<string, any>;
  measureTextWidth: (font: string, text: string) => number;
  perf: { cachedBlocks: number; breakLinesMs: number } | null;
  now: () => number;
  logLayout: (...args: any[]) => void;
};

type LeafBlockLayoutResult = {
  blockLines: any[];
  blockLength: number;
  blockHeight: number;
  blockAttrs: any;
  blockLineHeight: number | null;
  blockSignature: number;
};

/**
 * 解析叶子块的实际布局内容，统一处理缓存命中、自定义 layoutBlock 和文本折行。
 */
export function resolveLeafBlockLayout({
  block,
  blockId,
  blockSettings,
  renderer,
  registry,
  indent,
  containerStack,
  availableHeight,
  lineHeight,
  blockCache,
  measureTextWidth,
  perf,
  now,
  logLayout,
}: ResolveLeafBlockLayoutOptions): LeafBlockLayoutResult {
  let blockLines = [];
  let blockLength = 0;
  let blockHeight = 0;
  let blockAttrs = block.attrs || null;
  let blockLineHeight = null;

  const cacheKey = blockId != null ? `${blockId}:${indent}` : null;
  const rendererCacheable = renderer?.cacheLayout !== false;
  const canUseCache = rendererCacheable && cacheKey !== null;

  if (blockId === "docblk-00001") {
    logLayout(`[layout-cache] Cache stats at start: ${blockCache?.size || 0} entries`);
  }

  const cached = canUseCache ? blockCache.get(cacheKey) : null;
  logLayout(
    `[layout-cache] blockId=${blockId}, indent=${indent}, cacheKey=${cacheKey}, canUseCache=${canUseCache}, hasCached=${!!cached}`
  );

  const blockSignature = getBlockLayoutSignature(block, blockSettings, indent, renderer, registry);

  if (canUseCache) {
    if (cached && cached.signature === blockSignature) {
      if (perf) {
        perf.cachedBlocks += 1;
      }
      logLayout(`[layout-cache] HIT: blockId=${blockId}, signature=${blockSignature}`);
      blockLines = cached.lines || [];
      blockLength = cached.length || 0;
      blockHeight = cached.height || 0;
      if (cached.blockAttrs) {
        blockAttrs = cached.blockAttrs;
      }
      if (cached.blockLineHeight) {
        blockLineHeight = cached.blockLineHeight;
      }
    } else {
      logLayout(
        `[layout-cache] MISS: blockId=${blockId}, hasCached=${!!cached}, cachedSig=${cached?.signature}, newSig=${blockSignature}`
      );
    }
  }

  if (!canUseCache || !cached || cached.signature !== blockSignature) {
    if (renderer?.layoutBlock) {
      const result = renderer.layoutBlock({
        node: block,
        availableHeight,
        measureTextWidth,
        settings: blockSettings,
        registry,
        indent,
        containerStack,
      });
      blockLines = result?.lines || [];
      blockLength = result?.length || 0;
      blockHeight = result?.height || 0;
      if (result?.blockAttrs) {
        blockAttrs = result.blockAttrs;
      }
      if (result?.blockAttrs?.lineHeight) {
        blockLineHeight = result.blockAttrs.lineHeight;
      }
    } else {
      const runsResult = renderer?.toRuns
        ? renderer.toRuns(block, blockSettings, registry)
        : block.isTextblock
          ? textblockToRuns(block, blockSettings, block.type.name, blockId, block.attrs, 0, registry)
          : docToRuns(block, blockSettings, registry);

      const { runs, length } = runsResult;
      blockLength = length;
      if (runsResult?.blockAttrs) {
        blockAttrs = runsResult.blockAttrs;
      }
      if (runsResult?.blockAttrs?.lineHeight) {
        blockLineHeight = runsResult.blockAttrs.lineHeight;
      }
      const breakBaseLineHeight = Number.isFinite(blockLineHeight)
        ? Number(blockLineHeight)
        : lineHeight;

      const breakStart = perf ? now() : 0;
      const textLayout = breakRunsWithSettings(blockSettings, runs, length, {
        lineHeightOverride: breakBaseLineHeight,
        measureTextWidth,
      });
      blockLines = textLayout.lines;
      blockHeight = textLayout.height;
      if (perf) {
        perf.breakLinesMs += now() - breakStart;
      }
    }

    if (canUseCache) {
      logLayout(
        `[layout-cache] SET: blockId=${blockId}, cacheKey=${cacheKey}, signature=${blockSignature}`
      );
      blockCache.set(cacheKey, {
        signature: blockSignature,
        lines: blockLines,
        length: blockLength,
        height: blockHeight,
        blockAttrs,
        blockLineHeight,
      });
    }
  }

  return {
    blockLines,
    blockLength,
    blockHeight,
    blockAttrs,
    blockLineHeight,
    blockSignature,
  };
}
