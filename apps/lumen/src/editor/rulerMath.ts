export type RulerMargin = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type HorizontalRulerMetrics = {
  viewportWidth: number;
  pageWidth: number;
  pageX: number;
  margin: RulerMargin;
  contentLeftX: number;
  contentRightX: number;
  contentWidth: number;
};

export type HorizontalRulerTick = {
  offset: number;
  x: number;
  kind: "minor" | "mid" | "major";
  label: string | null;
};

export type VerticalRulerTick = {
  offset: number;
  y: number;
  kind: "minor" | "mid" | "major";
  label: string | null;
};

export const MIN_RULER_CONTENT_WIDTH = 160;
export const MIN_RULER_CONTENT_HEIGHT = 220;

const toNonNegativeNumber = (value: unknown, fallback = 0) => {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }
  return Math.max(0, nextValue);
};

export const normalizeRulerMargin = (value: unknown): RulerMargin => {
  if (value && typeof value === "object") {
    const nextValue = value as Partial<RulerMargin>;
    return {
      left: toNonNegativeNumber(nextValue.left),
      right: toNonNegativeNumber(nextValue.right),
      top: toNonNegativeNumber(nextValue.top),
      bottom: toNonNegativeNumber(nextValue.bottom),
    };
  }
  return {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };
};

export const computeHorizontalRulerMetrics = ({
  viewportWidth,
  pageWidth,
  margin,
}: {
  viewportWidth: number;
  pageWidth: number;
  margin: RulerMargin;
}): HorizontalRulerMetrics | null => {
  const safeViewportWidth = toNonNegativeNumber(viewportWidth);
  const safePageWidth = toNonNegativeNumber(pageWidth);
  if (safeViewportWidth <= 0 || safePageWidth <= 0) {
    return null;
  }
  const safeMargin = normalizeRulerMargin(margin);
  const pageX = Math.max(0, (safeViewportWidth - safePageWidth) / 2);
  const contentWidth = Math.max(0, safePageWidth - safeMargin.left - safeMargin.right);
  const contentLeftX = pageX + safeMargin.left;
  const contentRightX = contentLeftX + contentWidth;
  return {
    viewportWidth: safeViewportWidth,
    pageWidth: safePageWidth,
    pageX,
    margin: safeMargin,
    contentLeftX,
    contentRightX,
    contentWidth,
  };
};

export const clampHorizontalMarginValue = ({
  side,
  pageWidth,
  margin,
  value,
}: {
  side: "left" | "right";
  pageWidth: number;
  margin: RulerMargin;
  value: number;
}) => {
  const safePageWidth = Math.max(0, Number(pageWidth) || 0);
  const safeMargin = normalizeRulerMargin(margin);
  const rawValue = Math.round(Math.max(0, Number(value) || 0));
  const otherSide = side === "left" ? safeMargin.right : safeMargin.left;
  const maxMargin = Math.max(0, safePageWidth - otherSide - MIN_RULER_CONTENT_WIDTH);
  return Math.max(0, Math.min(maxMargin, rawValue));
};

export const buildHorizontalRulerTicks = ({
  pageWidth,
  pageX,
  minorStep = 12,
  majorStep = 96,
}: {
  pageWidth: number;
  pageX: number;
  minorStep?: number;
  majorStep?: number;
}) => {
  const safePageWidth = Math.max(0, Number(pageWidth) || 0);
  const safePageX = Math.max(0, Number(pageX) || 0);
  const safeMinorStep = Math.max(1, Math.round(Number(minorStep) || 12));
  const safeMajorStep = Math.max(safeMinorStep, Math.round(Number(majorStep) || 96));
  const midStep = Math.max(safeMinorStep, Math.round(safeMajorStep / 2));
  const ticks: HorizontalRulerTick[] = [];
  for (let offset = 0; offset <= safePageWidth; offset += safeMinorStep) {
    const isMajor = offset % safeMajorStep === 0;
    const isMid = !isMajor && offset % midStep === 0;
    ticks.push({
      offset,
      x: safePageX + offset,
      kind: isMajor ? "major" : isMid ? "mid" : "minor",
      label: isMajor ? String(Math.round(offset)) : null,
    });
  }
  if (ticks[ticks.length - 1]?.offset !== safePageWidth) {
    ticks.push({
      offset: safePageWidth,
      x: safePageX + safePageWidth,
      kind: "major",
      label: String(Math.round(safePageWidth)),
    });
  }
  return ticks;
};

export const clampVerticalMarginValue = ({
  side,
  pageHeight,
  margin,
  value,
}: {
  side: "top" | "bottom";
  pageHeight: number;
  margin: RulerMargin;
  value: number;
}) => {
  const safePageHeight = Math.max(0, Number(pageHeight) || 0);
  const safeMargin = normalizeRulerMargin(margin);
  const rawValue = Math.round(Math.max(0, Number(value) || 0));
  const otherSide = side === "top" ? safeMargin.bottom : safeMargin.top;
  const maxMargin = Math.max(0, safePageHeight - otherSide - MIN_RULER_CONTENT_HEIGHT);
  return Math.max(0, Math.min(maxMargin, rawValue));
};

export const buildVerticalRulerTicks = ({
  pageHeight,
  pageTopY,
  minorStep = 12,
  majorStep = 96,
}: {
  pageHeight: number;
  pageTopY: number;
  minorStep?: number;
  majorStep?: number;
}) => {
  const safePageHeight = Math.max(0, Number(pageHeight) || 0);
  const safePageTopY = Number(pageTopY) || 0;
  const safeMinorStep = Math.max(1, Math.round(Number(minorStep) || 12));
  const safeMajorStep = Math.max(safeMinorStep, Math.round(Number(majorStep) || 96));
  const midStep = Math.max(safeMinorStep, Math.round(safeMajorStep / 2));
  const ticks: VerticalRulerTick[] = [];
  for (let offset = 0; offset <= safePageHeight; offset += safeMinorStep) {
    const isMajor = offset % safeMajorStep === 0;
    const isMid = !isMajor && offset % midStep === 0;
    ticks.push({
      offset,
      y: safePageTopY + offset,
      kind: isMajor ? "major" : isMid ? "mid" : "minor",
      label: isMajor ? String(Math.round(offset)) : null,
    });
  }
  if (ticks[ticks.length - 1]?.offset !== safePageHeight) {
    ticks.push({
      offset: safePageHeight,
      y: safePageTopY + safePageHeight,
      kind: "major",
      label: String(Math.round(safePageHeight)),
    });
  }
  return ticks;
};
