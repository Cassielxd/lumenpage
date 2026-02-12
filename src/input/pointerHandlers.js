export const createPointerHandlers = ({
  getLayout,
  scrollArea,
  inputEl,
  getText,
  posAtCoords,
  setSelectionOffsets,
  getSelectionAnchorOffset,
  setPreferredX,
}) => {
  let isPointerSelecting = false;
  let pointerAnchorOffset = 0;
  let pointerId = null;

  const handlePointerDown = (event) => {
    if (event.button !== 0) {
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
    const hitOffset = posAtCoords(
      layout,
      x,
      y,
      scrollArea.scrollTop,
      scrollArea.clientWidth,
      getText().length
    );

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
