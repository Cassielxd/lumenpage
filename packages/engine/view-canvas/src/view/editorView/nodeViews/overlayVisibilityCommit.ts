export const commitNodeViewOverlayVisibility = ({
  nodeViews,
  lastVisibleOverlayKeys,
  nextVisibleOverlayKeys,
}: {
  nodeViews: Map<string, any>;
  lastVisibleOverlayKeys: Set<string>;
  nextVisibleOverlayKeys: Set<string>;
}) => {
  for (const key of lastVisibleOverlayKeys) {
    if (nextVisibleOverlayKeys.has(key)) {
      continue;
    }
    const entry = nodeViews.get(key);
    entry?.view?.syncDOM?.({ visible: false });
  }
  return nextVisibleOverlayKeys;
};
