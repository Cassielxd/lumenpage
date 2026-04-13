import { PAGE_REUSE_SIGNATURE_VERSION } from "./pageReuseFlags.js";
import { getObjectSignature, hashNumber, hashString } from "./signature.js";

/**
 * 清理页面上的复用签名缓存，强制下次重新计算。
 */
export function invalidatePageReuseSignature(page: any) {
  if (!page || typeof page !== "object") {
    return;
  }
  delete page.__reuseVisualSignature;
  delete page.__reuseVisualSignatureVersion;
  delete page.__reuseVisualSignatureBuilder;
  delete page.__reuseVisualSignatureBuilderLineCount;
}

function getLineVisualSignature(line: any, objectSignatureCache = new WeakMap<object, number>()) {
  if (
    Number(line?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof line?.__reuseVisualSignature === "number"
  ) {
    return Number(line.__reuseVisualSignature);
  }
  let hash = 17;
  hash = hashNumber(hash, line?.x);
  hash = hashNumber(hash, line?.y);
  hash = hashNumber(hash, line?.width);
  hash = hashNumber(hash, line?.lineHeight);
  hash = hashNumber(hash, line?.blockSignature);
  hash = hashString(hash, line?.blockType || "");
  hash = hashString(hash, line?.blockId || "");
  hash = hashString(hash, line?.text || "");
  hash = hashNumber(hash, getObjectSignature(line?.blockAttrs || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.tableMeta || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.tableOwnerMeta || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.containers || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.fragmentOwners || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.listMarker || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.imageMeta || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.videoMeta || null, objectSignatureCache));
  if (Array.isArray(line?.runs)) {
    for (const run of line.runs) {
      hash = hashString(hash, run?.text || "");
      hash = hashString(hash, run?.font || "");
      hash = hashString(hash, run?.color || "");
      hash = hashNumber(hash, run?.width);
      hash = hashNumber(hash, run?.underline ? 1 : 0);
      hash = hashString(hash, run?.underlineStyle || "");
      hash = hashString(hash, run?.underlineColor || "");
      hash = hashNumber(hash, run?.strike ? 1 : 0);
      hash = hashString(hash, run?.strikeColor || "");
      hash = hashNumber(hash, run?.shiftY);
      hash = hashNumber(hash, run?.backgroundRadius);
      hash = hashNumber(hash, run?.backgroundPaddingX);
      hash = hashString(hash, run?.linkHref || "");
      hash = hashString(hash, run?.annotationKey || "");
      hash = hashNumber(hash, getObjectSignature(run?.annotations || null, objectSignatureCache));
      hash = hashString(hash, run?.styleKey || "");
      hash = hashNumber(hash, getObjectSignature(run?.extras || null, objectSignatureCache));
      hash = hashNumber(
        hash,
        getObjectSignature(run?.drawInstructions || null, objectSignatureCache)
      );
      hash =
        typeof run?.background === "string"
          ? hashString(hash, run.background)
          : hashNumber(hash, getObjectSignature(run?.background || null, objectSignatureCache));
    }
  }
  const signature = hash >>> 0;
  if (line && typeof line === "object") {
    line.__reuseVisualSignature = signature;
    line.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
  }
  return signature;
}

function ensurePageReuseSignatureBuilder(page: any) {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  if (
    Number(page?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof page?.__reuseVisualSignatureBuilder === "number" &&
    Number(page?.__reuseVisualSignatureBuilderLineCount) === lines.length
  ) {
    return Number(page.__reuseVisualSignatureBuilder);
  }
  const objectSignatureCache = new WeakMap<object, number>();
  let hash = 0;
  for (const line of lines) {
    hash = hashNumber(hash, getLineVisualSignature(line, objectSignatureCache));
  }
  if (page && typeof page === "object") {
    page.__reuseVisualSignature = hash >>> 0;
    page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
    page.__reuseVisualSignatureBuilder = hash >>> 0;
    page.__reuseVisualSignatureBuilderLineCount = lines.length;
  }
  return hash >>> 0;
}

/**
 * 在页面末尾追加一条新行后，增量更新复用签名。
 */
export function appendPageReuseSignature(page: any, line: any) {
  if (!page || typeof page !== "object") {
    return;
  }
  const currentHash = ensurePageReuseSignatureBuilder(page);
  const nextHash = hashNumber(currentHash, getLineVisualSignature(line, new WeakMap())) >>> 0;
  const nextLineCount = Array.isArray(page.lines) ? page.lines.length + 1 : 1;
  page.__reuseVisualSignature = nextHash;
  page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
  page.__reuseVisualSignatureBuilder = nextHash;
  page.__reuseVisualSignatureBuilderLineCount = nextLineCount;
}

/**
 * 计算页面签名，可供主流程直接读取复用候选键。
 */
export function getPageSignature(page: any, offsetDelta = 0, includeAbsoluteOffsets = true) {
  if (
    includeAbsoluteOffsets === false &&
    Number(page?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof page?.__reuseVisualSignature === "number"
  ) {
    return Number(page.__reuseVisualSignature);
  }
  const shift = (value: any) =>
    Number.isFinite(value) ? Number(value) + Number(offsetDelta || 0) : value;
  const objectSignatureCache = new WeakMap<object, number>();
  let hash = 0;
  if (!page?.lines) {
    return hash;
  }
  for (const line of page.lines) {
    const lineOffsetDelta = Number.isFinite(line?.__offsetDelta)
      ? Number(line.__offsetDelta) + Number(offsetDelta || 0)
      : Number(offsetDelta || 0);
    if (!includeAbsoluteOffsets) {
      hash = hashNumber(hash, getLineVisualSignature(line, objectSignatureCache));
      continue;
    }
    hash = hashNumber(hash, shift(line.start));
    hash = hashNumber(hash, shift(line.end));
    hash = hashNumber(hash, shift(line.blockStart));
    hash = hashNumber(hash, line.x);
    hash = hashNumber(hash, line.y);
    hash = hashNumber(hash, line.width);
    hash = hashNumber(hash, line.lineHeight);
    hash = hashNumber(hash, line.blockSignature);
    hash = hashString(hash, line.blockType || "");
    hash = hashString(hash, line.blockId || "");
    hash = hashString(hash, line.text || "");
    hash = hashNumber(hash, getObjectSignature(line.blockAttrs || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.tableMeta || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.tableOwnerMeta || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.containers || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.fragmentOwners || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.listMarker || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.imageMeta || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.videoMeta || null, objectSignatureCache));
    if (line.runs) {
      for (const run of line.runs) {
        hash = hashNumber(
          hash,
          Number.isFinite(run?.start) ? Number(run.start) + lineOffsetDelta : run?.start
        );
        hash = hashNumber(
          hash,
          Number.isFinite(run?.end) ? Number(run.end) + lineOffsetDelta : run?.end
        );
        hash = hashString(hash, run.text || "");
        hash = hashString(hash, run.font || "");
        hash = hashString(hash, run.color || "");
        hash = hashNumber(hash, run.width);
        hash = hashNumber(hash, run.underline ? 1 : 0);
        hash = hashString(hash, run.underlineStyle || "");
        hash = hashString(hash, run.underlineColor || "");
        hash = hashNumber(hash, run.strike ? 1 : 0);
        hash = hashString(hash, run.strikeColor || "");
        hash = hashNumber(hash, run.shiftY);
        hash = hashNumber(hash, run.backgroundRadius);
        hash = hashNumber(hash, run.backgroundPaddingX);
        hash = hashString(hash, run.linkHref || "");
        hash = hashString(hash, run.annotationKey || "");
        hash = hashNumber(hash, getObjectSignature(run.annotations || null, objectSignatureCache));
        hash = hashString(hash, run.styleKey || "");
        hash = hashNumber(hash, getObjectSignature(run.extras || null, objectSignatureCache));
        hash = hashNumber(
          hash,
          getObjectSignature(run.drawInstructions || null, objectSignatureCache)
        );
        hash =
          typeof run.background === "string"
            ? hashString(hash, run.background)
            : hashNumber(hash, getObjectSignature(run.background || null, objectSignatureCache));
      }
    }
  }
  if (includeAbsoluteOffsets === false && page) {
    page.__reuseVisualSignature = hash >>> 0;
    page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
    page.__reuseVisualSignatureBuilder = hash >>> 0;
    page.__reuseVisualSignatureBuilderLineCount = Array.isArray(page.lines) ? page.lines.length : 0;
  }
  return hash;
}
