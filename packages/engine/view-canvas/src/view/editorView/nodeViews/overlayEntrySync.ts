import { resolveCachedOverlayReuseFrame, resolveOverlaySyncFrame } from "./overlayFrame.js";
import {
  createOverlayFrameTracePayload,
  createOverlayReasonTracePayload,
} from "./overlayTracePayload.js";
import {
  applyCachedOverlayFrame,
  applyResolvedOverlayFrame,
  createOverlayCacheState,
  hideOverlayEntry,
} from "./overlaySyncApply.js";
import { canReuseCachedOverlayState, shouldEmitNodeOverlayTrace } from "./overlaySyncPolicy.js";
import { requiresBoxAnchoredOverlay } from "./overlayGeometryHeuristics.js";

export const syncNodeViewOverlayEntry = ({
  entry,
  item = null,
  boxRect = null,
  layout,
  scrollTop,
  viewportWidth,
  viewportHeight,
  hasPendingDocLayout,
  currentLayoutVersion,
  lastVisibleOverlayKeys,
  lastOverlayStateByKey,
  emitTrace,
}: {
  entry: any;
  item?: any;
  boxRect?: any;
  layout: any;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  hasPendingDocLayout: boolean;
  currentLayoutVersion: number | null;
  lastVisibleOverlayKeys: Set<string>;
  lastOverlayStateByKey: Map<string, any>;
  emitTrace?: ((payload: any) => void) | null;
}) => {
  if (!entry?.view) {
    return false;
  }

  if (!item && !boxRect) {
    const cachedOverlayState = lastOverlayStateByKey.get(entry.key) ?? null;
    if (
      requiresBoxAnchoredOverlay(entry) &&
      canReuseCachedOverlayState({
        cached: cachedOverlayState,
        scrollTop,
        viewportWidth,
        layoutVersion: currentLayoutVersion,
      })
    ) {
      const cachedFrame = resolveCachedOverlayReuseFrame({
        cachedOverlayState,
        scrollTop,
        viewportHeight,
      });
      if (shouldEmitNodeOverlayTrace({ entry, reason: "reuse-last-box-geometry" })) {
        emitTrace?.(
          createOverlayReasonTracePayload({
            entry,
            visible: cachedFrame?.visible === true,
            reason: "reuse-last-box-geometry",
            cachedOverlayState,
          })
        );
      }
      return applyCachedOverlayFrame({
        entry,
        frame: cachedFrame,
        layout,
      });
    }

    if (requiresBoxAnchoredOverlay(entry) && hasPendingDocLayout) {
      const preservedVisible = lastVisibleOverlayKeys.has(entry.key);
      if (shouldEmitNodeOverlayTrace({ entry, reason: "defer-missing-box-pending-layout" })) {
        emitTrace?.(
          createOverlayReasonTracePayload({
            entry,
            visible: preservedVisible,
            reason: "defer-missing-box-pending-layout",
          })
        );
      }
      return preservedVisible;
    }

    lastOverlayStateByKey.delete(entry.key);
    if (shouldEmitNodeOverlayTrace({ entry, reason: "no-box-or-line" })) {
      emitTrace?.(
        createOverlayReasonTracePayload({
          entry,
          visible: false,
          reason: "no-box-or-line",
        })
      );
    }
    return hideOverlayEntry(entry);
  }

  const frame = resolveOverlaySyncFrame({
    entry,
    item,
    boxRect,
    layout,
    scrollTop,
    viewportWidth,
    viewportHeight,
  });

  if (shouldEmitNodeOverlayTrace({ entry, boxRect, line: frame.line, visible: frame.visible })) {
    emitTrace?.(
      createOverlayFrameTracePayload({
        entry,
        frame,
        boxRect,
      })
    );
  }

  applyResolvedOverlayFrame({
    entry,
    frame,
    layout,
  });

  if (requiresBoxAnchoredOverlay(entry) && boxRect) {
    lastOverlayStateByKey.set(
      entry.key,
      createOverlayCacheState({
        frame,
        scrollTop,
        viewportWidth,
        layoutVersion: currentLayoutVersion,
      })
    );
  }

  return frame.visible === true;
};
