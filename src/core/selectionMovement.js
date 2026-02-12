export const createSelectionMovement = ({
  getLayout,
  getCaretOffset,
  setCaretOffset,
  getText,
  getPreferredX,
  updateCaret,
  scrollArea,
  findLineForOffset,
  offsetAtX,
  getSelectionAnchorOffset,
  setSelectionOffsets,
}) => {
  const computeLineEdgeOffset = (edge) => {
    const layout = getLayout();
    if (!layout) {
      return null;
    }

    const info = findLineForOffset(layout, getCaretOffset(), getText().length);
    if (!info) {
      return null;
    }

    return edge === "start" ? info.line.start : info.line.end;
  };

  const computeVerticalOffset = (direction) => {
    const layout = getLayout();
    if (!layout) {
      return null;
    }

    const info = findLineForOffset(layout, getCaretOffset(), getText().length);
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

    let targetPageIndex = info.pageIndex;
    let targetLineIndex = info.lineIndex + (direction === "up" ? -1 : 1);

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

    const targetLine = layout.pages[targetPageIndex].lines[targetLineIndex];
    const pageX = Math.max(0, (scrollArea.clientWidth - layout.pageWidth) / 2);
    const localX = Math.max(0, preferredX - (pageX + targetLine.x));
    return offsetAtX(layout.font, targetLine, localX);
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
