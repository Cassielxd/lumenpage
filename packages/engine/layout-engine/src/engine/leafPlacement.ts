import { adjustFragmentOwners, adjustLineOffsets, cloneLine, computeLineX, resolveLineHeight } from "./lineLayout.js";

type PlaceLeafLinesOptions = {
  linesToPlace: any[];
  lineHeightValue: number;
  block: any;
  blockId: string | null;
  blockSignature: number | null;
  blockAttrs: any;
  blockStart: number;
  rootIndex: number | null | undefined;
  blockSettings: any;
  containerStack: any[];
  cursorY: number;
  page: any;
  pageBoxCollector: any;
  perf: { lines: number } | null;
  ensureBlockFragmentOwner: (options: {
    line: any;
    node: any;
    blockId: string | null;
    blockStart: number;
    blockAttrs: any;
  }) => any[];
  appendPageReuseSignature: (page: any, line: any) => void;
};

type ForceFirstLeafLineOptions = {
  remainingLines: any[];
  remainingLength: number;
  remainingHeight: number;
  lineHeightValue: number;
  consumeForcedFirstLine: (options: {
    remainingLines: any[];
    remainingLength: number;
    remainingHeight: number;
    lineHeightValue: number;
  }) => {
    line: any;
    height: number;
    nextLines: any[];
    nextLength: number;
    nextHeight: number;
  } | null;
  placeLines: (linesToPlace: any[]) => void;
};

/**
 * 把一组相对块坐标的行落到当前页面，并同步写回复用签名与 box 收集器。
 */
export function placeLeafLinesOnPage({
  linesToPlace,
  lineHeightValue,
  block,
  blockId,
  blockSignature,
  blockAttrs,
  blockStart,
  rootIndex,
  blockSettings,
  containerStack,
  cursorY,
  page,
  pageBoxCollector,
  perf,
  ensureBlockFragmentOwner,
  appendPageReuseSignature,
}: PlaceLeafLinesOptions) {
  const seenListItems = new Set<string>();
  let relativeCursor = 0;

  for (const line of linesToPlace) {
    const lineCopy = cloneLine(line);
    const resolvedLineHeight = resolveLineHeight(lineCopy, lineHeightValue);
    lineCopy.blockType = lineCopy.blockType || block.type.name;
    lineCopy.blockId = lineCopy.blockId ?? blockId;
    lineCopy.blockSignature =
      Number.isFinite(blockSignature) && Number(blockSignature) > 0 ? Number(blockSignature) : null;
    lineCopy.blockAttrs = lineCopy.blockAttrs || blockAttrs;
    lineCopy.rootIndex = rootIndex;
    adjustLineOffsets(lineCopy, blockStart);

    if (lineCopy.blockAttrs?.listOwnerType || lineCopy.blockAttrs?.listType) {
      const itemIndex =
        lineCopy.blockAttrs?.listOwnerItemIndex ?? lineCopy.blockAttrs?.itemIndex ?? null;
      const itemStart =
        lineCopy.blockAttrs?.listOwnerItemStart ??
        lineCopy.blockAttrs?.listItemStart ??
        lineCopy.blockStart ??
        null;
      const key = `${lineCopy.blockAttrs?.listOwnerType ?? lineCopy.blockAttrs?.listType ?? "list"}:${itemStart ?? "0"}:${itemIndex ?? "0"}`;
      if (!seenListItems.has(key)) {
        seenListItems.add(key);
      } else {
        lineCopy.listMarker = null;
      }
    }

    if (typeof lineCopy.relativeY === "number") {
      lineCopy.y = cursorY + lineCopy.relativeY;
      relativeCursor = Math.max(relativeCursor, lineCopy.relativeY + resolvedLineHeight);
    } else {
      lineCopy.relativeY = relativeCursor;
      lineCopy.y = cursorY + relativeCursor;
      relativeCursor += resolvedLineHeight;
    }

    lineCopy.lineHeight = resolvedLineHeight;
    if (typeof lineCopy.x !== "number") {
      lineCopy.x = computeLineX(lineCopy, blockSettings);
    }
    if (containerStack.length) {
      lineCopy.containers = containerStack;
    }

    lineCopy.fragmentOwners = ensureBlockFragmentOwner({
      line: lineCopy,
      node: block,
      blockId,
      blockStart,
      blockAttrs: lineCopy.blockAttrs,
    });
    if (Array.isArray(lineCopy.fragmentOwners) && lineCopy.fragmentOwners.length > 0) {
      lineCopy.fragmentOwners = adjustFragmentOwners(lineCopy.fragmentOwners, blockStart, cursorY);
    }

    appendPageReuseSignature(page, lineCopy);
    page.lines.push(lineCopy);
    pageBoxCollector.consumeLine(lineCopy);

    if (Number.isFinite(lineCopy.rootIndex)) {
      if (page.rootIndexMin == null || lineCopy.rootIndex < page.rootIndexMin) {
        page.rootIndexMin = lineCopy.rootIndex;
      }
      if (page.rootIndexMax == null || lineCopy.rootIndex > page.rootIndexMax) {
        page.rootIndexMax = lineCopy.rootIndex;
      }
    }
  }

  if (perf) {
    perf.lines += linesToPlace.length;
  }
}

/**
 * 在当前页放不下完整切片时，至少消费并放置第一行，避免页面空转。
 */
export function placeForcedFirstLeafLine({
  remainingLines,
  remainingLength,
  remainingHeight,
  lineHeightValue,
  consumeForcedFirstLine,
  placeLines,
}: ForceFirstLeafLineOptions) {
  const forcedPlacement = consumeForcedFirstLine({
    remainingLines,
    remainingLength,
    remainingHeight,
    lineHeightValue,
  });
  if (!forcedPlacement) {
    return null;
  }

  placeLines([forcedPlacement.line]);
  return {
    placedHeight: forcedPlacement.height,
    nextLines: forcedPlacement.nextLines,
    nextLength: forcedPlacement.nextLength,
    nextHeight: forcedPlacement.nextHeight,
  };
}
