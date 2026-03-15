import { breakLines } from "../lineBreaker";
import { createPageBoxCollector } from "../pageBoxes";
import { textToRuns } from "../textRuns";
import { computeLineX, measureLinesHeight, resolveLineHeight } from "./lineLayout";
import { newPage, populatePageDerivedState } from "./pageState";

/**
 * 从已经分好样式的文本 runs 生成简单布局结果。
 */
export function breakRunsWithSettings(
  settings: any,
  runs: any[],
  totalLength: number,
  options: {
    lineHeightOverride?: number;
    measureTextWidth?: (font: string, text: string) => number;
  } = {}
) {
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const baseLineHeight = Number.isFinite(options.lineHeightOverride)
    ? Number(options.lineHeightOverride)
    : settings.lineHeight;
  const lines = breakLines(
    runs,
    maxWidth,
    settings.font,
    totalLength,
    settings.wrapTolerance || 0,
    settings.minLineWidth || 0,
    options.measureTextWidth || settings.measureTextWidth,
    settings.segmentText,
    baseLineHeight
  );

  return {
    lines,
    lineHeight: baseLineHeight,
    height: measureLinesHeight(lines, baseLineHeight),
  };
}

/**
 * 从已经排好样式的 runs 直接生成简单分页结果。
 */
export function layoutFromRunsWithSettings(settings: any, runs: any[], totalLength: number) {
  const { pageHeight, pageGap, margin, lineHeight, font } = settings;
  const { lines } = breakRunsWithSettings(settings, runs, totalLength);

  const pages = [];
  let pageIndex = 0;
  let page = newPage(pageIndex);
  let pageBoxCollector = createPageBoxCollector();
  let y = margin.top;

  for (const line of lines) {
    const lineHeightValue = resolveLineHeight(line, lineHeight);
    if (page.lines.length > 0 && y + lineHeightValue > pageHeight - margin.bottom) {
      page.boxes = pageBoxCollector.finalize();
      populatePageDerivedState(page);
      pages.push(page);
      pageIndex += 1;
      page = newPage(pageIndex);
      pageBoxCollector = createPageBoxCollector();
      y = margin.top;
    }
    const placedLine = {
      ...line,
      lineHeight: lineHeightValue,
      x: computeLineX(line, settings),
      y,
    };
    page.lines.push(placedLine);
    pageBoxCollector.consumeLine(placedLine);
    y += lineHeightValue;
  }

  if (page.lines.length > 0) {
    page.boxes = pageBoxCollector.finalize();
    populatePageDerivedState(page);
    pages.push(page);
  }

  const totalHeight = pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;

  return {
    pages,
    pageHeight,
    pageWidth: settings.pageWidth,
    pageGap,
    margin,
    lineHeight,
    font,
    totalHeight,
  };
}

/**
 * 从纯文本快速生成布局结果，内部会先转换成文本 runs。
 */
export function layoutFromTextWithSettings(settings: any, text: string) {
  const { runs, length } = textToRuns(text, settings);
  return layoutFromRunsWithSettings(settings, runs, length);
}
