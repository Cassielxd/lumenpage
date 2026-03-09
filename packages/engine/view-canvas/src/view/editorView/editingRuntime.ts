import { createEditorOps } from "../../core";
import { createSelectionMovement } from "../selectionMovement";

// 编辑运行时：组装编辑操作与光标移动，保持原有依赖注入与执行顺序。
export const createEditingRuntime = ({
  getState,
  dispatchTransaction,
  runCommand,
  basicCommands,
  setPendingPreferredUpdate,
  getCaretOffset,
  getText,
  getTextLength,
  setSelectionOffsets,
  docPosToTextOffset,
  textOffsetToDocPos,
  createSelectionStateAtOffset,
  logDelete,
  isInSpecialStructureAtPos,
  shouldAutoAdvanceAfterEnter,
  getLayout,
  getLayoutIndex,
  getPreferredX,
  updateCaret,
  scrollArea,
  getSelectionAnchorOffset,
}) => {
  const { setCaretOffset, insertText, insertTextWithBreaks, deleteSelectionIfNeeded, deleteText } = createEditorOps({
    getEditorState: getState,
    dispatchTransaction,
    runCommand,
    basicCommands,
    pendingPreferredUpdateRef: {
      set: setPendingPreferredUpdate,
    },
    getCaretOffset,
    getText,
    getTextLength,
    setSelectionOffsets,
    docPosToTextOffset,
    textOffsetToDocPos,
    createSelectionStateAtOffset,
    logDelete,
    isInSpecialStructureAtPos,
    shouldAutoAdvanceAfterEnter:
      typeof shouldAutoAdvanceAfterEnter === "function" ? shouldAutoAdvanceAfterEnter : undefined,
  });

  const { computeLineEdgeOffset, computeVerticalOffset, moveHorizontal, moveLineEdge, moveVertical, extendSelection } =
    createSelectionMovement({
      getLayout,
      getLayoutIndex,
      getCaretOffset,
      setCaretOffset,
      getText: () => ({ length: getTextLength() }),
      getPreferredX,
      updateCaret,
      scrollArea,
      getSelectionAnchorOffset,
      setSelectionOffsets,
    });

  return {
    setCaretOffset,
    insertText,
    insertTextWithBreaks,
    deleteSelectionIfNeeded,
    deleteText,
    computeLineEdgeOffset,
    computeVerticalOffset,
    moveHorizontal,
    moveLineEdge,
    moveVertical,
    extendSelection,
  };
};
