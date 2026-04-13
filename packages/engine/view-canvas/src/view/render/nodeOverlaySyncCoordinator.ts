import { emitGhostTrace } from "../debugTrace.js";
import { getLayoutVersion } from "../layoutRuntimeMetadata.js";

type CreateNodeOverlaySyncCoordinatorArgs = {
  scrollArea: any;
  settings?: any;
  syncNodeViewOverlays?: (args: { layout: any; layoutIndex: any; scrollArea: any }) => void;
};

export const createNodeOverlaySyncCoordinator = ({
  scrollArea,
  settings,
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
      emitGhostTrace(
        "node-overlay-sync",
        {
          phase: "raf",
          layoutToken: Number.isFinite(getLayoutVersion(context?.layout))
            ? Number(getLayoutVersion(context?.layout))
            : Number.isFinite(lastOverlayLayoutToken)
              ? Number(lastOverlayLayoutToken)
              : null,
          scrollTop: scrollArea?.scrollTop ?? null,
          viewportWidth: scrollArea?.clientWidth ?? null,
          viewportHeight: scrollArea?.clientHeight ?? null,
        },
        settings
      );
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
    const layoutChanged = layoutToken !== lastOverlayLayoutToken;
    const overlayNeedsSync =
      layoutChanged ||
      !Number.isFinite(lastOverlayScrollTop) ||
      Math.abs(scrollTop - lastOverlayScrollTop) > 0.5 ||
      viewportWidth !== lastOverlayViewportWidth;
    if (!overlayNeedsSync) {
      return;
    }
    emitGhostTrace(
      "node-overlay-sync",
      {
        phase: layoutChanged ? "layout" : "schedule",
        layoutToken,
        layoutChanged,
        scrollTop,
        lastScrollTop: Number.isFinite(lastOverlayScrollTop) ? lastOverlayScrollTop : null,
        scrollDelta: Number.isFinite(lastOverlayScrollTop) ? scrollTop - lastOverlayScrollTop : null,
        viewportWidth,
        lastViewportWidth:
          Number.isFinite(lastOverlayViewportWidth) && lastOverlayViewportWidth >= 0
            ? lastOverlayViewportWidth
            : null,
        viewportHeight: scrollArea?.clientHeight ?? null,
      },
      settings
    );
    lastOverlayLayoutToken = layoutToken;
    lastOverlayScrollTop = scrollTop;
    lastOverlayViewportWidth = viewportWidth;
    if (layoutChanged) {
      pendingOverlaySyncContext = null;
      if (overlaySyncRafId) {
        cancelAnimationFrame(overlaySyncRafId);
        overlaySyncRafId = 0;
      }
      syncNodeViewOverlays?.({
        layout,
        layoutIndex,
        scrollArea,
      });
      return;
    }
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
