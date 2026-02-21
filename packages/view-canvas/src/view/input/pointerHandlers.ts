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
  setGapCursorAtCoords,
  shouldDeferSelection,
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
  let isPointerSelecting = false;
  let pointerAnchorOffset = 0;
  let pointerId = null;
  let pendingInternalDrag = null;

  const handlePointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }
    pendingInternalDrag = null;

    const fromResolver = resolveDragNodePos?.(event);
    const fallbackTarget = event?.target?.closest?.("[data-lumen-drag-pos]");
    const fallbackAttr = fallbackTarget?.getAttribute?.("data-lumen-drag-pos");
    const dragNodePos = Number.isFinite(fromResolver)
      ? fromResolver
      : Number(fallbackAttr);
    if (Number.isFinite(dragNodePos)) {
      const rect = scrollArea.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setNodeSelectionAtPos?.(dragNodePos, event);
      pendingInternalDrag = {
        pointerId: event.pointerId,
        startX: x,
        startY: y,
        nodePos: dragNodePos,
        active: false,
      };
      setSkipNextClickSelection?.(true);
      inputEl.focus();
      return;
    }

    const layout = getLayout();
    if (!layout) {
      inputEl.focus();
      return;
    }

    const rect = scrollArea.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = typeof getHitAtCoords === "function"
      ? getHitAtCoords(x, y)
      : null;
    if (typeof setGapCursorAtCoords === "function") {
      const handled = setGapCursorAtCoords(x, y, hit, event);
      if (handled) {
        inputEl.focus();
        return;
      }
    }
    const hitOffset = posAtCoords(
      layout,
      x,
      y,
      scrollArea.scrollTop,
      scrollArea.clientWidth,
      getText().length
    );

    // 当按下位置在现有选区内部时，优先保留选区，允许触发原生 dragstart。
    // 否则会因为提前折叠选区导致拖拽总是被取消。
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
      const keepOnBoundary = typeof isNodeSelectionActive === "function"
        ? !isNodeSelectionActive()
        : true;
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
        inputEl.focus();
        return;
      }
    }

    if (typeof shouldDeferSelection === "function" && shouldDeferSelection(hit, hitOffset, event)) {
      inputEl.focus();
      return;
    }

    if (hit && typeof setSelectionFromHit === "function") {
      const handled = setSelectionFromHit(hit, event);
      if (handled) {
        inputEl.focus();
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

    inputEl.focus();
  };

  const handlePointerMove = (event) => {
    if (pendingInternalDrag && event.pointerId === pendingInternalDrag.pointerId) {
      const rect = scrollArea.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dx = x - pendingInternalDrag.startX;
      const dy = y - pendingInternalDrag.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (!pendingInternalDrag.active && distance >= 4) {
        const started = Number.isFinite(pendingInternalDrag.nodePos)
          ? startInternalDragFromNodePos?.(pendingInternalDrag.nodePos, event)
          : canStartSelectionDrag?.(event) === false
            ? false
            : startInternalDragFromSelection?.(event);
        if (started) {
          pendingInternalDrag.active = true;
          // 仅在真正进入拖拽后跳过后续 click 选区，避免单击被误吞。
          setSkipNextClickSelection?.(true);
          scrollArea.setPointerCapture(event.pointerId);
        }
      }
      if (pendingInternalDrag.active) {
        updateInternalDrag?.(event, { x, y });
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

    const rect = scrollArea.getBoundingClientRect();
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
  };

  const finishPointerSelection = () => {
    if (isPointerSelecting && pointerId !== null) {
      scrollArea.releasePointerCapture(pointerId);
    }
    isPointerSelecting = false;
    pointerId = null;
  };

  const handlePointerUp = (event) => {
    if (pendingInternalDrag && event.pointerId === pendingInternalDrag.pointerId) {
      if (pendingInternalDrag.active) {
        const rect = scrollArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        finishInternalDrag?.(event, { x, y });
        try {
          scrollArea.releasePointerCapture(event.pointerId);
        } catch (_error) {
          // ignore
        }
      } else if (Number.isFinite(pendingInternalDrag.hitOffset)) {
        // 未达到拖拽阈值时，回落为普通单击：将光标放回点击位置。
        setPreferredX(null);
        setSelectionOffsets(pendingInternalDrag.hitOffset, pendingInternalDrag.hitOffset, true);
      }
      pendingInternalDrag = null;
      return;
    }

    if (event.pointerId !== pointerId) {
      return;
    }
    finishPointerSelection();
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
};
