import { Selection, TextSelection } from "lumenpage-state";

export const createSelectionStateAtOffset = (editorState, textOffsetToDocPos, offset) => {
  const pos = textOffsetToDocPos(editorState.doc, offset);
  let selection;
  try {
    selection = TextSelection.create(editorState.doc, pos);
  } catch (error) {
    selection = Selection.near(editorState.doc.resolve(pos));
  }
  return editorState.apply(editorState.tr.setSelection(selection));
};

export const getSelectionOffsets = (editorState, docPosToTextOffset, clampOffset) => {
  const selection = editorState?.selection;
  if (!selection) {
    return { from: 0, to: 0 };
  }

  if (selection.empty === true) {
    const collapsed = clampOffset(docPosToTextOffset(editorState.doc, selection.head));
    return {
      from: collapsed,
      to: collapsed,
    };
  }

  const { from, to } = selection;
  return {
    from: clampOffset(docPosToTextOffset(editorState.doc, from)),
    to: clampOffset(docPosToTextOffset(editorState.doc, to)),
  };
};

export const getSelectionAnchorOffset = (editorState, docPosToTextOffset, clampOffset) =>
  clampOffset(docPosToTextOffset(editorState.doc, editorState.selection.anchor));

export const createSelectionLogger = ({ getText, docPosToTextOffset, clampOffset }) => {
  let lastSelectionSignature = "";
  return (editorState) => {
    const { anchor, head } = editorState.selection;
    const offsets = getSelectionOffsets(editorState, docPosToTextOffset, clampOffset);
    const anchorOffset = clampOffset(docPosToTextOffset(editorState.doc, anchor));
    const headOffset = clampOffset(docPosToTextOffset(editorState.doc, head));
    const signature = `${offsets.from}-${offsets.to}-${anchorOffset}-${headOffset}`;
    if (signature === lastSelectionSignature) {
      return;
    }
    lastSelectionSignature = signature;
  };
};


