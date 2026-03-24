import { createEditorOps } from "../../../core";

export const createEditorOpsRuntime = ({
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
}: {
  getState: () => any;
  dispatchTransaction: (tr: any) => void;
  runCommand: any;
  basicCommands: any;
  setPendingPreferredUpdate: (value: any) => void;
  getCaretOffset: () => number;
  getText: () => string;
  getTextLength: () => number;
  setSelectionOffsets: any;
  docPosToTextOffset: any;
  textOffsetToDocPos: any;
  createSelectionStateAtOffset: any;
  logDelete: (...args: any[]) => void;
  isInSpecialStructureAtPos: (state: any, pos: number) => boolean;
  shouldAutoAdvanceAfterEnter: any;
}) =>
  createEditorOps({
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
