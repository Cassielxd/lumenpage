import type {
  LayoutChangeSummary,
  LayoutResult,
  LayoutSettingsLike,
  TopLevelIndexableDoc,
} from "lumenpage-layout-engine";
import type { LayoutIndex } from "lumenpage-view-runtime";
import { DEFAULT_PAGE_WIDTH } from "../pageDefaults.js";
import { getPageOffsetDelta } from "./layoutRuntimeMetadata.js";
import { getPageIndexForOffset } from "./layoutIndex.js";

const toFiniteNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(value) ? Number(value) : fallback;

export const resolveLayoutSettingsForPass = (
  settings: LayoutSettingsLike | null | undefined,
  resolvedPageWidth: unknown
) => {
  const fallbackWidth = toFiniteNumber(settings?.pageWidth, DEFAULT_PAGE_WIDTH);
  const pageWidth =
    Number.isFinite(resolvedPageWidth) && Number(resolvedPageWidth) > 0
      ? Number(resolvedPageWidth)
      : fallbackWidth > 0
        ? fallbackWidth
        : DEFAULT_PAGE_WIDTH;
  return {
    ...settings,
    pageWidth,
  };
};

export const getLayoutSettingsSignature = (settings: LayoutSettingsLike | null | undefined) => {
  const margin = settings?.margin || {};
  return [
    toFiniteNumber(settings?.pageWidth, 0),
    toFiniteNumber(settings?.pageHeight, 0),
    toFiniteNumber(settings?.pageGap, 0),
    toFiniteNumber(margin?.left, 0),
    toFiniteNumber(margin?.right, 0),
    toFiniteNumber(margin?.top, 0),
    toFiniteNumber(margin?.bottom, 0),
    toFiniteNumber(settings?.lineHeight, 0),
    String(settings?.font || ""),
    String(settings?.codeFont || ""),
    toFiniteNumber(settings?.wrapTolerance, 0),
    toFiniteNumber(settings?.minLineWidth, 0),
    toFiniteNumber(settings?.blockSpacing, 0),
    toFiniteNumber(settings?.paragraphSpacingBefore, 0),
    toFiniteNumber(settings?.paragraphSpacingAfter, 0),
    toFiniteNumber(settings?.listIndent, 0),
    toFiniteNumber(settings?.listMarkerGap, 0),
    String(settings?.listMarkerFont || ""),
    toFiniteNumber(settings?.codeBlockPadding, 0),
    String(settings?.textLocale || ""),
    settings?.segmentText ? "segment:on" : "segment:off",
  ].join("|");
};

export const findPageIndexForOffset = (
  layout: LayoutResult | null | undefined,
  offset: number,
  layoutIndex: LayoutIndex | null = null
) => {
  if (layoutIndex && typeof getPageIndexForOffset === "function") {
    const pageIndex = getPageIndexForOffset(layoutIndex, offset);
    if (Number.isFinite(pageIndex)) {
      return pageIndex;
    }
  }

  if (!layout || !Array.isArray(layout.pages) || layout.pages.length === 0) {
    return null;
  }

  const target = Number.isFinite(offset) ? Number(offset) : 0;
  let lineEndFallback: number | null = null;
  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const page = layout.pages[pageIndex];
    const pageOffsetDelta = getPageOffsetDelta(page);
    const lines = Array.isArray(page?.lines) ? page.lines : [];
    for (const line of lines) {
      const start = Number.isFinite(line?.start) ? Number(line.start) + pageOffsetDelta : null;
      const end = Number.isFinite(line?.end) ? Number(line.end) + pageOffsetDelta : null;
      if (start == null || end == null) {
        continue;
      }
      if (start === end && target === start) {
        return pageIndex;
      }
      if (target >= start && target < end) {
        return pageIndex;
      }
      if (target === end && end > start && lineEndFallback == null) {
        lineEndFallback = pageIndex;
      }
    }
  }

  if (lineEndFallback != null) {
    return lineEndFallback;
  }

  return layout.pages.length - 1;
};

const findPageIndexForChangedBlocks = (
  layout: LayoutResult | null | undefined,
  changeSummary: LayoutChangeSummary | null | undefined
) => {
  if (!layout || !Array.isArray(layout.pages) || layout.pages.length === 0) {
    return null;
  }

  const candidates = [
    changeSummary?.blocks?.before?.fromIndex,
    changeSummary?.blocks?.before?.toIndex,
    changeSummary?.blocks?.after?.fromIndex,
    changeSummary?.blocks?.after?.toIndex,
  ].filter((value) => Number.isFinite(value)) as number[];

  if (candidates.length === 0) {
    return null;
  }

  const targetRootIndex = Math.max(0, Math.min(...candidates.map((value) => Number(value))));

  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const page = layout.pages[pageIndex];
    const rootIndexMax = Number.isFinite(page?.rootIndexMax) ? Number(page.rootIndexMax) : null;
    if (rootIndexMax != null && rootIndexMax >= targetRootIndex) {
      return pageIndex;
    }
  }

  return null;
};

const isWholeDocumentChangeSummary = (
  changeSummary: LayoutChangeSummary | null | undefined,
  doc: TopLevelIndexableDoc | null | undefined
) => {
  const childCount = Number.isFinite(doc?.childCount) ? Number(doc.childCount) : 0;
  if (changeSummary?.docChanged !== true || childCount === 0) {
    return false;
  }

  const before = changeSummary?.blocks?.before || {};
  const after = changeSummary?.blocks?.after || {};
  const maxRootIndex = Math.max(0, childCount - 1);

  return (
    Number(before.fromIndex) === 0 &&
    Number(after.fromIndex) === 0 &&
    Number(before.toIndex) >= maxRootIndex &&
    Number(after.toIndex) >= maxRootIndex
  );
};

export const resolveCascadePaginationPlan = ({
  prevLayout,
  changeSummary,
  docChanged,
  incrementalEnabled,
  runForceFullPass,
  editorState,
  doc,
  clampOffset,
  docPosToTextOffset,
  getLayoutIndex,
}: {
  prevLayout: LayoutResult | null | undefined;
  changeSummary: LayoutChangeSummary | null | undefined;
  docChanged: boolean;
  incrementalEnabled: boolean;
  runForceFullPass: boolean;
  editorState:
    | {
        selection?: {
          head?: number | null;
        } | null;
      }
    | null
    | undefined;
  doc: TopLevelIndexableDoc | null | undefined;
  clampOffset: (offset: number) => number;
  docPosToTextOffset: (doc: TopLevelIndexableDoc | null | undefined, pos: number) => number;
  getLayoutIndex: () => LayoutIndex | null;
}) => {
  let cascadeFromPageIndex: number | null = null;
  let useCascadePagination = false;
  if (prevLayout && docChanged && incrementalEnabled && !runForceFullPass) {
    if (isWholeDocumentChangeSummary(changeSummary, doc)) {
      return {
        cascadeFromPageIndex: null,
        useCascadePagination: false,
      };
    }
    const changedPageIndex = findPageIndexForChangedBlocks(prevLayout, changeSummary);
    if (Number.isFinite(changedPageIndex)) {
      cascadeFromPageIndex = Number(changedPageIndex);
      useCascadePagination = true;
    }
    if (cascadeFromPageIndex === null) {
      const headPos = editorState?.selection?.head;
      const headOffset = Number.isFinite(headPos)
        ? clampOffset(docPosToTextOffset(doc, Number(headPos)))
        : null;
      const prevLayoutIndex = getLayoutIndex?.() ?? null;
      if (headOffset != null) {
        const headPageIndex = findPageIndexForOffset(
          prevLayout,
          Number(headOffset),
          prevLayoutIndex
        );
        if (Number.isFinite(headPageIndex)) {
          cascadeFromPageIndex = Number(headPageIndex);
          useCascadePagination = true;
        }
      }
    }
    if (cascadeFromPageIndex === null) {
      cascadeFromPageIndex = 0;
      useCascadePagination = true;
    }
  }
  return {
    cascadeFromPageIndex,
    useCascadePagination,
  };
};
