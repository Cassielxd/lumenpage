type CreateNodeOverlaySyncCoordinatorArgs = {
  scrollArea: any;
  syncNodeViewOverlays?: (args: { layout: any; layoutIndex: any; scrollArea: any }) => void;
};

export const createNodeOverlaySyncCoordinator = ({
  scrollArea,
  syncNodeViewOverlays,
}: CreateNodeOverlaySyncCoordinatorArgs) => {
  let overlaySyncRafId = 0;
  let pendingOverlaySyncContext: { layout: any; layoutIndex: any } | null = null;
  let lastOverlayLayoutToken = -1;
  let lastOverlayScrollTop = Number.NaN;
  let lastOverlayViewportWidth = -1;

  const scheduleNodeOverlaySync = (layout: any, layoutIndex: any) => {
    pendingOverlaySyncContext = { layout, layoutIndex };
    if (overlaySyncRafId) {
      return;
    }
    overlaySyncRafId = requestAnimationFrame(() => {
      overlaySyncRafId = 0;
      const context = pendingOverlaySyncContext;
      pendingOverlaySyncContext = null;
      if (!context) {
        return;
      }
      syncNodeViewOverlays?.({
        layout: context.layout,
        layoutIndex: context.layoutIndex,
        scrollArea,
      });
    });
  };

  const syncForFrame = ({
    layout,
    layoutIndex,
    layoutToken,
    scrollTop,
    viewportWidth,
  }: {
    layout: any;
    layoutIndex: any;
    layoutToken: number;
    scrollTop: number;
    viewportWidth: number;
  }) => {
    const overlayNeedsSync =
      layoutToken !== lastOverlayLayoutToken ||
      !Number.isFinite(lastOverlayScrollTop) ||
      Math.abs(scrollTop - lastOverlayScrollTop) > 0.5 ||
      viewportWidth !== lastOverlayViewportWidth;
    if (!overlayNeedsSync) {
      return;
    }
    lastOverlayLayoutToken = layoutToken;
    lastOverlayScrollTop = scrollTop;
    lastOverlayViewportWidth = viewportWidth;
    scheduleNodeOverlaySync(layout, layoutIndex);
  };

  return {
    syncForFrame,
    destroy: () => {
      if (overlaySyncRafId) {
        cancelAnimationFrame(overlaySyncRafId);
        overlaySyncRafId = 0;
      }
      pendingOverlaySyncContext = null;
    },
  };
};
