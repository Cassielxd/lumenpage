import { now } from "./debugTrace";
import { isProgressiveLayoutApplied, isProgressiveLayoutTruncated } from "./layoutRuntimeMetadata";

const CONTINUOUS_EDIT_THRESHOLD = 3;

type ProgressiveLayoutControllerArgs = {
  getLayout: () => any;
  hasPendingLayoutWork: () => boolean;
  requestLayoutPass: () => void;
};

type ProgressiveLayoutAppliedArgs = {
  layout: any;
  prevLayout: any;
  incrementalEnabled: boolean;
  settleDelayMs: number;
};

const scheduleIdle = (callback: () => void) => {
  if (typeof requestIdleCallback === "function") {
    return requestIdleCallback(() => callback(), { timeout: 2000 }) as unknown as number;
  }
  if (typeof window !== "undefined") {
    return window.setTimeout(callback, 100);
  }
  return setTimeout(callback, 100) as unknown as number;
};

const cancelIdle = (id: number) => {
  if (typeof cancelIdleCallback === "function") {
    cancelIdleCallback(id);
    return;
  }
  if (typeof window !== "undefined") {
    window.clearTimeout(id);
    return;
  }
  clearTimeout(id);
};

export const createProgressiveLayoutController = ({
  getLayout,
  hasPendingLayoutWork,
  requestLayoutPass,
}: ProgressiveLayoutControllerArgs) => {
  let fullSettleTimer: ReturnType<typeof setTimeout> | null = null;
  let forceFullPass = false;
  let continuousEditCount = 0;
  let backgroundFullLayoutPending = false;
  let backgroundLayoutRafId: number | null = null;
  let needsFullLayout = false;
  let lastDocEditAt = 0;
  let backgroundFullLayoutDelayMs = 1500;

  const clearFullSettleTimer = () => {
    if (!fullSettleTimer) {
      return;
    }
    clearTimeout(fullSettleTimer);
    fullSettleTimer = null;
  };

  const cancelScheduledBackgroundFullLayout = () => {
    if (backgroundLayoutRafId != null) {
      cancelIdle(backgroundLayoutRafId);
      backgroundLayoutRafId = null;
    }
    backgroundFullLayoutPending = false;
  };

  const scheduleBackgroundFullLayout = () => {
    if (backgroundLayoutRafId != null || backgroundFullLayoutPending || !needsFullLayout) {
      return;
    }
    backgroundFullLayoutPending = true;

    const runBackgroundLayout = () => {
      backgroundLayoutRafId = null;
      backgroundFullLayoutPending = false;

      if (now() - lastDocEditAt < backgroundFullLayoutDelayMs) {
        backgroundLayoutRafId = scheduleIdle(runBackgroundLayout);
        backgroundFullLayoutPending = true;
        return;
      }

      if (hasPendingLayoutWork()) {
        backgroundLayoutRafId = scheduleIdle(runBackgroundLayout);
        backgroundFullLayoutPending = true;
        return;
      }

      const prevLayout = getLayout();
      if (!prevLayout || prevLayout.pages.length <= 50) {
        needsFullLayout = false;
        return;
      }

      forceFullPass = true;
      needsFullLayout = false;
      requestLayoutPass();
    };

    backgroundLayoutRafId = scheduleIdle(runBackgroundLayout);
  };

  return {
    onDocChanged(timestamp = now()) {
      lastDocEditAt = timestamp;
      cancelScheduledBackgroundFullLayout();
    },

    consumeForceFullPass() {
      const shouldForce = forceFullPass === true;
      if (shouldForce) {
        forceFullPass = false;
      }
      return shouldForce;
    },

    onLayoutApplied({
      layout,
      prevLayout,
      incrementalEnabled,
      settleDelayMs,
    }: ProgressiveLayoutAppliedArgs) {
      backgroundFullLayoutDelayMs = Math.max(settleDelayMs * 4, 1500);
      const isProgressive = isProgressiveLayoutApplied(layout) && incrementalEnabled;

      if (!isProgressive) {
        continuousEditCount = 0;
        needsFullLayout = false;
        clearFullSettleTimer();
        return false;
      }

      continuousEditCount += 1;
      const appliedLayout = getLayout();
      const isLargeDocument = !!(appliedLayout && appliedLayout.pages.length > 50);
      const progressiveTruncated = isProgressiveLayoutTruncated(layout);
      const prevPageCount = prevLayout?.pages?.length ?? 0;
      const appliedPageCount = appliedLayout?.pages?.length ?? 0;
      const pageCountIncreased = appliedPageCount > prevPageCount;

      if (isLargeDocument && (pageCountIncreased || progressiveTruncated)) {
        needsFullLayout = true;
        clearFullSettleTimer();
        fullSettleTimer = setTimeout(() => {
          fullSettleTimer = null;
          if (!needsFullLayout) {
            return;
          }
          if (now() - lastDocEditAt < backgroundFullLayoutDelayMs) {
            return;
          }
          scheduleBackgroundFullLayout();
        }, backgroundFullLayoutDelayMs);
      } else if (!pageCountIncreased && !progressiveTruncated) {
        needsFullLayout = false;
      }

      if (!isLargeDocument && continuousEditCount >= CONTINUOUS_EDIT_THRESHOLD) {
        clearFullSettleTimer();
        fullSettleTimer = setTimeout(() => {
          fullSettleTimer = null;
          forceFullPass = true;
          continuousEditCount = 0;
          needsFullLayout = false;
          requestLayoutPass();
        }, settleDelayMs);
      }

      return true;
    },

    destroy() {
      clearFullSettleTimer();
      cancelScheduledBackgroundFullLayout();
    },
  };
};
