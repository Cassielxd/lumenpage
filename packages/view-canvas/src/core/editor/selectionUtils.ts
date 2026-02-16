import { TextSelection } from "lumenpage-state";

export const createSelectionStateAtOffset = (editorState, textOffsetToDocPos, offset) => {
  const pos = textOffsetToDocPos(editorState.doc, offset);
  const selection = TextSelection.create(editorState.doc, pos);
  return editorState.apply(editorState.tr.setSelection(selection));
};

export const getSelectionOffsets = (editorState, docPosToTextOffset, clampOffset) => {
  const { from, to } = editorState.selection;
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
    const selectionText = getText().slice(offsets.from, offsets.to);
    const preview = selectionText.length > 80 ? `${selectionText.slice(0, 80)}...` : selectionText;
    console.log("[selection]", {
      from: offsets.from,
      to: offsets.to,
      anchor: anchorOffset,
      head: headOffset,
      length: selectionText.length,
      text: preview,
    });
  };
};
