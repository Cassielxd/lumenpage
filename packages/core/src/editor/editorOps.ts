import { TextSelection } from "prosemirror-state";

export const createEditorOps = ({
  getEditorState,
  dispatchTransaction,
  runCommand,
  basicCommands,
  pendingPreferredUpdateRef,
  getCaretOffset,
  getText,
  setSelectionOffsets,
  textOffsetToDocPos,
  createSelectionStateAtOffset,
  logDelete,
}) => {
  const setCaretOffset = (offset, updatePreferred) => {
    setSelectionOffsets(offset, offset, updatePreferred);
  };

  const insertText = (text) => {
    if (!text) {
      return;
    }

    if (text === "\n") {
      pendingPreferredUpdateRef.set(true);
      runCommand(basicCommands.splitBlock, getEditorState(), dispatchTransaction);
      return;
    }

    const { from, to } = getEditorState().selection;
    const tr = getEditorState().tr.insertText(text, from, to);
    pendingPreferredUpdateRef.set(true);
    dispatchTransaction(tr);
    logDelete("after", {
      caretOffset: getCaretOffset(),
      textLength: getText().length,
      lastChar: getText().slice(-1) || null,
    });
  };

  const insertTextWithBreaks = (text) => {
    if (!text) {
      return;
    }
    const segments = text.split("\n");
    segments.forEach((segment, index) => {
      if (segment.length > 0) {
        insertText(segment);
      }
      if (index < segments.length - 1) {
        insertText("\n");
      }
    });
  };

  const deleteSelectionIfNeeded = () => {
    const editorState = getEditorState();
    if (!editorState.selection.empty) {
      runCommand(basicCommands.deleteSelection, editorState, dispatchTransaction);
      return true;
    }
    return false;
  };

  const deleteText = (direction) => {
    const textValue = getText();
    const caretOffset = getCaretOffset();
    logDelete("before", {
      direction,
      caretOffset,
      textLength: textValue.length,
      prevChar: caretOffset > 0 ? textValue[caretOffset - 1] : null,
      nextChar: caretOffset < textValue.length ? textValue[caretOffset] : null,
    });

    if (deleteSelectionIfNeeded()) {
      logDelete("selection", {
        from: getEditorState().selection.from,
        to: getEditorState().selection.to,
      });
      return;
    }

    if (direction === "backward") {
      if (caretOffset === 0) {
        return;
      }
      if (textValue[caretOffset - 1] === "\n") {
        pendingPreferredUpdateRef.set(true);
        const selectionState = createSelectionStateAtOffset(
          getEditorState(),
          textOffsetToDocPos,
          caretOffset
        );
        logDelete("joinBackward", {
          caretOffset,
          from: getEditorState().selection.from,
          to: getEditorState().selection.to,
        });
        runCommand(basicCommands.joinBackward, selectionState, dispatchTransaction);
        return;
      }
      const fromPos = textOffsetToDocPos(getEditorState().doc, caretOffset - 1);
      const toPos = textOffsetToDocPos(getEditorState().doc, caretOffset);
      const rangeText = getEditorState().doc.textBetween(fromPos, toPos, "\n");
      logDelete("deleteRange", {
        fromOffset: caretOffset - 1,
        toOffset: caretOffset,
        fromPos,
        toPos,
        rangeText,
      });
      let tr = getEditorState().tr.setSelection(TextSelection.create(getEditorState().doc, toPos));
      tr = tr.delete(fromPos, toPos);
      pendingPreferredUpdateRef.set(true);
      dispatchTransaction(tr);
      logDelete("after", {
        caretOffset: getCaretOffset(),
        textLength: getText().length,
        lastChar: getText().slice(-1) || null,
      });
      return;
    }

    if (caretOffset >= textValue.length) {
      return;
    }
    if (textValue[caretOffset] === "\n") {
      pendingPreferredUpdateRef.set(true);
      const selectionState = createSelectionStateAtOffset(
        getEditorState(),
        textOffsetToDocPos,
        caretOffset
      );
      runCommand(basicCommands.joinForward, selectionState, dispatchTransaction);
      return;
    }
    const fromPos = textOffsetToDocPos(getEditorState().doc, caretOffset);
    const toPos = textOffsetToDocPos(getEditorState().doc, caretOffset + 1);
    let tr = getEditorState().tr.setSelection(TextSelection.create(getEditorState().doc, fromPos));
    tr = tr.delete(fromPos, toPos);
    pendingPreferredUpdateRef.set(true);
    dispatchTransaction(tr);
    logDelete("after", {
      caretOffset: getCaretOffset(),
      textLength: getText().length,
      lastChar: getText().slice(-1) || null,
    });
  };

  return {
    setCaretOffset,
    insertText,
    insertTextWithBreaks,
    deleteSelectionIfNeeded,
    deleteText,
  };
};
