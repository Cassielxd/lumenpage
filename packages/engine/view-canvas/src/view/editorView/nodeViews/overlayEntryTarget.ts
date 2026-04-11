export const resolveNodeViewOverlaySyncTarget = ({
  entry,
  layout,
  layoutIndex,
  scrollTop,
  viewportWidth,
  viewportHeight,
  doc,
  docPosToTextOffset,
  getLineAtOffset,
  getNodeViewEntryPos,
  requiresBoxAnchoredOverlay,
  resolveNodeViewBoxRect,
}: {
  entry: any;
  layout: any;
  layoutIndex: any;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  doc: any;
  docPosToTextOffset: (doc: any, pos: number) => number;
  getLineAtOffset: (layoutIndex: any, offset: number) => any;
  getNodeViewEntryPos: (entry: any) => number | null;
  requiresBoxAnchoredOverlay: (entry: any) => boolean;
  resolveNodeViewBoxRect: (args: {
    entry: any;
    layout: any;
    layoutIndex: any;
    scrollTop: number;
    viewportWidth: number;
    viewportHeight: number;
    doc: any;
  }) => any;
}) => {
  const boxRect = resolveNodeViewBoxRect({
    entry,
    layout,
    layoutIndex,
    scrollTop,
    viewportWidth,
    viewportHeight,
    doc,
  });

  let item = null;
  if (!requiresBoxAnchoredOverlay(entry)) {
    const entryPos = getNodeViewEntryPos(entry);
    if (Number.isFinite(entryPos)) {
      const offset = docPosToTextOffset(doc, entryPos);
      item = getLineAtOffset(layoutIndex, offset);
    }
  }

  return {
    boxRect,
    item,
  };
};
