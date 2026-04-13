import { createSelectionMovement } from "../../selectionMovement.js";

export const createSelectionMovementRuntime = ({
  getLayout,
  getLayoutIndex,
  getCaretOffset,
  setCaretOffset,
  getTextLength,
  getPreferredX,
  updateCaret,
  scrollArea,
  getSelectionAnchorOffset,
  setSelectionOffsets,
}: {
  getLayout: () => any;
  getLayoutIndex: () => any;
  getCaretOffset: () => number;
  setCaretOffset: (...args: any[]) => void;
  getTextLength: () => number;
  getPreferredX: () => any;
  updateCaret: (updatePreferred: boolean) => void;
  scrollArea: any;
  getSelectionAnchorOffset: () => any;
  setSelectionOffsets: any;
}) =>
  createSelectionMovement({
    getLayout,
    getLayoutIndex,
    getCaretOffset,
    setCaretOffset,
    getText: () => ({ length: getTextLength() }),
    getTextLength,
    getPreferredX,
    updateCaret,
    scrollArea,
    getSelectionAnchorOffset,
    setSelectionOffsets,
  });
