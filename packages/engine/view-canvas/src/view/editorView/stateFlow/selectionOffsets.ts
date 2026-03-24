import { NodeSelection, Selection, TextSelection } from "lumenpage-state";

export const createSelectionOffsetUpdater = ({
  view,
  textOffsetToDocPos,
  setPendingPreferredUpdate,
  debugLog,
}: {
  view: any;
  textOffsetToDocPos: (doc: any, offset: number) => number;
  setPendingPreferredUpdate: (value: any) => void;
  debugLog: (...args: any[]) => void;
}) => {
  const setSelectionOffsets = (
    anchorOffset: any,
    headOffset: any,
    updatePreferred: any,
    forceText = false
  ) => {
    if (!Number.isFinite(anchorOffset) || !Number.isFinite(headOffset)) {
      return;
    }

    const currentSelection = view.state.selection;
    const anchorPos = textOffsetToDocPos(view.state.doc, anchorOffset);
    const headPos = textOffsetToDocPos(view.state.doc, headOffset);
    if (!Number.isFinite(anchorPos) || !Number.isFinite(headPos)) {
      return;
    }

    const selectionUnchanged =
      anchorPos === currentSelection.anchor && headPos === currentSelection.head;
    if (selectionUnchanged) {
      if (currentSelection instanceof TextSelection) {
        return;
      }
      if (!forceText && currentSelection instanceof NodeSelection) {
        return;
      }
    }

    setPendingPreferredUpdate(updatePreferred);

    let selection;
    try {
      selection = TextSelection.create(view.state.doc, anchorPos, headPos);
    } catch (error) {
      selection = Selection.near(view.state.doc.resolve(headPos), headPos < anchorPos ? -1 : 1);
    }
    const tr = view.state.tr.setSelection(selection);
    debugLog("setSelectionOffsets", {
      anchorOffset,
      headOffset,
      anchorPos,
      headPos,
    });
    view.dispatch(tr);
  };

  return {
    setSelectionOffsets,
  };
};
