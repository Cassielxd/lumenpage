import {
  findLineForOffsetIndexed,
  getAdjacentTextLineItem,
  getTextLineItemAtOffset,
  offsetAtXIndexed,
} from "./layoutIndex";

export const createSelectionMovement = ({
  getLayout,
  getLayoutIndex,
  getCaretOffset,
  setCaretOffset,
  getText,
  getTextLength,
  getPreferredX,
  updateCaret,
  scrollArea,
  getSelectionAnchorOffset,
  setSelectionOffsets,
}) => {
  const resolveTextLength = () => {
    if (typeof getTextLength === "function") {
      return getTextLength();
    }
    if (typeof getText === "function") {
      return getText()?.length ?? 0;
    }
    return 0;
  };

  const computeLineEdgeOffset = (edge) => {
    const layout = getLayout();
    if (!layout) {
      return null;
    }

    const info = findLineForOffsetIndexed(
      layout,
      getCaretOffset(),
      resolveTextLength(),
      getLayoutIndex?.()
    );
    if (!info) {
      return null;
    }

    return edge === "start" ? info.start : info.end;
  };

  const computeVerticalOffset = (direction) => {
    const layout = getLayout();
    if (!layout) {
      return null;
    }
    const layoutIndex = getLayoutIndex?.() ?? null;

    const info = findLineForOffsetIndexed(
      layout,
      getCaretOffset(),
      resolveTextLength(),
      layoutIndex
    );
    if (!info) {
      return null;
    }

    if (getPreferredX() === null) {
      updateCaret(true);
    }

    const preferredX = getPreferredX();
    if (preferredX === null) {
      return null;
    }

    const adjacentTextLine =
      layoutIndex && Number.isFinite(info.start) && Number.isFinite(info.end)
        ? getAdjacentTextLineItem(layoutIndex, getCaretOffset(), direction)
        : null;

    let targetPageIndex = info.pageIndex;
    let targetLineIndex = info.lineIndex + (direction === "up" ? -1 : 1);
    let targetPage = null;
    let targetLine = null;
    let targetBox = adjacentTextLine?.box ?? info.box ?? null;

    if (adjacentTextLine?.line) {
      targetPageIndex = adjacentTextLine.pageIndex;
      targetLineIndex = adjacentTextLine.lineIndex;
      targetPage = adjacentTextLine.page;
      targetLine = adjacentTextLine.line;
      targetBox = adjacentTextLine.box ?? null;
    } else {
      if (targetLineIndex < 0) {
        targetPageIndex -= 1;
        if (targetPageIndex < 0) {
          return null;
        }
        targetLineIndex = layout.pages[targetPageIndex].lines.length - 1;
      } else if (targetLineIndex >= layout.pages[targetPageIndex].lines.length) {
        targetPageIndex += 1;
        if (targetPageIndex >= layout.pages.length) {
          return null;
        }
        targetLineIndex = 0;
      }

      targetPage = layout.pages[targetPageIndex];
      targetLine = targetPage.lines[targetLineIndex];
      const probeOffset =
        direction === "up"
          ? Math.max(
              Number.isFinite(targetLine?.end) ? Number(targetLine.end) - 1 : 0,
              Number.isFinite(targetLine?.start) ? Number(targetLine.start) : 0
            )
          : Number.isFinite(targetLine?.start)
            ? Number(targetLine.start)
            : 0;
      const targetTextLine = layoutIndex
        ? getTextLineItemAtOffset(layoutIndex, probeOffset, {
            preferBoundary: direction === "up" ? "end" : "start",
          })
        : null;
      if (targetTextLine?.line === targetLine) {
        targetBox = targetTextLine.box ?? targetBox;
      }
    }

    if (!targetPage || !targetLine) {
      return null;
    }
    const pageX = Math.max(0, (scrollArea.clientWidth - layout.pageWidth) / 2);
    const targetX = Number.isFinite(targetBox?.x) ? Number(targetBox.x) : Number(targetLine?.x) || 0;
    const localX = Math.max(0, preferredX - (pageX + targetX));
    return offsetAtXIndexed(layout, targetLine, localX, targetPage);
  };

  const moveHorizontal = (delta) => {
    setCaretOffset(getCaretOffset() + delta, true);
  };

  const moveLineEdge = (edge) => {
    const nextOffset = computeLineEdgeOffset(edge);
    if (nextOffset === null) {
      return;
    }
    setCaretOffset(nextOffset, true);
  };

  const moveVertical = (direction) => {
    const nextOffset = computeVerticalOffset(direction);
    if (nextOffset === null) {
      return;
    }
    setCaretOffset(nextOffset, false);
  };

  const extendSelection = (nextOffset, updatePreferred) => {
    if (nextOffset === null) {
      return;
    }
    setSelectionOffsets(getSelectionAnchorOffset(), nextOffset, updatePreferred);
  };

  return {
    computeLineEdgeOffset,
    computeVerticalOffset,
    moveHorizontal,
    moveLineEdge,
    moveVertical,
    extendSelection,
  };
};
