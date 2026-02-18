/*
 * Layout pipeline for pagination.
 */

import { docToRuns, textblockToRuns, textToRuns } from "./textRuns";
import { breakLines } from "./lineBreaker";


type LayoutChangeSummary = {
  docChanged?: boolean;
  blocks?: {
    before?: { fromIndex?: number | null; toIndex?: number | null };
    after?: { fromIndex?: number | null; toIndex?: number | null };
  };
};

type LayoutResult = {
  pages: Array<{ lines: any[] }>;
  pageHeight: number;
  pageWidth: number;
  pageGap: number;
  margin: { left: number; right: number; top: number; bottom: number };
  lineHeight: number;
  font: string;
  totalHeight: number;
};

type LayoutFromDocOptions = {
  previousLayout?: LayoutResult | null;
  changeSummary?: LayoutChangeSummary | null;
  docPosToTextOffset?: (doc: any, pos: number) => number;
};

// 创建新的页面容器（索引 + 行列表）。
function newPage(index) {
  return { index, lines: [] };
}

// 克隆行对象，避免引用共享。
const cloneLine = (line) => ({
  ...line,
  runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
});

// 计算行的水平起始位置（对齐 + 缩进）。
const computeLineX = (line, settings) => {
  const { pageWidth, margin } = settings;
  const maxWidth = pageWidth - margin.left - margin.right;
  const align = line.blockAttrs?.align || "left";
  const indent = line.blockAttrs?.indent || 0;
  let x = margin.left;

  if (align === "center") {
    x += Math.max(0, (maxWidth - line.width) / 2);
  } else if (align === "right") {
    x += Math.max(0, maxWidth - line.width);
  }

  if (indent && line.blockStart === line.start) {
    x += indent;
  }

  return x;
};

// 将行内偏移从块内偏移转换为全局偏移。
const adjustLineOffsets = (line, blockStart) => {
  if (typeof line.start === "number") {
    line.start += blockStart;
  }

  if (typeof line.end === "number") {
    line.end += blockStart;
  }

  if (line.runs) {
    for (const run of line.runs) {
      if (typeof run.start === "number") {
        run.start += blockStart;
      }

      if (typeof run.end === "number") {
        run.end += blockStart;
      }
    }
  }

  if (line.blockStart == null) {
    line.blockStart = blockStart;
  }

  return line;
};

// 根据缩进生成新的布局设置。
const resolveSettingsWithIndent = (settings, indent) => {
  if (!indent) {
    return settings;
  }
  return {
    ...settings,
    margin: {
      ...settings.margin,
      left: settings.margin.left + indent,
    },
  };
};


// 数值哈希，用于页签名。
const hashNumber = (hash, value) => {
  const num = Number.isFinite(value) ? Math.round(value) : 0;
  return (hash * 31 + num) | 0;
};

// 字符串哈希，用于页签名。
const hashString = (hash, value) => {
  if (!value) {
    return hash;
  }
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
};

// 生成页面签名，用于页级对齐判断。
const getPageSignature = (page) => {
  let hash = 0;
  if (!page?.lines) {
    return hash;
  }
  for (const line of page.lines) {
    hash = hashNumber(hash, line.start);
    hash = hashNumber(hash, line.end);
    hash = hashNumber(hash, line.x);
    hash = hashNumber(hash, line.y);
    hash = hashNumber(hash, line.width);
    hash = hashNumber(hash, line.lineHeight);
    hash = hashString(hash, line.blockType || "");
    hash = hashString(hash, line.blockId || "");
    hash = hashString(hash, line.text || "");
    if (line.runs) {
      for (const run of line.runs) {
        hash = hashNumber(hash, run.start);
        hash = hashNumber(hash, run.end);
        hash = hashString(hash, run.text || "");
        hash = hashString(hash, run.font || "");
        hash = hashString(hash, run.color || "");
        hash = hashNumber(hash, run.underline ? 1 : 0);
      }
    }
  }
  return hash;
};

// 判断两个页面是否等价（行数 + 签名）。
const arePagesEquivalent = (nextPage, prevPage) => {
  if (!nextPage || !prevPage) {
    return false;
  }
  const nextLines = nextPage.lines || [];
  const prevLines = prevPage.lines || [];
  if (nextLines.length !== prevLines.length) {
    return false;
  }
  return getPageSignature(nextPage) === getPageSignature(prevPage);
};

// 在旧布局中查找块锚点（rootIndex/blockId/blockStart）。
const findBlockAnchor = (layout, options) => {
  if (!layout?.pages?.length) {
    return null;
  }
  const rootIndex = options?.rootIndex;
  const blockId = options?.blockId;
  const blockStart = options?.blockStart;
  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      if (Number.isFinite(rootIndex) && line.rootIndex === rootIndex) {
        return { pageIndex: p, lineIndex: l, line };
      }
      if (blockId && line.blockId === blockId) {
        return { pageIndex: p, lineIndex: l, line };
      }
      if (Number.isFinite(blockStart) && line.blockStart === blockStart) {
        return { pageIndex: p, lineIndex: l, line };
      }
    }
  }
  return null;
};

// 计算根级块的起始文档位置。
const getDocChildStartPos = (doc, targetIndex) => {
  let pos = 0;
  for (let i = 0; i < targetIndex && i < doc.childCount; i += 1) {
    pos += doc.child(i).nodeSize;
  }
  return pos;
};

export class LayoutPipeline {
  settings;
  registry;
  blockCache;

  // 初始化分页布局管线。
  constructor(settings, registry = null) {
    this.settings = settings;
    this.registry = registry;
    this.blockCache = new Map();
  }

  // 根据 block id 清理缓存。
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

  // 清空布局缓存。
  clearCache() {
    this.blockCache.clear();
  }


  // 分页布局主入口：生成 layout，支持增量复用。
  layoutFromDoc(doc, options: LayoutFromDocOptions = {}) {
    // 分页布局主入口：从文档生成 pages/lines，并在可对齐时做增量复用。
    const baseSettings = this.settings;
    const { pageHeight, pageGap, margin, lineHeight, font } = baseSettings;
    const rootMarginLeft = margin.left;

    const previousLayout = options?.previousLayout ?? null;
    const changeSummary = options?.changeSummary ?? null;
    const docPosToTextOffset = options?.docPosToTextOffset ?? null;

    let pages = [];
    let pageIndex = 0;
    let page = newPage(pageIndex);
    let cursorY = margin.top;
    let textOffset = 0;

    let startBlockIndex = 0;
    let syncAfterIndex = null;
    let canSync = false;
    let passedChangedRange = false;
    let shouldStop = false;
    let syncFromIndex = null;

    // 尝试增量布局：定位变更起点，计算可复用的起始页。
    // 尝试增量布局：定位变更起点，计算可复用的起始页。
    if (previousLayout && changeSummary?.docChanged && typeof docPosToTextOffset === "function") {
      const settingsMatch =
        previousLayout.pageHeight === pageHeight &&
        previousLayout.pageWidth === baseSettings.pageWidth &&
        previousLayout.pageGap === pageGap &&
        previousLayout.lineHeight === lineHeight &&
        previousLayout.margin?.left === margin.left &&
        previousLayout.margin?.right === margin.right &&
        previousLayout.margin?.top === margin.top &&
        previousLayout.margin?.bottom === margin.bottom;

      if (settingsMatch && previousLayout.pages?.length) {
        const before = changeSummary.blocks?.before || {};
        const after = changeSummary.blocks?.after || {};
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
          Number.isFinite(startIndexOld) &&
          Number.isFinite(startIndexNew) &&
          startIndexNew < doc.childCount
        ) {
          const blockPos = getDocChildStartPos(doc, startIndexNew);
          const startOffset = docPosToTextOffset(doc, blockPos);
          const blockNode = doc.child(startIndexNew);
          const blockId = blockNode?.attrs?.id ?? null;
          const anchor = findBlockAnchor(previousLayout, {
            rootIndex: startIndexOld,
            blockId,
            blockStart: startOffset,
          });

          if (anchor) {
            pages = previousLayout.pages.slice(0, anchor.pageIndex);
            pageIndex = anchor.pageIndex;
            page = newPage(pageIndex);
            page.lines = previousLayout.pages[anchor.pageIndex].lines.slice(0, anchor.lineIndex);
            cursorY = Number.isFinite(anchor.line?.y) ? anchor.line.y : margin.top;
            textOffset = Number.isFinite(startOffset) ? startOffset : 0;
            startBlockIndex = startIndexNew;
            syncAfterIndex = Number.isFinite(lastIndexNew) ? lastIndexNew : null;
            canSync = Number.isFinite(syncAfterIndex);
            passedChangedRange = canSync && startBlockIndex > syncAfterIndex;
          }
        }
      }
    }

    // 尝试页级对齐并决定是否复用剩余页。
    const maybeSync = () => {
      // 需要变更区已处理完且布局设置不变。
      if (!canSync || !passedChangedRange || !previousLayout) {
        return false;
      }
      const oldPage = previousLayout.pages?.[pageIndex];
      if (!oldPage) {
        return false;
      }
      if (!arePagesEquivalent(page, oldPage)) {
        return false;
      }
      syncFromIndex = pageIndex;
      shouldStop = true;
      return true;
    };

    // 封装收页逻辑，必要时触发对齐复用。
    const finalizePage = () => {
      pages.push(page);
      if (maybeSync()) {
        return true;
      }
      pageIndex += 1;
      page = newPage(pageIndex);
      cursorY = margin.top;
      return false;
    };

    // 布局叶子块，输出行并处理分页拆分。
    const layoutLeafBlock = (block, context) => {
      if (shouldStop) {
        return true;
      }

      const renderer = this.registry?.get(block.type.name);
      const blockId = block.attrs?.id ?? null;
      const blockSettings = resolveSettingsWithIndent(baseSettings, context.indent);

      let blockLines = [];
      let blockLength = 0;
      let blockHeight = 0;
      let blockAttrs = block.attrs || null;
      let blockLineHeight = null;

      const cacheKey = blockId != null ? `${blockId}:${context.indent}` : null;
      const rendererCacheable = renderer?.cacheLayout !== false;
      const canUseCache = rendererCacheable && cacheKey !== null;
      const cached = canUseCache ? this.blockCache.get(cacheKey) : null;

      if (cached && cached.node === block) {
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
        if (renderer?.layoutBlock) {
          const result = renderer.layoutBlock({
            node: block,
            availableHeight: pageHeight - margin.bottom - cursorY,
            measureTextWidth: baseSettings.measureTextWidth,
            settings: blockSettings,
            registry: this.registry,
            indent: context.indent,
            containerStack: context.containerStack,
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
            ? renderer.toRuns(block, blockSettings, this.registry)
            : block.isTextblock
              ? textblockToRuns(
                  block,
                  blockSettings,
                  block.type.name,
                  blockId,
                  block.attrs,
                  0
                )
              : docToRuns(block, blockSettings, this.registry);

          const { runs, length } = runsResult;
          blockLength = length;
          if (runsResult?.blockAttrs) {
            blockAttrs = runsResult.blockAttrs;
          }
          if (runsResult?.blockAttrs?.lineHeight) {
            blockLineHeight = runsResult.blockAttrs.lineHeight;
          }

          blockLines = breakLines(
            runs,
            blockSettings.pageWidth - blockSettings.margin.left - blockSettings.margin.right,
            blockSettings.font,
            length,
            blockSettings.wrapTolerance || 0,
            blockSettings.minLineWidth || 0,
            blockSettings.measureTextWidth,
            blockSettings.segmentText
          );
          blockHeight = blockLines.length * (blockLineHeight || lineHeight);
        }

        if (canUseCache) {
          this.blockCache.set(cacheKey, {
            node: block,
            lines: blockLines,
            length: blockLength,
            height: blockHeight,
            blockAttrs,
            blockLineHeight,
          });
        }
      }

      const lineHeightValue = blockLineHeight || lineHeight;
      const canSplit = renderer?.allowSplit ?? !renderer?.layoutBlock;
      const splitBlock = renderer?.splitBlock;
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
          : safeLines.length * lineHeightValue;

      const blockStart = textOffset;
      const containerStack = context.containerStack;

      // 将行写入当前页并补齐坐标、偏移、容器信息。
      const placeLines = (linesToPlace) => {
        linesToPlace.forEach((line, lineIndex) => {
          const lineCopy = cloneLine(line);
          lineCopy.blockType = lineCopy.blockType || block.type.name;
          lineCopy.blockId = lineCopy.blockId ?? blockId;
          lineCopy.blockAttrs = lineCopy.blockAttrs || blockAttrs;
          lineCopy.rootIndex = context.rootIndex;
          adjustLineOffsets(lineCopy, blockStart);
          if (typeof lineCopy.relativeY === "number") {
            lineCopy.y = cursorY + lineCopy.relativeY;
          } else {
            lineCopy.y = cursorY + lineIndex * lineHeightValue;
          }
          lineCopy.lineHeight = lineHeightValue;
          if (typeof lineCopy.x !== "number") {
            lineCopy.x = computeLineX(lineCopy, blockSettings);
          }
          if (containerStack.length) {
            lineCopy.containers = containerStack;
          }
          page.lines.push(lineCopy);
        });
      };

      while (remainingLines.length > 0) {
        if (shouldStop) {
          return true;
        }
        const availableHeight = pageHeight - margin.bottom - cursorY;
        if (remainingHeight > availableHeight) {
          let splitResult = null;
          if (canSplit) {
            if (splitBlock) {
              splitResult = splitBlock({
                node: block,
                lines: remainingLines,
                length: remainingLength,
                height: remainingHeight,
                availableHeight,
                lineHeight: lineHeightValue,
                settings: blockSettings,
                registry: this.registry,
                indent: context.indent,
                containerStack,
              });
            }
            if (!splitResult) {
              const maxLines = Math.max(1, Math.floor(availableHeight / lineHeightValue));
              if (maxLines < remainingLines.length) {
                const visibleLines = remainingLines.slice(0, maxLines);
                const lastLine = visibleLines[visibleLines.length - 1];
                const firstLine = visibleLines[0];
                const startOffset = typeof firstLine?.start === "number" ? firstLine.start : 0;
                const endOffset =
                  typeof lastLine?.end === "number" ? lastLine.end : remainingLength;
                const visibleLength = Math.max(0, endOffset - startOffset);
                const visibleHeight = visibleLines.length * lineHeightValue;
                const overflowLines = remainingLines.slice(maxLines);
                const overflowLength = Math.max(0, remainingLength - visibleLength);
                const overflowHeight = overflowLines.length * lineHeightValue;
                splitResult = {
                  lines: visibleLines,
                  length: visibleLength,
                  height: visibleHeight,
                  overflow: {
                    lines: overflowLines,
                    length: overflowLength,
                    height: overflowHeight,
                  },
                };
              }
            }
          }
          if (splitResult && splitResult.lines.length > 0) {
            placeLines(splitResult.lines);
            cursorY += splitResult.height;
            if (finalizePage()) {
              return true;
            }
            if (splitResult.overflow && splitResult.overflow.lines.length > 0) {
              remainingLines = splitResult.overflow.lines;
              remainingLength = splitResult.overflow.length;
              remainingHeight = splitResult.overflow.height;
              continue;
            }
            remainingLines = [];
            break;
          }
          if (finalizePage()) {
            return true;
          }
          continue;
        }
        placeLines(remainingLines);
        cursorY += remainingHeight;
        remainingLines = [];
      }

      textOffset += blockLength;

      if (cursorY + lineHeight > pageHeight - margin.bottom) {
        if (finalizePage()) {
          return true;
        }
      }

      return shouldStop;
    };

    // 遍历容器节点，维护缩进与容器样式栈。
    const walkBlocks = (node, context) => {
      if (shouldStop) {
        return true;
      }
      const renderer = this.registry?.get(node.type.name);
      const isLeaf =
        renderer?.layoutBlock || renderer?.toRuns || node.isTextblock || node.isAtom;

      if (isLeaf) {
        return layoutLeafBlock(node, context);
      }

      const style = renderer?.getContainerStyle
        ? renderer.getContainerStyle({ node, settings: baseSettings, registry: this.registry })
        : null;

      const indent = Number.isFinite(style?.indent) ? style.indent : 0;
      const shouldPush = indent > 0 || renderer?.renderContainer || style;

      const nextContext = shouldPush
        ? {
            indent: context.indent + indent,
            containerStack: [
              ...context.containerStack,
              {
                ...style,
                type: node.type.name,
                offset: context.indent,
                indent,
                baseX: rootMarginLeft + context.indent,
              },
            ],
            rootIndex: context.rootIndex,
          }
        : context;

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

    // 从变更起点开始重排，必要时继续到文档末尾。
    for (let index = startBlockIndex; index < doc.childCount; index += 1) {
      if (shouldStop) {
        break;
      }
      const block = doc.child(index);
      if (walkBlocks(block, { indent: 0, containerStack: [], rootIndex: index })) {
        break;
      }
      if (index < doc.childCount - 1) {
        textOffset += 1;
      }
      if (canSync && syncAfterIndex != null && index >= syncAfterIndex) {
        passedChangedRange = true;
      }
    }

    if (!shouldStop && page.lines.length > 0) {
      pages.push(page);
    }

    if (shouldStop && previousLayout && syncFromIndex != null) {
      pages.push(...previousLayout.pages.slice(syncFromIndex + 1));
    }

    const totalHeight = pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;

    return {
      pages,
      pageHeight,
      pageWidth: baseSettings.pageWidth,
      pageGap,
      margin,
      lineHeight,
      font,
      totalHeight,
    };
  }

  // 纯文本布局入口。
  layoutFromText(text) {
    const { runs, length } = textToRuns(text, this.settings);
    return this.layoutFromRuns(runs, length);
  }

  // 运行级布局入口（直接从 runs 断行分页）。
  layoutFromRuns(runs, totalLength) {
    const { pageHeight, pageGap, margin, lineHeight, font } = this.settings;
    const maxWidth = this.settings.pageWidth - margin.left - margin.right;

    const lines = breakLines(
      runs,
      maxWidth,
      font,
      totalLength,
      this.settings.wrapTolerance || 0,
      this.settings.minLineWidth || 0,
      this.settings.measureTextWidth,
      this.settings.segmentText
    );

    const pages = [];
    let pageIndex = 0;
    let page = newPage(pageIndex);
    let y = margin.top;

    for (const line of lines) {
      page.lines.push({
        ...line,
        x: computeLineX(line, this.settings),
        y,
      });

      y += lineHeight;

      if (y + lineHeight > pageHeight - margin.bottom) {
        pages.push(page);
        pageIndex += 1;
        page = newPage(pageIndex);
        y = margin.top;
      }
    }

    if (page.lines.length > 0) {
      pages.push(page);
    }

    const totalHeight = pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;

    return {
      pages,
      pageHeight,
      pageWidth: this.settings.pageWidth,
      pageGap,
      margin,
      lineHeight,
      font,
      totalHeight,
    };
  }
}
