import { emitGhostTrace, now } from "../debugTrace";
import { getRendererPageCacheEntry, type RendererPageCacheEntry } from "./pageCanvasCache";
import { type RendererPageDisplayList } from "./pageDisplayList";

export type PageCacheDisposition = "hit" | "miss" | "recreated";

export type PageRedrawState = {
  page: any;
  entry: RendererPageCacheEntry;
  prevEntrySignature: number | null;
  signature: number | null;
  hasVisualBlock: boolean;
  reusedFromDifferentSource: boolean;
  forceDisplayListForVisualReuse: boolean;
  displayListBuilt: boolean;
  displayListReused: boolean;
  displayListItemCount: number;
  pageRedrawn: boolean;
  hasCachedSignature: boolean;
  canSkipSignature: boolean;
  cacheDisposition: PageCacheDisposition;
  signatureComputed: boolean;
  displayListBuildMs: number;
  renderMs: number;
};

export const pageHasVisualBlock = (page: any) => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  for (const line of lines) {
    const capabilities = line?.blockAttrs?.layoutCapabilities;
    if (capabilities?.["visual-block"] === true) {
      return true;
    }
    if (Array.isArray(line?.fragmentOwners)) {
      for (const owner of line.fragmentOwners) {
        if (owner?.meta?.layoutCapabilities?.["visual-block"] === true) {
          return true;
        }
      }
    }
  }
  const stack = Array.isArray(page?.boxes) ? [...page.boxes] : [];
  while (stack.length > 0) {
    const box = stack.pop();
    if (!box || typeof box !== "object") {
      continue;
    }
    const capabilities = box?.meta?.layoutCapabilities;
    if (capabilities?.["visual-block"] === true) {
      return true;
    }
    if (Array.isArray(box.children) && box.children.length > 0) {
      stack.push(...box.children);
    }
  }
  return false;
};

export const pageIsReusedFromDifferentSource = (page: any, pageIndex: number) => {
  const sourcePageIndex = Number.isFinite(page?.__sourcePageIndex)
    ? Number(page.__sourcePageIndex)
    : null;
  return sourcePageIndex != null && sourcePageIndex !== pageIndex;
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
  buildPageDisplayList,
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
  buildPageDisplayList: (pageIndex: number, layout: any) => RendererPageDisplayList;
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
  const reusedFromDifferentSource = pageIsReusedFromDifferentSource(page, pageIndex);
  const hasVisualBlock = pageHasVisualBlock(page);
  const forceDisplayListForVisualReuse =
    layoutVersionChanged && (hasVisualBlock || reusedFromDifferentSource);
  const canSkipSignature =
    !forceRedraw &&
    hasCachedSignature &&
    !forceDisplayListForVisualReuse &&
    (!layoutVersionChanged ||
      page?.__reused === true ||
      (changedRange &&
        page &&
        Number.isFinite(page.rootIndexMax) &&
        page.rootIndexMax < changedRange.min));

  let signatureComputed = false;
  let displayListBuildMs = 0;
  let nextDisplayList = entry.displayList;
  let displayListBuilt = false;
  if (!canSkipSignature) {
    signatureComputed = true;
    const sigStart = settings?.debugPerf ? now() : 0;
    nextDisplayList = buildPageDisplayList(pageIndex, layout);
    displayListBuilt = true;
    signature = nextDisplayList.signature;
    if (settings?.debugPerf) {
      displayListBuildMs += now() - sigStart;
    }
  } else if (signature == null && hasPageSignature) {
    signature = page.__signature;
  }

  if (!nextDisplayList) {
    const buildStart = settings?.debugPerf ? now() : 0;
    nextDisplayList = buildPageDisplayList(pageIndex, layout);
    displayListBuilt = true;
    if (signature == null && typeof nextDisplayList.signature === "number") {
      signature = nextDisplayList.signature;
    }
    if (settings?.debugPerf) {
      displayListBuildMs += now() - buildStart;
    }
  }

  if (Number.isFinite(layoutVersion) && Number.isFinite(signature)) {
    entry.signatureVersion = Number(layoutVersion);
  }

  if (nextDisplayList) {
    entry.displayList = nextDisplayList;
  }

  if (forceRedraw || entry.signature !== signature || !entry.displayList) {
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

  emitGhostTrace(
    "page-redraw",
    {
      pageIndex,
      rootIndexMin: Number.isFinite(page?.rootIndexMin) ? Number(page.rootIndexMin) : null,
      rootIndexMax: Number.isFinite(page?.rootIndexMax) ? Number(page.rootIndexMax) : null,
      lineCount: Array.isArray(page?.lines) ? page.lines.length : 0,
      hasVisualBlock,
      reusedFromDifferentSource,
      forceDisplayListForVisualReuse,
      cacheDisposition,
      hasCachedSignature,
      canSkipSignature,
      signatureComputed,
      displayListBuilt,
      displayListReused: !displayListBuilt && !!entry.displayList,
      displayListItemCount: Array.isArray(entry.displayList?.items) ? entry.displayList.items.length : 0,
      prevEntrySignature: typeof prevEntrySignature === "number" ? prevEntrySignature : null,
      nextSignature: typeof signature === "number" ? Number(signature) : null,
      pageRedrawn,
      entryDirtyAfterPass: entry.dirty === true,
      layoutVersion: Number.isFinite(layoutVersion) ? Number(layoutVersion) : null,
      layoutVersionChanged,
      forceRedraw,
      changedRangeMin: changedRange?.min ?? null,
      changedRangeMax: changedRange?.max ?? null,
    },
    settings
  );

  return {
    page,
    entry,
    prevEntrySignature,
    signature: typeof signature === "number" ? Number(signature) : null,
    hasVisualBlock,
    reusedFromDifferentSource,
    forceDisplayListForVisualReuse,
    displayListBuilt,
    displayListReused: !displayListBuilt && !!entry.displayList,
    displayListItemCount: Array.isArray(entry.displayList?.items) ? entry.displayList.items.length : 0,
    pageRedrawn,
    hasCachedSignature,
    canSkipSignature,
    cacheDisposition,
    signatureComputed,
    displayListBuildMs,
    renderMs,
  };
};
