type CreateStateSyncScrollCoordinatorArgs = {
  hasPendingLayoutWork: () => boolean;
  scrollIntoViewAtPos?: (pos?: number) => void;
};

export const createStateSyncScrollCoordinator = ({
  hasPendingLayoutWork,
  scrollIntoViewAtPos,
}: CreateStateSyncScrollCoordinatorArgs) => {
  let pendingScrollIntoViewPos: number | null = null;
  let hasPendingScrollIntoView = false;

  const flushPendingScrollIntoView = () => {
    if (!hasPendingScrollIntoView) {
      return;
    }
    const requestedPos = pendingScrollIntoViewPos;
    hasPendingScrollIntoView = false;
    pendingScrollIntoViewPos = null;
    if (typeof scrollIntoViewAtPos !== "function") {
      return;
    }
    try {
      scrollIntoViewAtPos(Number.isFinite(requestedPos) ? Number(requestedPos) : undefined);
    } catch (_error) {
      // no-op
    }
  };

  const requestScrollIntoView = (pos?: number | null) => {
    pendingScrollIntoViewPos = Number.isFinite(pos) ? Number(pos) : null;
    hasPendingScrollIntoView = true;
    if (!hasPendingLayoutWork()) {
      flushPendingScrollIntoView();
    }
  };

  const flushPendingScrollIntoViewIfReady = () => {
    if (!hasPendingLayoutWork()) {
      flushPendingScrollIntoView();
    }
  };

  return {
    requestScrollIntoView,
    flushPendingScrollIntoView,
    flushPendingScrollIntoViewIfReady,
  };
};
