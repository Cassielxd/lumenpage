import { createEditorOps } from "../../core";

export const createTextOpsRuntime = ({
  getState,
  dispatchTransaction,
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
  setPendingPreferredUpdate: (value: any) => void;
  getCaretOffset?: () => number;
  getText: () => string;
  getTextLength: () => number;
  setSelectionOffsets: any;
  docPosToTextOffset?: any;
  textOffsetToDocPos?: any;
  createSelectionStateAtOffset?: any;
  logDelete?: (...args: any[]) => void;
  isInSpecialStructureAtPos?: (state: any, pos: number) => boolean;
  shouldAutoAdvanceAfterEnter?: any;
}) =>
  createEditorOps({
    getEditorState: getState,
    dispatchTransaction,
    runCommand: (command: any, state: any, dispatch: any) =>
      typeof command === "function" ? command(state, dispatch) : false,
    basicCommands: {},
    pendingPreferredUpdateRef: {
      set: setPendingPreferredUpdate,
    },
    getCaretOffset: getCaretOffset ?? (() => 0),
    getText,
    getTextLength,
    setSelectionOffsets,
    docPosToTextOffset,
    textOffsetToDocPos,
    createSelectionStateAtOffset,
    logDelete,
    isInSpecialStructureAtPos,
    shouldAutoAdvanceAfterEnter,
  });
