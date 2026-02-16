/*
 * Layout pipeline for pagination.
 */

import { docToRuns, textblockToRuns, textToRuns } from "./textRuns";
import { breakLines } from "./lineBreaker";

function newPage(index) {
  return { index, lines: [] };
}

const cloneLine = (line) => ({
  ...line,
  runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
});

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

export class LayoutPipeline {
  settings;
  registry;
  blockCache;

  constructor(settings, registry = null) {
    this.settings = settings;
    this.registry = registry;
    this.blockCache = new Map();
  }

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

  clearCache() {
    this.blockCache.clear();
  }

  layoutFromDoc(doc) {
    const baseSettings = this.settings;
    const { pageHeight, pageGap, margin, lineHeight, font } = baseSettings;
    const pages = [];
    let pageIndex = 0;
    let page = newPage(pageIndex);
    let cursorY = margin.top;
    let textOffset = 0;

    const rootMarginLeft = margin.left;

    const layoutLeafBlock = (block, context) => {
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

      const placeLines = (linesToPlace) => {
        linesToPlace.forEach((line, lineIndex) => {
          const lineCopy = cloneLine(line);
          lineCopy.blockType = lineCopy.blockType || block.type.name;
          lineCopy.blockId = lineCopy.blockId ?? blockId;
          lineCopy.blockAttrs = lineCopy.blockAttrs || blockAttrs;
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
        const availableHeight = pageHeight - margin.bottom - cursorY;
        if (page.lines.length > 0 && remainingHeight > availableHeight) {
          let splitResult = null;
          if (canSplit && availableHeight > 0) {
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
                const visibleLength =
                  typeof lastLine?.end === "number" ? lastLine.end : remainingLength;
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
            pages.push(page);
            pageIndex += 1;
            page = newPage(pageIndex);
            cursorY = margin.top;
            if (splitResult.overflow && splitResult.overflow.lines.length > 0) {
              remainingLines = splitResult.overflow.lines;
              remainingLength = splitResult.overflow.length;
              remainingHeight = splitResult.overflow.height;
              continue;
            }
            remainingLines = [];
            break;
          }
          pages.push(page);
          pageIndex += 1;
          page = newPage(pageIndex);
          cursorY = margin.top;
          continue;
        }
        placeLines(remainingLines);
        cursorY += remainingHeight;
        remainingLines = [];
      }

      textOffset += blockLength;

      if (cursorY + lineHeight > pageHeight - margin.bottom) {
        pages.push(page);
        pageIndex += 1;
        page = newPage(pageIndex);
        cursorY = margin.top;
      }
    };

    const walkBlocks = (node, context) => {
      const renderer = this.registry?.get(node.type.name);
      const isLeaf =
        renderer?.layoutBlock || renderer?.toRuns || node.isTextblock || node.isAtom;

      if (isLeaf) {
        layoutLeafBlock(node, context);
        return;
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
          }
        : context;

      node.forEach((child, _pos, index) => {
        walkBlocks(child, nextContext);
        if (index < node.childCount - 1) {
          textOffset += 1;
        }
      });
    };

    doc.forEach((block, _pos, index) => {
      walkBlocks(block, { indent: 0, containerStack: [] });
      if (index < doc.childCount - 1) {
        textOffset += 1;
      }
    });

    if (page.lines.length > 0) {
      pages.push(page);
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

  layoutFromText(text) {
    const { runs, length } = textToRuns(text, this.settings);
    return this.layoutFromRuns(runs, length);
  }

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
