const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");

export function measureTextWidth(font, text) {
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export function getFontSize(font) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  if (!match) {
    return 16;
  }
  const size = Number.parseFloat(match[1]);
  return Number.isFinite(size) ? size : 16;
}
