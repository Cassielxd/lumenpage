export const findFallbackNodeViewEntryAtDocPos = ({
  entries,
  pos,
}: {
  entries: Iterable<any>;
  pos: number;
}) => {
  if (!Number.isFinite(pos)) {
    return null;
  }
  let fallback = null;
  for (const entry of entries) {
    if (!entry?.node || !Number.isFinite(entry?.pos)) {
      continue;
    }
    const from = entry.pos;
    const to = entry.pos + (entry.node.nodeSize ?? 0);
    if (pos < from || pos > to) {
      continue;
    }
    if (!fallback) {
      fallback = entry;
      continue;
    }
    const currentSize = fallback.node?.nodeSize ?? Number.MAX_SAFE_INTEGER;
    const nextSize = entry.node?.nodeSize ?? Number.MAX_SAFE_INTEGER;
    if (nextSize <= currentSize) {
      fallback = entry;
    }
  }
  return fallback;
};

export const findNodeViewEntryAtDocPos = ({
  entries,
  nodeViewsByBlockId,
  pos,
  docPosToTextOffset,
  getPreferredBlockIdFromLine,
  getLineAtOffset,
  layoutIndex,
  doc,
}: {
  entries: Iterable<any>;
  nodeViewsByBlockId: Map<string, any>;
  pos: number;
  docPosToTextOffset: (doc: any, pos: number) => number;
  getPreferredBlockIdFromLine: (line: any) => any;
  getLineAtOffset: (layoutIndex: any, offset: number) => any;
  layoutIndex: any;
  doc: any;
}) => {
  if (!Number.isFinite(pos) || !layoutIndex || !doc) {
    return null;
  }

  const offset = docPosToTextOffset(doc, pos);
  const lineItem = getLineAtOffset(layoutIndex, offset);
  const blockId = getPreferredBlockIdFromLine(lineItem?.line);
  if (blockId) {
    const fromBlockId = nodeViewsByBlockId.get(blockId) ?? null;
    if (fromBlockId?.view) {
      return fromBlockId;
    }
  }

  return findFallbackNodeViewEntryAtDocPos({ entries, pos });
};
