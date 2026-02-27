import { TextSelection } from "lumenpage-state";

export const createEditorOps = ({
  getEditorState,
  dispatchTransaction,
  runCommand,
  basicCommands,
  pendingPreferredUpdateRef,
  getCaretOffset,
  getText,
  setSelectionOffsets,
  docPosToTextOffset,
  textOffsetToDocPos,
  createSelectionStateAtOffset,
  logDelete,
  isInSpecialStructureAtPos = (_state, _pos) => false,
  shouldAutoAdvanceAfterEnter = ({ prevState, nextState, prevHead }) => {
    const prevSelectionEmpty = prevState?.selection?.empty === true;
    const nextSelectionEmpty = nextState?.selection?.empty === true;
    // Auto-advance is only safe for caret-enter. When replacing a range with Enter,
    // forcing +1 may shift caret to an unexpected position.
    if (!prevSelectionEmpty || !nextSelectionEmpty) {
      return false;
    }
    const specialStructureChanged =
      isInSpecialStructureAtPos(prevState, prevHead) ||
      isInSpecialStructureAtPos(nextState, nextState.selection.head);
    return !specialStructureChanged && nextState.selection.head === prevHead;
  },
}) => {
  const setCaretOffset = (offset, updatePreferred) => {
    setSelectionOffsets(offset, offset, updatePreferred);
  };

  const insertText = (text) => {
    if (!text) {
      return;
    }

    if (text === "\n") {
      const prevState = getEditorState();
      const prevHead = prevState.selection.head;
      pendingPreferredUpdateRef.set(true);
      const enterCommand = basicCommands.enter || basicCommands.splitBlock;
      const handled = runCommand(enterCommand, getEditorState(), dispatchTransaction);
      if (!handled) {
        const state = getEditorState();
        const tr = state.tr.insertText("\n", state.selection.from, state.selection.to);
        dispatchTransaction(tr);
      }
      const nextState = getEditorState();
      const shouldAdvance =
        shouldAutoAdvanceAfterEnter({ prevState, nextState, prevHead }) === true;
      if (shouldAdvance && typeof docPosToTextOffset === "function") {
        const prevOffset = docPosToTextOffset(nextState.doc, prevHead);
        const nextOffset = Math.min(prevOffset + 1, getText().length);
        if (nextOffset !== prevOffset) {
          setSelectionOffsets(nextOffset, nextOffset, true);
        }
      }
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

  const findCutBefore = ($pos) => {
    if (!$pos?.parent || $pos.parent.type?.spec?.isolating) {
      return null;
    }
    for (let depth = $pos.depth - 1; depth >= 0; depth -= 1) {
      if ($pos.index(depth) > 0) {
        return $pos.doc.resolve($pos.before(depth + 1));
      }
      if ($pos.node(depth)?.type?.spec?.isolating) {
        break;
      }
    }
    return null;
  };

  const findCutAfter = ($pos) => {
    if (!$pos?.parent || $pos.parent.type?.spec?.isolating) {
      return null;
    }
    for (let depth = $pos.depth - 1; depth >= 0; depth -= 1) {
      const parent = $pos.node(depth);
      if ($pos.index(depth) + 1 < parent.childCount) {
        return $pos.doc.resolve($pos.after(depth + 1));
      }
      if (parent.type?.spec?.isolating) {
        break;
      }
    }
    return null;
  };

  const isSpecialNodeImmediatelyBefore = (selectionState) => {
    const $cursor = selectionState?.selection?.$cursor || selectionState?.selection?.$from;
    if (!$cursor || !$cursor.parent?.isTextblock || $cursor.parentOffset !== 0) {
      return false;
    }
    const $cut = findCutBefore($cursor);
    const nodeBefore = $cut?.nodeBefore;
    if (!$cut || !nodeBefore || !Number.isFinite(nodeBefore?.nodeSize) || nodeBefore.nodeSize <= 0) {
      return false;
    }
    const docSize = Number(selectionState?.doc?.content?.size ?? 0);
    const nodeStart = $cut.pos - nodeBefore.nodeSize;
    const probePos = Math.max(0, Math.min(docSize, nodeStart + 1));
    return isInSpecialStructureAtPos(selectionState, probePos);
  };

  const isSpecialNodeImmediatelyAfter = (selectionState) => {
    const $cursor = selectionState?.selection?.$cursor || selectionState?.selection?.$from;
    if (
      !$cursor ||
      !$cursor.parent?.isTextblock ||
      $cursor.parentOffset !== $cursor.parent.content.size
    ) {
      return false;
    }
    const $cut = findCutAfter($cursor);
    const nodeAfter = $cut?.nodeAfter;
    if (!$cut || !nodeAfter || !Number.isFinite(nodeAfter?.nodeSize) || nodeAfter.nodeSize <= 0) {
      return false;
    }
    const docSize = Number(selectionState?.doc?.content?.size ?? 0);
    const probePos = Math.max(0, Math.min(docSize, $cut.pos + 1));
    return isInSpecialStructureAtPos(selectionState, probePos);
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

    // Special-structure boundary guard: when caret is at textblock edge next to a structure
    // prefer PM-style node selection instead of character-level deletion by text offset.
    if (direction === "backward") {
      const stateAtDelete = getEditorState();
      if (isSpecialNodeImmediatelyBefore(stateAtDelete)) {
        const handled = runCommand(
          basicCommands.selectNodeBackward,
          stateAtDelete,
          dispatchTransaction
        );
        if (handled) {
          return;
        }
      }
    } else {
      const stateAtDelete = getEditorState();
      if (isSpecialNodeImmediatelyAfter(stateAtDelete)) {
        const handled = runCommand(
          basicCommands.selectNodeForward,
          stateAtDelete,
          dispatchTransaction
        );
        if (handled) {
          return;
        }
      }
    }

    if (direction === "backward") {
      if (caretOffset === 0) {
        return;
      }
      if (textValue[caretOffset - 1] === "\n") {
        const doc = getEditorState().doc;
        const fromPos = textOffsetToDocPos(doc, caretOffset - 1);
        const toPos = textOffsetToDocPos(doc, caretOffset);
        const $from = doc.resolve(fromPos);
        const $to = doc.resolve(toPos);
        if ($from.parent === $to.parent && $from.parent.isTextblock) {
          let tr = getEditorState().tr.setSelection(
            TextSelection.create(getEditorState().doc, toPos)
          );
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
        pendingPreferredUpdateRef.set(true);
        const selectionState = createSelectionStateAtOffset(
          getEditorState(),
          textOffsetToDocPos,
          caretOffset
        );
        let handled = false;
        if (isSpecialNodeImmediatelyBefore(selectionState)) {
          handled = runCommand(
            basicCommands.selectNodeBackward,
            selectionState,
            dispatchTransaction
          );
        }
        logDelete("joinBackward", {
          caretOffset,
          from: getEditorState().selection.from,
          to: getEditorState().selection.to,
        });
        if (!handled) {
          handled = runCommand(basicCommands.joinBackward, selectionState, dispatchTransaction);
        }
        if (!handled) {
          runCommand(basicCommands.selectNodeBackward, selectionState, dispatchTransaction);
        }
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
      const doc = getEditorState().doc;
      const fromPos = textOffsetToDocPos(doc, caretOffset);
      const toPos = textOffsetToDocPos(doc, caretOffset + 1);
      const $from = doc.resolve(fromPos);
      const $to = doc.resolve(toPos);
      if ($from.parent === $to.parent && $from.parent.isTextblock) {
        let tr = getEditorState().tr.setSelection(
          TextSelection.create(getEditorState().doc, fromPos)
        );
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
      pendingPreferredUpdateRef.set(true);
      const selectionState = createSelectionStateAtOffset(
        getEditorState(),
        textOffsetToDocPos,
        caretOffset
      );
      let handled = false;
      if (isSpecialNodeImmediatelyAfter(selectionState)) {
        handled = runCommand(basicCommands.selectNodeForward, selectionState, dispatchTransaction);
      }
      if (!handled) {
        handled = runCommand(basicCommands.joinForward, selectionState, dispatchTransaction);
      }
      if (!handled) {
        runCommand(basicCommands.selectNodeForward, selectionState, dispatchTransaction);
      }
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
