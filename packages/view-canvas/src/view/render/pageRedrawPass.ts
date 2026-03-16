import { now } from "../debugTrace";
import { getRendererPageCacheEntry, type RendererPageCacheEntry } from "./pageCanvasCache";

export type PageCacheDisposition = "hit" | "miss" | "recreated";

export type PageRedrawState = {
  page: any;
  entry: RendererPageCacheEntry;
  prevEntrySignature: number | null;
  signature: number | null;
  pageRedrawn: boolean;
  hasCachedSignature: boolean;
  canSkipSignature: boolean;
  cacheDisposition: PageCacheDisposition;
  signatureComputed: boolean;
  signatureMs: number;
  renderMs: number;
};

export const runPageRedrawPass = ({
  pageCache,
  pageIndex,
  layout,
  dpr,
  layoutVersion,
  layoutVersionChanged,
  forceRedraw,
  changedRange,
  settings,
  getPageSignature,
  renderPage,
}: {
  pageCache: Map<number, RendererPageCacheEntry>;
  pageIndex: number;
  layout: any;
  dpr: number;
  layoutVersion: number | null;
  layoutVersionChanged: boolean;
  forceRedraw: boolean;
  changedRange: { min: number; max: number } | null;
  settings: any;
  getPageSignature: (page: any) => number;
  renderPage: (pageIndex: number, layout: any, entry: RendererPageCacheEntry) => void;
}): PageRedrawState => {
  const previousEntry = pageCache.get(pageIndex);
  const cacheDisposition: PageCacheDisposition =
    previousEntry &&
    previousEntry.width === layout.pageWidth &&
    previousEntry.height === layout.pageHeight &&
    previousEntry.dpr === dpr
      ? "hit"
      : previousEntry
        ? "recreated"
        : "miss";

  const entry = getRendererPageCacheEntry({
    pageCache,
    pageIndex,
    layout,
    dpr,
  });

  const page = layout.pages[pageIndex];
  const prevEntrySignature = entry.signature;
  let signature = entry.signature;
  if (page && Number.isFinite(layoutVersion)) {
    page.__layoutVersionToken = Number(layoutVersion);
  }

  const currentVersion = Number.isFinite(layoutVersion) ? Number(layoutVersion) : null;
  const entryVersion = Number.isFinite(entry?.signatureVersion)
    ? Number(entry.signatureVersion)
    : null;
  const pageVersion = Number.isFinite(page?.__signatureVersion)
    ? Number(page.__signatureVersion)
    : null;
  const hasEntrySignature =
    typeof signature === "number" && (currentVersion == null || entryVersion === currentVersion);
  const hasPageSignature =
    page &&
    typeof page.__signature === "number" &&
    (currentVersion == null || pageVersion === currentVersion);
  const hasCachedSignature = hasEntrySignature || hasPageSignature;
  const canSkipSignature =
    !forceRedraw &&
    hasCachedSignature &&
    (!layoutVersionChanged ||
      page?.__reused === true ||
      (changedRange &&
        page &&
        Number.isFinite(page.rootIndexMax) &&
        page.rootIndexMax < changedRange.min));

  let signatureComputed = false;
  let signatureMs = 0;
  if (!canSkipSignature) {
    signatureComputed = true;
    const sigStart = settings?.debugPerf ? now() : 0;
    signature = getPageSignature(page);
    if (settings?.debugPerf) {
      signatureMs += now() - sigStart;
    }
  } else if (signature == null && hasPageSignature) {
    signature = page.__signature;
  }

  if (Number.isFinite(layoutVersion) && Number.isFinite(signature)) {
    entry.signatureVersion = Number(layoutVersion);
  }

  if (forceRedraw || entry.signature !== signature) {
    entry.signature = signature;
    entry.dirty = true;
  }

  let pageRedrawn = false;
  let renderMs = 0;
  if (entry.dirty) {
    pageRedrawn = true;
    const renderStart = settings?.debugPerf ? now() : 0;
    renderPage(pageIndex, layout, entry);
    if (settings?.debugPerf) {
      renderMs += now() - renderStart;
    }
  }

  return {
    page,
    entry,
    prevEntrySignature,
    signature: typeof signature === "number" ? Number(signature) : null,
    pageRedrawn,
    hasCachedSignature,
    canSkipSignature,
    cacheDisposition,
    signatureComputed,
    signatureMs,
    renderMs,
  };
};
