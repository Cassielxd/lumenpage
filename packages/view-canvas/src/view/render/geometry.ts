import { getNearestContentOwner } from "../layoutSemantics";
import { resolveLegacyLineVisualBounds } from "../legacyVisualBounds";

const TEXT_LINE_FRAGMENT_ROLE = "text-line";

const isTextLineBox = (box: any) =>
  String(box?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
  String(box?.type || "") === TEXT_LINE_FRAGMENT_ROLE;

const toFiniteNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getBoxArea = (box: any) => {
  const width = Math.max(0, toFiniteNumber(box?.width) ?? 0);
  const height = Math.max(0, toFiniteNumber(box?.height) ?? 0);
  return width * height;
};

const getPageOffsetDelta = (page: any) =>
  Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0;

const compareBoxHits = (a: any, b: any) => {
  const diffDelta = (a?.rangeDiff ?? 0) - (b?.rangeDiff ?? 0);
  if (diffDelta !== 0) {
    return diffDelta;
  }
  const areaDelta = (a?.area ?? 0) - (b?.area ?? 0);
  if (areaDelta !== 0) {
    return areaDelta;
  }
  return (b?.depth ?? 0) - (a?.depth ?? 0);
};

const walkBoxes = (
  boxes: any[],
  visitor: (entry: any) => void,
  pageIndex: number,
  page: any,
  parent = null,
  depth = 0
) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return;
  }
  for (const box of boxes) {
    if (!box) {
      continue;
    }
    const entry = { box, pageIndex, page, parent, depth };
    visitor(entry);
    if (Array.isArray(box.children) && box.children.length > 0) {
      walkBoxes(box.children, visitor, pageIndex, page, box, depth + 1);
    }
  }
};

export const getLayoutContentWidth = (layout: any) => {
  const pageWidth = toFiniteNumber(layout?.pageWidth);
  const marginLeft = toFiniteNumber(layout?.margin?.left) ?? 0;
  const marginRight = toFiniteNumber(layout?.margin?.right) ?? 0;
  if (pageWidth == null) {
    return 0;
  }
  return Math.max(0, pageWidth - marginLeft - marginRight);
};

type LayoutBoxMatchOptions = {
  exact?: boolean;
  layoutIndex?: any;
  roles?: string[];
  types?: string[];
  includeTextLineBoxes?: boolean;
  predicate?: (entry: { box: any; pageIndex: number; parent: any; depth: number }) => boolean;
};

const sortBoxHits = (hits: any[]) =>
  hits.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    return compareBoxHits(a, b);
  });

const createBoxHit = ({
  entry,
  start,
  end,
  rangeStart,
  rangeEnd,
}: {
  entry: { box: any; pageIndex: number; page: any; parent: any; depth: number };
  start: number;
  end: number;
  rangeStart: number;
  rangeEnd: number;
}) => ({
  ...entry,
  start,
  end,
  rangeDiff: Math.abs(start - rangeStart) + Math.abs(end - rangeEnd),
  area: getBoxArea(entry.box),
});

const matchesLayoutBoxRange = ({
  start,
  end,
  rangeStart,
  rangeEnd,
  exact,
}: {
  start: number;
  end: number;
  rangeStart: number;
  rangeEnd: number;
  exact?: boolean;
}) => {
  const coversRange = start <= rangeStart && end >= rangeEnd;
  const overlapsRange = end >= rangeStart && start <= rangeEnd;
  return exact ? coversRange : overlapsRange;
};

const matchesLayoutBoxFilters = (
  entry: { box: any; pageIndex: number; parent: any; depth: number },
  roleFilter: Set<string> | null,
  typeFilter: Set<string> | null,
  includeTextLineBoxes: boolean,
  predicate?: (entry: { box: any; pageIndex: number; parent: any; depth: number }) => boolean
) => {
  const box = entry.box;
  if (!includeTextLineBoxes && isTextLineBox(box)) {
    return false;
  }
  if (roleFilter && !roleFilter.has(String(box?.role || ""))) {
    return false;
  }
  if (typeFilter && !typeFilter.has(String(box?.type || ""))) {
    return false;
  }
  if (typeof predicate === "function" && predicate(entry) !== true) {
    return false;
  }
  return true;
};

export const collectAllLayoutBoxesForRange = (
  layout: any,
  minOffset: number,
  maxOffset: number,
  options: LayoutBoxMatchOptions = {}
) => {
  if (!layout || !Number.isFinite(minOffset) || !Number.isFinite(maxOffset)) {
    return [];
  }

  const rangeStart = Math.min(Number(minOffset), Number(maxOffset));
  const rangeEnd = Math.max(Number(minOffset), Number(maxOffset));
  const roleFilter = Array.isArray(options.roles) && options.roles.length > 0 ? new Set(options.roles) : null;
  const typeFilter = Array.isArray(options.types) && options.types.length > 0 ? new Set(options.types) : null;
  const includeTextLineBoxes = options.includeTextLineBoxes === true;
  const hits = [];
  const indexedBoxes = includeTextLineBoxes
    ? Array.isArray(options.layoutIndex?.textBoxes)
      ? options.layoutIndex.textBoxes
      : Array.isArray(options.layoutIndex?.boxes)
        ? options.layoutIndex.boxes
        : null
    : Array.isArray(options.layoutIndex?.boxes)
      ? options.layoutIndex.boxes
      : null;

  if (indexedBoxes && indexedBoxes.length > 0) {
    for (const item of indexedBoxes) {
      if (!item) {
        continue;
      }
      const start = toFiniteNumber(item.start);
      const end = toFiniteNumber(item.end);
      if (start == null || end == null) {
        continue;
      }
      if (
        !matchesLayoutBoxRange({
          start,
          end,
          rangeStart,
          rangeEnd,
          exact: options.exact,
        })
      ) {
        continue;
      }

      const entry = {
        box: item.box,
        pageIndex: Number(item.pageIndex) || 0,
        page: layout?.pages?.[Number(item.pageIndex) || 0] ?? null,
        parent: null,
        depth: Number(item.depth) || 0,
      };
      if (
        !matchesLayoutBoxFilters(
          entry,
          roleFilter,
          typeFilter,
          includeTextLineBoxes,
          options.predicate
        )
      ) {
        continue;
      }

      hits.push(
        createBoxHit({
          entry,
          start,
          end,
          rangeStart,
          rangeEnd,
        })
      );
    }

    return sortBoxHits(hits);
  }

  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const page = layout.pages[pageIndex];
    const pageBoxes = Array.isArray(page?.boxes) ? page.boxes : [];
    const offsetDelta = getPageOffsetDelta(page);
    walkBoxes(pageBoxes, (entry) => {
      const box = entry.box;
      const rawStart = toFiniteNumber(box?.start);
      const rawEnd = toFiniteNumber(box?.end);
      const start = rawStart == null ? null : rawStart + offsetDelta;
      const end = rawEnd == null ? null : rawEnd + offsetDelta;
      if (start == null || end == null) {
        return;
      }
      if (
        !matchesLayoutBoxRange({
          start,
          end,
          rangeStart,
          rangeEnd,
          exact: options.exact,
        })
      ) {
        return;
      }
      if (
        !matchesLayoutBoxFilters(
          entry,
          roleFilter,
          typeFilter,
          includeTextLineBoxes,
          options.predicate
        )
      ) {
        return;
      }
      hits.push(
        createBoxHit({
          entry,
          start,
          end,
          rangeStart,
          rangeEnd,
        })
      );
    }, pageIndex, page);
  }

  return sortBoxHits(hits);
};

export const collectLayoutBoxesForRange = (
  layout: any,
  minOffset: number,
  maxOffset: number,
  options: LayoutBoxMatchOptions = {}
) => {
  const hits = collectAllLayoutBoxesForRange(layout, minOffset, maxOffset, options);
  if (hits.length <= 1) {
    return hits;
  }
  const hitsByPage = new Map<number, any>();
  for (const hit of hits) {
    const previous = hitsByPage.get(hit.pageIndex);
    if (!previous || compareBoxHits(hit, previous) < 0) {
      hitsByPage.set(hit.pageIndex, hit);
    }
  }
  return sortBoxHits(Array.from(hitsByPage.values()));
};

export const collectTextLineBoxesForRange = (
  layout: any,
  minOffset: number,
  maxOffset: number,
  options: Omit<LayoutBoxMatchOptions, "includeTextLineBoxes" | "roles" | "types"> = {}
) =>
  collectAllLayoutBoxesForRange(layout, minOffset, maxOffset, {
    ...options,
    includeTextLineBoxes: true,
    roles: ["text-line"],
  });

export const collectTextLineItemsForRange = (
  layout: any,
  minOffset: number,
  maxOffset: number,
  options: Omit<LayoutBoxMatchOptions, "includeTextLineBoxes" | "roles" | "types"> = {}
) => {
  const hits = collectTextLineBoxesForRange(layout, minOffset, maxOffset, options);
  if (hits.length === 0) {
    return [];
  }

  const items = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const lineIndex = toFiniteNumber(hit?.box?.meta?.lineIndex);
    if (lineIndex == null) {
      continue;
    }
    const page = layout?.pages?.[hit.pageIndex] ?? null;
    const line = Array.isArray(page?.lines) ? page.lines[lineIndex] : null;
    if (!line) {
      continue;
    }
    const key = `${hit.pageIndex}:${lineIndex}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      pageIndex: hit.pageIndex,
      lineIndex,
      line,
      page,
      start: hit.start,
      end: hit.end,
      box: hit.box,
    });
  }

  return items.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    return a.lineIndex - b.lineIndex;
  });
};

export const resolveLayoutBoxRect = ({
  layout,
  box,
  pageIndex,
  scrollTop,
  viewportWidth,
}: {
  layout: any;
  box: any;
  pageIndex: number;
  scrollTop: number;
  viewportWidth: number;
}) => {
  const boxX = toFiniteNumber(box?.x);
  const boxY = toFiniteNumber(box?.y);
  const boxWidth = toFiniteNumber(box?.width);
  const boxHeight = toFiniteNumber(box?.height);
  if (boxX == null || boxY == null || boxWidth == null || boxHeight == null) {
    return null;
  }

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;

  return {
    x: pageX + boxX,
    y: pageIndex * pageSpan - scrollTop + boxY,
    width: Math.max(0, boxWidth),
    height: Math.max(0, boxHeight),
  };
};

const getExplicitVisualBounds = (line: any) => {
  const visualBounds =
    (line?.blockAttrs?.visualBounds && typeof line.blockAttrs.visualBounds === "object"
      ? line.blockAttrs.visualBounds
      : null) ||
    (line?.visualBounds && typeof line.visualBounds === "object" ? line.visualBounds : null);
  return visualBounds;
};

export const resolveLineContentBox = (line: any, layout: any) => {
  const owner = getNearestContentOwner(line);
  const lineX = toFiniteNumber(line?.x) ?? toFiniteNumber(layout?.margin?.left) ?? 0;
  const visualBounds = getExplicitVisualBounds(line);
  const legacyVisualBounds = resolveLegacyLineVisualBounds(line);
  const blockOuterX =
    toFiniteNumber(visualBounds?.x) ?? toFiniteNumber(legacyVisualBounds?.x);
  const blockOuterWidth =
    toFiniteNumber(visualBounds?.width) ?? toFiniteNumber(legacyVisualBounds?.width);

  let x = blockOuterX ?? toFiniteNumber(owner?.x) ?? lineX;
  let width = blockOuterWidth ?? toFiniteNumber(owner?.width) ?? getLayoutContentWidth(layout);

  if (!(width > 0)) {
    const lineWidth = toFiniteNumber(line?.width);
    width = lineWidth ?? 0;
  }

  return {
    owner,
    x,
    width: Math.max(0, width || 0),
  };
};

export const resolveLineVisualBox = (line: any, layout: any) => {
  const contentBox = resolveLineContentBox(line, layout);
  const lineX = toFiniteNumber(line?.x) ?? contentBox.x;
  const lineWidth = Math.max(0, toFiniteNumber(line?.width) ?? 0);
  const visualBounds = getExplicitVisualBounds(line);
  const legacyVisualBounds = resolveLegacyLineVisualBounds(line);
  const outerX =
    toFiniteNumber(visualBounds?.x) ?? toFiniteNumber(legacyVisualBounds?.x) ?? lineX;
  let outerWidth =
    toFiniteNumber(visualBounds?.width) ?? toFiniteNumber(legacyVisualBounds?.width);

  if (!(outerWidth > 0)) {
    outerWidth = lineWidth > 0 ? lineWidth : contentBox.width;
  }

  const lineRight = lineX + lineWidth;
  const outerRight = outerX + outerWidth;
  const hasOuterBounds =
    outerWidth > 0 &&
    (Math.abs(outerX - lineX) > 0.5 || Math.abs(outerRight - lineRight) > 0.5);

  return {
    owner: contentBox.owner,
    lineX,
    lineWidth,
    contentX: contentBox.x,
    contentWidth: contentBox.width,
    outerX,
    outerWidth: Math.max(0, outerWidth || 0),
    hasOuterBounds,
  };
};

export const resolveEmptyLineWidth = (line: any, layout: any) => {
  const box = resolveLineVisualBox(line, layout);
  const startX = box.lineX;
  const right = Math.max(box.contentX + box.contentWidth, box.outerX + box.outerWidth, startX);
  return Math.max(0, right - startX);
};
