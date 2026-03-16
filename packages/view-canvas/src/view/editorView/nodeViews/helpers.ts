import { NodeSelection } from "lumenpage-state";

export const getDocTopLevelBlockIndex = (managerState: any, doc: any) => {
  const cached = managerState.docTopLevelBlockIndexCache.get(doc);
  if (cached) {
    return cached;
  }
  const byId = new Map<string, any>();
  doc?.forEach?.((node: any, pos: number, index: number) => {
    const blockId = node?.attrs?.id ?? null;
    if (!blockId) {
      return;
    }
    byId.set(blockId, { node, pos, index });
  });
  const next = { byId };
  managerState.docTopLevelBlockIndexCache.set(doc, next);
  return next;
};

export const lineHasTextContent = (line: any) => {
  if (!line) {
    return false;
  }
  if (typeof line.text === "string" && line.text.length > 0) {
    return true;
  }
  if (Array.isArray(line.runs)) {
    for (const run of line.runs) {
      if (typeof run?.text === "string" && run.text.length > 0) {
        return true;
      }
    }
  }
  return false;
};

export const getPreferredBlockIdFromLine = (line: any) => {
  if (line?.blockId) {
    return line.blockId;
  }
  const owners = Array.isArray(line?.fragmentOwners) ? line.fragmentOwners : [];
  for (let index = owners.length - 1; index >= 0; index -= 1) {
    const owner = owners[index];
    if (owner?.blockId != null) {
      return owner.blockId;
    }
    if (owner?.nodeId != null) {
      return owner.nodeId;
    }
  }
  return null;
};

export const getNodeViewKey = (node: any, pos: number) => {
  const id = node?.attrs?.id;
  if (id) {
    return `${node.type.name}:${id}`;
  }
  return `${node.type.name}:${pos}`;
};

export const resolveNodeViewEntry = (nodeViews: Map<string, any>, nodeView: any) => {
  if (!nodeView) {
    return null;
  }
  for (const entry of nodeViews.values()) {
    if (entry.view === nodeView) {
      return entry;
    }
  }
  return null;
};

export const getPosByBlockId = ({
  blockId,
  getState,
  nodeViewsByBlockId,
  getDocTopLevelBlockIndexForDoc,
}: {
  blockId: any;
  getState: () => any;
  nodeViewsByBlockId: Map<string, any>;
  getDocTopLevelBlockIndexForDoc: (doc: any) => any;
}) => {
  if (!blockId) {
    return null;
  }
  const state = getState();
  if (!state?.doc) {
    return null;
  }
  const topLevelEntry = getDocTopLevelBlockIndexForDoc(state.doc).byId.get(blockId) ?? null;
  if (topLevelEntry && Number.isFinite(topLevelEntry.pos)) {
    return topLevelEntry.pos;
  }
  if (nodeViewsByBlockId.has(blockId)) {
    const pos = nodeViewsByBlockId.get(blockId)?.pos;
    if (Number.isFinite(pos)) {
      return pos;
    }
  }
  let found = null;
  state.doc.descendants((node: any, pos: number) => {
    if (node?.attrs?.id === blockId) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
};

export const resolveSelectableAtResolvedPos = ($pos: any, preferredBlockId: any = null) => {
  if (!$pos) {
    return null;
  }
  const candidates = [];
  const after = $pos.nodeAfter;
  if (after && NodeSelection.isSelectable(after)) {
    candidates.push({ node: after, pos: $pos.pos });
  }
  const before = $pos.nodeBefore;
  if (before && NodeSelection.isSelectable(before)) {
    candidates.push({ node: before, pos: $pos.pos - before.nodeSize });
  }
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    const pos = $pos.before(depth);
    if (node && NodeSelection.isSelectable(node)) {
      candidates.push({ node, pos });
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  if (preferredBlockId != null) {
    const matched = candidates.find((item) => item?.node?.attrs?.id === preferredBlockId);
    if (matched) {
      return matched;
    }
  }
  return candidates[0];
};
