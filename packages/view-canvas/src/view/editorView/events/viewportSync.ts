const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const logEventTiming = (_enabled: boolean, _name: string, _startedAt: number) => {};

export const createViewportSyncScheduler = ({
  hasFocus,
  updateStatus,
  updateCaret,
  scheduleRender,
  eventTiming = false,
}: {
  hasFocus: () => boolean;
  updateStatus: () => void;
  updateCaret: (updatePreferred: boolean) => void;
  scheduleRender: () => void;
  eventTiming?: boolean;
}) => {
  let scrollRafId = 0;
  let resizeRafId = 0;

  const scheduleViewportSync = (
    getHandle: () => number,
    setHandle: (value: number) => void,
    label: string
  ) => {
    if (getHandle()) {
      return;
    }
    setHandle(
      requestAnimationFrame(() => {
        setHandle(0);
        updateCaret(false);
        scheduleRender();
      })
    );
    logEventTiming(eventTiming, label, now());
  };

  const onDocumentSelectionChange = () => {
    const startedAt = eventTiming ? now() : 0;
    if (!hasFocus()) {
      logEventTiming(eventTiming, "selectionchange:blur", startedAt);
      return;
    }
    updateStatus();
    updateCaret(false);
    scheduleRender();
    logEventTiming(eventTiming, "selectionchange", startedAt);
  };

  const onScroll = () => {
    scheduleViewportSync(
      () => scrollRafId,
      (value) => {
        scrollRafId = value;
      },
      "scroll"
    );
  };

  const onResize = () => {
    scheduleViewportSync(
      () => resizeRafId,
      (value) => {
        resizeRafId = value;
      },
      "resize"
    );
  };

  const destroy = () => {
    if (scrollRafId) {
      cancelAnimationFrame(scrollRafId);
      scrollRafId = 0;
    }
    if (resizeRafId) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = 0;
    }
  };

  return {
    onDocumentSelectionChange,
    onScroll,
    onResize,
    destroy,
  };
};
