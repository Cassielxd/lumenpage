/*
 * 文件说明：文本测量工具。
 * 主要职责：测量文本宽度与字号，带缓存以减少重复计算。
 */

const measureCanvas = document.createElement("canvas");

const measureCtx = measureCanvas.getContext("2d");

const measureCache = new Map();

const MAX_CACHE_ENTRIES_PER_FONT = 5000;

const getFontCache = (font) => {
  let cache = measureCache.get(font);
  if (!cache) {
    cache = new Map();
    measureCache.set(font, cache);
  }
  return cache;
};

export function measureTextWidth(font, text) {
  const cache = getFontCache(font);
  const cached = cache.get(text);
  if (typeof cached === "number") {
    return cached;
  }

  measureCtx.font = font;

  const width = measureCtx.measureText(text).width;

  cache.set(text, width);

  if (cache.size > MAX_CACHE_ENTRIES_PER_FONT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  return width;
}

export function getFontSize(font) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);

  if (!match) {
    return 16;
  }

  const size = Number.parseFloat(match[1]);

  return Number.isFinite(size) ? size : 16;
}
