
export const createPointerHandlers = ({
  getLayout,
  scrollArea,
  inputEl,
  getText,
  posAtCoords,
  getHitAtCoords,
  setSelectionOffsets,
  setSelectionFromHit,
  setNodeSelectionAtPos,
  getSelectionAnchorOffset,
  getSelectionRangeOffsets,
  isNodeSelectionActive,
  setSkipNextClickSelection,
  resolveDragNodePos,
  startInternalDragFromSelection,
  startInternalDragFromNodePos,
  canStartSelectionDrag,
  updateInternalDrag,
  finishInternalDrag,
  setPreferredX,
}) => {
  const INTERNAL_DRAG_START_DISTANCE = 8;
  let isPointerSelecting = false;
  let pointerAnchorOffset = 0;
  let pointerId = null;
  let pendingInternalDrag = null;
  let pointerAreaRect: DOMRect | null = null;

  const focusInputNoScroll = () => {
    try {
      inputEl?.focus?.({ preventScroll: true });
    } catch (_error) {
      inputEl?.focus?.();
    }
  };

  const getPointerAreaRect = () => {
    if (pointerAreaRect) {
      return pointerAreaRect;
    }
    pointerAreaRect = scrollArea.getBoundingClientRect();
    return pointerAreaRect;
  };

  const resetPointerState = () => {
    pendingInternalDrag = null;
    pointerAreaRect = null;
    if (isPointerSelecting && pointerId != null) {
      try {
        scrollArea.releasePointerCapture(pointerId);
      } catch (_error) {
        // ignore
      }
    }
    isPointerSelecting = false;
    pointerId = null;
  };

  const handlePointerDown = (event) => {
    try {
      if (event.button !== 0) {
        return;
      }
      pendingInternalDrag = null;
      const isHandleTarget = !!event?.target?.closest?.(".lumenpage-block-drag-handle");

      const fromResolver = resolveDragNodePos?.(event);
      const dragNodePos = Number.isFinite(fromResolver) ? fromResolver : null;
      if (Number.isFinite(dragNodePos)) {
        const ownerDocument = inputEl?.ownerDocument || (typeof document !== "undefined" ? document : null);
        const isInputFocused = !!ownerDocument && ownerDocument.activeElement === inputEl;
        // Cold-start guard: on first interaction, force focus first.
        // This avoids unstable handle-first path before input/selection bridge is active.
        if (!isInputFocused) {
          // First handle click may retarget the subsequent `click` to canvas after pointerup.
          // Mark skip to avoid accidental click-chain selection/open logic on this warmup path.
          setSkipNextClickSelection?.(true);
          focusInputNoScroll();
          return;
        }
        const rect = getPointerAreaRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        pendingInternalDrag = {
          pointerId: event.pointerId,
          startX: x,
          startY: y,
          nodePos: dragNodePos,
          active: false,
        };
        setSkipNextClickSelection?.(true);
        focusInputNoScroll();
        return;
      }
      // If the event comes from drag handle but cannot resolve node pos yet,
      // never fall through to generic canvas hit-testing on the first click.
      if (isHandleTarget) {
        setSkipNextClickSelection?.(true);
        focusInputNoScroll();
        return;
      }

      const layout = getLayout();
      if (!layout) {
        focusInputNoScroll();
        return;
      }

      const rect = getPointerAreaRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = typeof getHitAtCoords === "function" ? getHitAtCoords(x, y) : null;

      const hitOffset = posAtCoords(
        layout,
        x,
        y,
        scrollArea.scrollTop,
        scrollArea.clientWidth,
        getText().length
      );

      const currentRange =
        typeof getSelectionRangeOffsets === "function" ? getSelectionRangeOffsets() : null;
      if (
        !event.shiftKey &&
        hitOffset !== null &&
        currentRange &&
        Number.isFinite(currentRange.from) &&
        Number.isFinite(currentRange.to) &&
        currentRange.from !== currentRange.to
      ) {
        const min = Math.min(currentRange.from, currentRange.to);
        const max = Math.max(currentRange.from, currentRange.to);
        const keepOnBoundary =
          typeof isNodeSelectionActive === "function" ? !isNodeSelectionActive() : true;
        const shouldKeepSelection = keepOnBoundary
          ? hitOffset >= min && hitOffset <= max
          : hitOffset > min && hitOffset < max;
        if (shouldKeepSelection) {
          pendingInternalDrag = {
            pointerId: event.pointerId,
            startX: x,
            startY: y,
            hitOffset,
            active: false,
          };
          focusInputNoScroll();
          return;
        }
      }

      if (hit && typeof setSelectionFromHit === "function") {
        const handled = setSelectionFromHit(hit, event);
        if (handled) {
          focusInputNoScroll();
          return;
        }
      }

      if (hitOffset !== null) {
        setPreferredX(null);
        pointerAnchorOffset = event.shiftKey ? getSelectionAnchorOffset() : hitOffset;
        pointerId = event.pointerId;
        isPointerSelecting = true;
        scrollArea.setPointerCapture(pointerId);
        setSelectionOffsets(pointerAnchorOffset, hitOffset, true);
      }

      focusInputNoScroll();
    } catch (error) {
      console.error("[pointer] handlePointerDown fatal", error);
      resetPointerState();
      focusInputNoScroll();
    }
  };

  const handlePointerMove = (event) => {
    try {
      if (pendingInternalDrag && event.pointerId === pendingInternalDrag.pointerId) {
        if ((event.buttons & 1) !== 1) {
          return;
        }
        const rect = getPointerAreaRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const dx = x - pendingInternalDrag.startX;
        const dy = y - pendingInternalDrag.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!pendingInternalDrag.active && distance >= INTERNAL_DRAG_START_DISTANCE) {
          let started = false;
          try {
            started = Number.isFinite(pendingInternalDrag.nodePos)
              ? startInternalDragFromNodePos?.(pendingInternalDrag.nodePos, event)
              : canStartSelectionDrag?.(event) === false
                ? false
                : startInternalDragFromSelection?.(event);
          } catch (error) {
            console.error("[pointer] startInternalDrag error", error);
            started = false;
          }
          if (started) {
            pendingInternalDrag.active = true;
            setSkipNextClickSelection?.(true);
            scrollArea.setPointerCapture(event.pointerId);
          }
        }

        if (pendingInternalDrag.active) {
          try {
            updateInternalDrag?.(event, { x, y });
          } catch (error) {
            console.error("[pointer] updateInternalDrag error", error);
            pendingInternalDrag.active = false;
          }
          return;
        }
      }

      if (!isPointerSelecting || event.pointerId !== pointerId) {
        return;
      }

      const layout = getLayout();
      if (!layout) {
        return;
      }

      const rect = getPointerAreaRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hitOffset = posAtCoords(
        layout,
        x,
        y,
        scrollArea.scrollTop,
        scrollArea.clientWidth,
        getText().length
      );

      if (hitOffset !== null) {
        setSelectionOffsets(pointerAnchorOffset, hitOffset, false);
      }
    } catch (error) {
      console.error("[pointer] handlePointerMove fatal", error);
      resetPointerState();
    }
  };

  const handlePointerUp = (event) => {
    try {
      if (pendingInternalDrag && event.pointerId === pendingInternalDrag.pointerId) {
        if (pendingInternalDrag.active) {
          const rect = getPointerAreaRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          try {
            finishInternalDrag?.(event, { x, y });
          } catch (error) {
            console.error("[pointer] finishInternalDrag error", error);
          }
          try {
            scrollArea.releasePointerCapture(event.pointerId);
          } catch (_error) {
            // ignore
          }
        } else if (Number.isFinite(pendingInternalDrag.hitOffset)) {
          setPreferredX(null);
          setSelectionOffsets(pendingInternalDrag.hitOffset, pendingInternalDrag.hitOffset, true);
        }
        pendingInternalDrag = null;
        pointerAreaRect = null;
        return;
      }

      if (event.pointerId !== pointerId) {
        return;
      }

      if (isPointerSelecting && pointerId != null) {
        try {
          scrollArea.releasePointerCapture(pointerId);
        } catch (_error) {
          // ignore
        }
      }
      isPointerSelecting = false;
      pointerId = null;
      pointerAreaRect = null;
    } catch (error) {
      console.error("[pointer] handlePointerUp fatal", error);
      resetPointerState();
    }
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
};

