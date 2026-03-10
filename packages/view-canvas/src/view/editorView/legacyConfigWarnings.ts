const warnedLegacyKeys = new Set<string>();
const LEGACY_HITS_GLOBAL_KEY = "__lumenLegacyConfigHits";

const readLegacyHits = () => {
  const globalObj = globalThis as any;
  const hits = globalObj?.[LEGACY_HITS_GLOBAL_KEY];
  if (Array.isArray(hits)) {
    return hits;
  }
  globalObj[LEGACY_HITS_GLOBAL_KEY] = [];
  return globalObj[LEGACY_HITS_GLOBAL_KEY];
};

const recordLegacyHit = (key: string, replacement: string, strict: boolean) => {
  const hits = readLegacyHits();
  hits.push({
    key,
    replacement,
    strict,
    timestamp: Date.now(),
  });
};

export const clearLegacyCanvasConfigHits = () => {
  const globalObj = globalThis as any;
  globalObj[LEGACY_HITS_GLOBAL_KEY] = [];
};

export const getLegacyCanvasConfigHits = () => {
  return [...readLegacyHits()];
};

export const warnLegacyCanvasConfigUsage = (
  key: string,
  replacement: string,
  strict = false
) => {
  recordLegacyHit(key, replacement, strict);
  if (strict) {
    throw new Error(
      `[canvas-config] "${key}" is no longer allowed in strict mode. Migrate to ${replacement}.`
    );
  }
  const warnKey = `${key}->${replacement}`;
  if (warnedLegacyKeys.has(warnKey)) {
    return;
  }
  warnedLegacyKeys.add(warnKey);
};
