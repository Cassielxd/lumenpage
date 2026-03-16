export const createNodeViewDocumentSync = ({
  view,
  managerState,
  getState,
  nodeRegistry,
  getNodeViewFactories,
  getDecorations,
  getPosByBlockId,
  getDocTopLevelBlockIndexForDoc,
  getNodeViewKey,
  syncNodeViewSelection,
}: {
  view: any;
  managerState: any;
  getState: () => any;
  nodeRegistry: any;
  getNodeViewFactories?: () => any;
  getDecorations?: () => any;
  getPosByBlockId: (blockId: any) => any;
  getDocTopLevelBlockIndexForDoc: (doc: any) => any;
  getNodeViewKey: (node: any, pos: number) => string;
  syncNodeViewSelection: () => void;
}) => {
  const destroyEntry = (entry: any) => {
    if (!entry) {
      return;
    }
    managerState.nodeViews.delete(entry.key);
    if (entry.blockId && managerState.nodeViewsByBlockId.get(entry.blockId) === entry) {
      managerState.nodeViewsByBlockId.delete(entry.blockId);
    }
    entry.view?.destroy?.();
  };

  const createEntry = (node: any, pos: number, factory: any, key: string) => {
    const entry: any = {
      node,
      pos,
      view: null,
      key,
      blockId: node?.attrs?.id ?? null,
      getPos: () => entry.pos,
    };
    entry.getPos = () => {
      if (entry.blockId) {
        const currentPos = getPosByBlockId(entry.blockId);
        if (Number.isFinite(currentPos)) {
          entry.pos = currentPos;
          return currentPos;
        }
      }
      return entry.pos;
    };
    const nodeView = factory(node, view, entry.getPos);
    if (!nodeView) {
      return null;
    }
    entry.view = nodeView;
    return entry;
  };

  const resolveNodeViewFactory = (activeNodeViewFactories: any, node: any) => {
    const renderer = nodeRegistry?.get?.(node?.type?.name);
    return activeNodeViewFactories?.[node?.type?.name] ?? renderer?.createNodeView;
  };

  const fullSync = (state: any, decorations: any, activeNodeViewFactories: any) => {
    const nextViews = new Map<string, any>();
    const nextByBlockId = new Map<string, any>();

    state.doc.descendants((node: any, pos: number) => {
      const factory = resolveNodeViewFactory(activeNodeViewFactories, node);
      if (typeof factory !== "function") {
        return;
      }

      const key = getNodeViewKey(node, pos);
      let entry = managerState.nodeViews.get(key);
      if (!entry) {
        entry = createEntry(node, pos, factory, key);
        if (!entry) {
          return;
        }
      } else {
        const shouldUpdate = entry.view?.update?.(node, decorations);
        if (shouldUpdate === false) {
          entry.view?.destroy?.();
          entry = createEntry(node, pos, factory, key);
          if (!entry) {
            return;
          }
        } else {
          entry.node = node;
          entry.pos = pos;
          entry.blockId = node.attrs?.id ?? entry.blockId;
        }
      }

      nextViews.set(key, entry);
      if (entry.blockId) {
        nextByBlockId.set(entry.blockId, entry);
      }
    });

    for (const [key, entry] of managerState.nodeViews.entries()) {
      if (!nextViews.has(key)) {
        entry.view?.destroy?.();
      }
    }

    managerState.nodeViews.clear();
    managerState.nodeViewsByBlockId.clear();
    for (const [key, entry] of nextViews.entries()) {
      managerState.nodeViews.set(key, entry);
    }
    for (const [blockId, entry] of nextByBlockId.entries()) {
      managerState.nodeViewsByBlockId.set(blockId, entry);
    }
  };

  const syncNodeViews = (changeSummary: any = null) => {
    const state = getState();
    if (!state?.doc) {
      return;
    }
    const activeNodeViewFactories =
      typeof getNodeViewFactories === "function" ? getNodeViewFactories() : null;
    if (!nodeRegistry && !activeNodeViewFactories) {
      return;
    }

    const decorations = typeof getDecorations === "function" ? getDecorations() : null;
    if (changeSummary?.docChanged !== true) {
      syncNodeViewSelection();
      return;
    }

    const changedIds = Array.isArray(changeSummary?.blocks?.ids)
      ? changeSummary.blocks.ids.filter(Boolean)
      : [];
    const canIncremental =
      changedIds.length > 0 &&
      managerState.nodeViews.size > 0 &&
      managerState.nodeViews.size === managerState.nodeViewsByBlockId.size;

    if (!canIncremental) {
      fullSync(state, decorations, activeNodeViewFactories);
      syncNodeViewSelection();
      return;
    }

    const topLevelIndex = getDocTopLevelBlockIndexForDoc(state.doc);
    for (const blockId of changedIds) {
      const current = topLevelIndex.byId.get(blockId) ?? null;
      const existing = managerState.nodeViewsByBlockId.get(blockId) ?? null;
      if (!current) {
        destroyEntry(existing);
        continue;
      }
      const factory = resolveNodeViewFactory(activeNodeViewFactories, current.node);
      if (typeof factory !== "function") {
        destroyEntry(existing);
        continue;
      }
      const nextKey = getNodeViewKey(current.node, current.pos);
      let entry = existing;
      if (entry && entry.key !== nextKey) {
        destroyEntry(entry);
        entry = null;
      }
      if (!entry) {
        entry = createEntry(current.node, current.pos, factory, nextKey);
        if (!entry) {
          continue;
        }
        managerState.nodeViews.set(entry.key, entry);
        if (entry.blockId) {
          managerState.nodeViewsByBlockId.set(entry.blockId, entry);
        }
        continue;
      }
      const shouldUpdate = entry.view?.update?.(current.node, decorations);
      if (shouldUpdate === false) {
        destroyEntry(entry);
        const recreated = createEntry(current.node, current.pos, factory, nextKey);
        if (!recreated) {
          continue;
        }
        managerState.nodeViews.set(recreated.key, recreated);
        if (recreated.blockId) {
          managerState.nodeViewsByBlockId.set(recreated.blockId, recreated);
        }
        continue;
      }
      entry.node = current.node;
      entry.pos = current.pos;
      entry.blockId = current.node?.attrs?.id ?? entry.blockId;
      managerState.nodeViews.set(entry.key, entry);
      if (entry.blockId) {
        managerState.nodeViewsByBlockId.set(entry.blockId, entry);
      }
    }

    syncNodeViewSelection();
  };

  const destroyNodeViews = () => {
    for (const entry of managerState.nodeViews.values()) {
      entry.view?.destroy?.();
    }
    managerState.nodeViews.clear();
    managerState.nodeViewsByBlockId.clear();
    managerState.selectedNodeViewKey = null;
    managerState.lastVisibleOverlayKeys = new Set();
  };

  return {
    syncNodeViews,
    destroyNodeViews,
  };
};
