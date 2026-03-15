/**
 * 根据 blockId、blockStart 和 rootIndex 为候选行打分，用于锚点恢复。
 */
export function getAnchorMatch(line: any, options: any) {
  if (!line) {
    return null;
  }
  const rootIndex = options?.rootIndex;
  const blockId = options?.blockId;
  const blockStart = options?.blockStart;
  const blockIdMatches = !!blockId && line.blockId === blockId;
  const blockStartMatches =
    Number.isFinite(blockStart) && Number.isFinite(line.blockStart) && line.blockStart === blockStart;
  const rootIndexMatches =
    Number.isFinite(rootIndex) && Number.isFinite(line.rootIndex) && line.rootIndex === rootIndex;
  const score =
    (blockIdMatches ? 8 : 0) + (blockStartMatches ? 4 : 0) + (rootIndexMatches ? 2 : 0);
  if (score <= 0) {
    return null;
  }
  const matchKey = [
    blockIdMatches ? "blockId" : null,
    blockStartMatches ? "blockStart" : null,
    rootIndexMatches ? "rootIndex" : null,
  ]
    .filter(Boolean)
    .join("+");
  return {
    score,
    matchKey: matchKey || "unknown",
    blockIdMatches,
    blockStartMatches,
    rootIndexMatches,
  };
}

/**
 * 在旧布局中查找最适合作为同步起点的 block 锚点。
 */
export function findBlockAnchor(layout: any, options: any) {
  if (!layout?.pages?.length) {
    return null;
  }
  let bestMatch = null;
  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      const match = getAnchorMatch(line, options);
      if (!match) {
        continue;
      }
      if (!bestMatch || match.score > bestMatch.match.score) {
        bestMatch = { pageIndex: p, lineIndex: l, line, match };
      }
    }
  }
  return bestMatch;
}

/**
 * 在旧布局中查找某个 block 的第一次出现位置，用于锚点回退。
 */
export function findBlockFirstOccurrence(layout: any, options: any) {
  if (!layout?.pages?.length) {
    return null;
  }
  let bestMatch = null;
  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      const match = getAnchorMatch(line, options);
      if (!match) {
        continue;
      }
      if (!bestMatch || match.score > bestMatch.match.score) {
        bestMatch = { pageIndex: p, lineIndex: l, line, match };
      }
    }
  }
  return bestMatch;
}

/**
 * 计算文档中某个顶层 child 的起始位置。
 */
export function getDocChildStartPos(doc: any, targetIndex: number) {
  let pos = 0;
  for (let i = 0; i < targetIndex && i < doc.childCount; i += 1) {
    pos += doc.child(i).nodeSize;
  }
  return pos;
}
