import { getOrBuildPageReuseIndex } from "./pageReuse";

/**
 * 计算本次文档变更带来的文本偏移增量，用于复用旧页时校正 absolute offset。
 */
export function resolveLayoutOffsetDelta(changeSummary: any) {
  return changeSummary?.docChanged && changeSummary?.oldRange && changeSummary?.newRange
    ? Number(changeSummary.newRange.to - changeSummary.newRange.from) -
        Number(changeSummary.oldRange.to - changeSummary.oldRange.from)
    : 0;
}

/**
 * 为旧布局准备页复用索引，减少后续候选页搜索成本。
 */
export function resolvePreviousPageReuseState(previousLayout: any) {
  const previousPageReuseIndex = previousLayout?.pages?.length
    ? getOrBuildPageReuseIndex(previousLayout)
    : null;

  return {
    previousPageReuseIndex,
    previousPageFirstBlockIdIndex: previousPageReuseIndex?.firstBlockIdIndex ?? null,
    previousPageSignatureIndex: previousPageReuseIndex?.signatureIndex ?? null,
  };
}
