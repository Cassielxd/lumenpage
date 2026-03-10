export const getPageX = (layout: any, viewportWidth: number) => {
  if (!layout) {
    return 0;
  }

  const pageWidth = Number.isFinite(layout.pageWidth) ? layout.pageWidth : 0;
  const align = layout.pageAlign || "center";
  const offset = Number.isFinite(layout.pageOffsetX) ? layout.pageOffsetX : 0;

  let x = 0;
  if (align === "center") {
    x = (viewportWidth - pageWidth) / 2;
  } else if (align === "right") {
    x = viewportWidth - pageWidth;
  }

  x += offset;

  return Math.max(0, x);
};
