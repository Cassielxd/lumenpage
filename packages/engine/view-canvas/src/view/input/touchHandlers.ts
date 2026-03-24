type TouchHandlersOptions = {
  getLayout: () => any;
  scrollArea: HTMLElement;
  getText: () => string;
  getTextLength: () => number;
  posAtCoords: (
    layout: any,
    x: number,
    y: number,
    scrollTop: number,
    clientWidth: number,
    textLength: number
  ) => number | null;
  setSelectionOffsets: (anchor: number, head: number, shouldFocus: boolean) => void;
  getSelectionAnchorOffset: () => number | null;
  setPreferredX: (value: number | null) => void;
  dispatchEditorProp?: (name: string, event: Event) => boolean;
  inputEl?: HTMLElement | null;
  longPressDelay?: number;
  tapMoveThreshold?: number;
};

export const createTouchHandlers = ({
  getLayout,
  scrollArea,
  getText,
  getTextLength,
  posAtCoords,
  setSelectionOffsets,
  getSelectionAnchorOffset,
  setPreferredX,
  dispatchEditorProp,
  inputEl,
  longPressDelay = 450,
  tapMoveThreshold = 12,
}: TouchHandlersOptions) => {
  let activeTouchId = null;
  let isSelecting = false;
  let hasMoved = false;
  let startOffset = null;
  let startX = 0;
  let startY = 0;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  const clearLongPress = () => {
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const resolveOffset = (touch) => {
    const layout = getLayout();
    if (!layout) {
      return null;
    }
    const rect = scrollArea.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    return posAtCoords(
      layout,
      x,
      y,
      scrollArea.scrollTop,
      scrollArea.clientWidth,
      getTextLength()
    );
  };

  const focusInput = () => {
    if (inputEl && typeof inputEl.focus === "function") {
      inputEl.focus();
    }
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    if (dispatchEditorProp?.("handleTouchStart", event)) {
      event.preventDefault();
      return;
    }
    if (event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    activeTouchId = touch.identifier;
    startX = touch.clientX;
    startY = touch.clientY;
    hasMoved = false;
    isSelecting = false;
    const offset = resolveOffset(touch);
    if (offset == null) {
      return;
    }
    startOffset = offset;
    setPreferredX(null);
    clearLongPress();
    longPressTimer = setTimeout(() => {
      isSelecting = true;
      if (startOffset != null) {
        setSelectionOffsets(startOffset, startOffset, true);
        focusInput();
      }
    }, longPressDelay);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    if (dispatchEditorProp?.("handleTouchMove", event)) {
      event.preventDefault();
      return;
    }
    if (activeTouchId == null) {
      return;
    }
    const touch = Array.from(event.touches).find((item) => item.identifier === activeTouchId);
    if (!touch) {
      return;
    }
    const deltaX = Math.abs(touch.clientX - startX);
    const deltaY = Math.abs(touch.clientY - startY);
    if (!isSelecting && (deltaX > tapMoveThreshold || deltaY > tapMoveThreshold)) {
      hasMoved = true;
      clearLongPress();
      return;
    }
    if (!isSelecting) {
      return;
    }
    const offset = resolveOffset(touch);
    if (offset == null) {
      return;
    }
    event.preventDefault();
    const anchor = startOffset ?? getSelectionAnchorOffset();
    setSelectionOffsets(anchor, offset, false);
  };

  const finishTouch = (event: TouchEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    if (dispatchEditorProp?.("handleTouchEnd", event)) {
      event.preventDefault();
      return;
    }
    if (!hasMoved && !isSelecting && startOffset != null) {
      setSelectionOffsets(startOffset, startOffset, true);
      focusInput();
    }
    clearLongPress();
    activeTouchId = null;
    isSelecting = false;
    hasMoved = false;
    startOffset = null;
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd: finishTouch,
    handleTouchCancel: finishTouch,
  };
};
