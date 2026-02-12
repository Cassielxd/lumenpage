export function hitTest(layout, x, y, scrollTop, viewportWidth) {
  if (!layout || layout.pages.length === 0) {
    return null;
  }

  const pageSpan = layout.pageHeight + layout.pageGap;
  const pageIndex = Math.floor((y + scrollTop) / pageSpan);
  if (pageIndex < 0 || pageIndex >= layout.pages.length) {
    return null;
  }

  const page = layout.pages[pageIndex];
  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const localY = y + scrollTop - pageIndex * pageSpan;

  const lineIndex = Math.floor((localY - layout.margin.top) / layout.lineHeight);
  const line = page.lines[Math.max(0, Math.min(page.lines.length - 1, lineIndex))];

  if (!line) {
    return null;
  }

  return {
    pageIndex,
    lineIndex,
    offset: line.start,
    x: pageX + line.x,
    y: line.y,
  };
}
