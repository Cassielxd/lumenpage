export type UnsplittableBlockLayout = {
  width: number;
  height: number;
  line: any;
  blockAttrs: any;
  length?: number;
};

const resolveCursorStartPos = (ctx: any, measured: any, fallback: number) => {
  if (Number.isFinite(ctx?.cursor?.startPos)) {
    return Number(ctx.cursor.startPos);
  }
  if (Number.isFinite(measured?.startPos)) {
    return Number(measured.startPos);
  }
  return fallback;
};

const cloneLine = (line: any, blockAttrs: any) => ({
  ...line,
  runs: Array.isArray(line?.runs) ? line.runs.map((run: any) => ({ ...run })) : line?.runs,
  blockAttrs: blockAttrs ? { ...blockAttrs } : line?.blockAttrs ? { ...line.blockAttrs } : {},
});

export const createUnsplittableBlockPagination = (
  kind: string,
  buildLayout: (ctx: any) => UnsplittableBlockLayout,
) => ({
  measureBlock(ctx: any) {
    const layout = buildLayout(ctx);
    const startPos = Number.isFinite(ctx?.startPos ?? ctx?.blockStart)
      ? Number(ctx?.startPos ?? ctx?.blockStart)
      : 0;
    const length = Math.max(0, Number(layout?.length ?? 1));
    return {
      kind,
      nodeId: ctx?.node?.attrs?.id ?? null,
      blockId: ctx?.node?.attrs?.id ?? null,
      startPos,
      endPos: startPos + length,
      width: Number(layout?.width || 0),
      height: Number(layout?.height || 0),
      meta: {
        source: `${kind}-modern-measure`,
        line: layout?.line ?? null,
        blockAttrs: layout?.blockAttrs ?? null,
        length,
      },
    };
  },

  paginateBlock(ctx: any) {
    const measured = ctx?.measured;
    const measuredLine = measured?.meta?.line ?? null;
    const measuredBlockAttrs = measured?.meta?.blockAttrs ?? null;
    const length = Math.max(0, Number(measured?.meta?.length ?? 1));
    const line = measuredLine ? cloneLine(measuredLine, measuredBlockAttrs) : null;
    const blockAttrs = measuredBlockAttrs ? { ...measuredBlockAttrs } : null;
    const cursorPlaced = ctx?.cursor?.localCursor?.placed === true;

    if (!measured || !line || !blockAttrs || cursorPlaced) {
      const endPos = Number(measured?.endPos || measured?.startPos || 0);
      return {
        slice: {
          kind,
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: endPos,
          endPos,
          fromPrev: false,
          hasNext: false,
          boxes: [],
          fragments: [],
          lines: [],
          nextCursor: null,
          meta: {
            source: `${kind}-modern-paginate`,
            exhausted: true,
          },
        },
        nextCursor: null,
        exhausted: true,
      };
    }

    const availableHeight = Number(ctx?.availableHeight || 0);
    const pageHasLines = ctx?.pageHasLines === true;
    const fits = availableHeight >= Number(measured.height || 0);

    if (!fits && pageHasLines) {
      const nextCursor = {
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: Number(measured?.startPos || 0),
        endPos: Number(measured?.startPos || 0) + length,
        localCursor: { placed: false },
        meta: {
          source: `${kind}-modern-paginate`,
          reason: "retry-on-fresh-page",
        },
      };
      return {
        slice: {
          kind,
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: Number(measured?.startPos || 0),
          endPos: Number(measured?.startPos || 0),
          fromPrev: false,
          hasNext: true,
          boxes: [],
          fragments: [],
          lines: [],
          nextCursor,
          meta: {
            source: `${kind}-modern-paginate`,
            deferred: true,
          },
        },
        nextCursor,
        exhausted: false,
      };
    }

    const sliceStartPos = resolveCursorStartPos(ctx, measured, Number(measured?.startPos || 0));
    const sliceEndPos = Number(measured?.startPos || 0) + length;
    return {
      slice: {
        kind,
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: sliceStartPos,
        endPos: sliceEndPos,
        fromPrev: false,
        hasNext: false,
        boxes: [],
        fragments: [],
        lines: [line],
        nextCursor: null,
        meta: {
          source: `${kind}-modern-paginate`,
          placed: true,
        },
      },
      nextCursor: null,
      exhausted: true,
    };
  },
});
