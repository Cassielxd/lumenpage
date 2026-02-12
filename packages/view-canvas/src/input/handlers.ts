export const createInputHandlers = ({
  getEditorState,
  dispatchTransaction,
  runCommand,
  basicCommands,
  setBlockAlign,
  insertText,
  insertTextWithBreaks,
  deleteText,
  computeLineEdgeOffset,
  computeVerticalOffset,
  moveHorizontal,
  moveVertical,
  moveLineEdge,
  extendSelection,
  clampOffset,
  getCaretOffset,
  supportsBeforeInput,
  getIsComposing,
  setIsComposing,
  inputEl,
  parseHtmlToSlice,
  setPendingPreferredUpdate,
}) => {
  const runUndo = () => {
    runCommand(basicCommands.undo, getEditorState(), dispatchTransaction);
  };

  const runRedo = () => {
    runCommand(basicCommands.redo, getEditorState(), dispatchTransaction);
  };

  const handleBeforeInput = (event) => {
    if (event.inputType == "insertCompositionText") {
      return;
    }

    if (getIsComposing() || event.isComposing) {
      return;
    }

    switch (event.inputType) {
      case "insertText":
      case "insertReplacementText":
        event.preventDefault();
        insertTextWithBreaks(event.data || "");
        break;
      case "insertLineBreak":
      case "insertParagraph":
        event.preventDefault();
        insertText("\n");
        break;
      case "insertFromPaste":
        event.preventDefault();
        break;
      case "historyUndo":
        event.preventDefault();
        runUndo();
        break;
      case "historyRedo":
        event.preventDefault();
        runRedo();
        break;
      default:
        if (event.inputType && event.inputType.startsWith("delete")) {
          event.preventDefault();
          deleteText(
            event.inputType === "deleteContentForward" ? "forward" : "backward"
          );
        }
        break;
    }
  };

  const handleKeyDown = (event) => {
    if (event.isComposing) {
      return;
    }

    const metaKey = event.ctrlKey || event.metaKey;

    if (metaKey && event.shiftKey) {
      if (event.key === "L") {
        event.preventDefault();
        runCommand(setBlockAlign("left"), getEditorState(), dispatchTransaction);
        return;
      }

      if (event.key === "C" || event.key === "E") {
        event.preventDefault();
        runCommand(setBlockAlign("center"), getEditorState(), dispatchTransaction);
        return;
      }

      if (event.key === "R") {
        event.preventDefault();
        runCommand(setBlockAlign("right"), getEditorState(), dispatchTransaction);
        return;
      }
    }

    if (metaKey) {
      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        if (event.shiftKey) {
          runRedo();
        } else {
          runUndo();
        }
        return;
      }

      if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        runRedo();
        return;
      }
    }

    switch (event.key) {
      case "ArrowLeft": {
        event.preventDefault();
        const nextOffset = getCaretOffset() - 1;
        if (event.shiftKey) {
          extendSelection(clampOffset(nextOffset), true);
        } else {
          moveHorizontal(-1);
        }
        break;
      }
      case "ArrowRight": {
        event.preventDefault();
        const nextOffset = getCaretOffset() + 1;
        if (event.shiftKey) {
          extendSelection(clampOffset(nextOffset), true);
        } else {
          moveHorizontal(1);
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const nextOffset = computeVerticalOffset("up");
        if (event.shiftKey) {
          extendSelection(nextOffset, false);
        } else {
          moveVertical("up");
        }
        break;
      }
      case "ArrowDown": {
        event.preventDefault();
        const nextOffset = computeVerticalOffset("down");
        if (event.shiftKey) {
          extendSelection(nextOffset, false);
        } else {
          moveVertical("down");
        }
        break;
      }
      case "Home": {
        event.preventDefault();
        const nextOffset = computeLineEdgeOffset("start");
        if (event.shiftKey) {
          extendSelection(nextOffset, true);
        } else {
          moveLineEdge("start");
        }
        break;
      }
      case "End": {
        event.preventDefault();
        const nextOffset = computeLineEdgeOffset("end");
        if (event.shiftKey) {
          extendSelection(nextOffset, true);
        } else {
          moveLineEdge("end");
        }
        break;
      }
      case "Tab":
        event.preventDefault();
        insertText("  ");
        break;
      default:
        break;
    }

    if (!supportsBeforeInput && !metaKey && !event.altKey) {
      if (event.key === "Enter") {
        event.preventDefault();
        insertText("\n");
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        deleteText("backward");
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        deleteText("forward");
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        insertText(event.key);
      }
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionUpdate = () => {};

  const handleCompositionEnd = (event) => {
    setIsComposing(false);
    const text = event.data || inputEl.value;
    if (text) {
      insertTextWithBreaks(text);
    }
    inputEl.value = "";
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const html = event.clipboardData?.getData("text/html") || "";
    if (html) {
      try {
        const slice = parseHtmlToSlice(html);
        const editorState = getEditorState();
        const tr = editorState.tr.replaceSelection(slice);
        setPendingPreferredUpdate(true);
        dispatchTransaction(tr);
        inputEl.value = "";
        return;
      } catch (error) {
        console.warn("Failed to parse HTML paste", error);
      }
    }

    const text = event.clipboardData?.getData("text/plain") || "";
    insertTextWithBreaks(text);
    inputEl.value = "";
  };

  const handleInput = () => {
    if (getIsComposing()) {
      return;
    }
    inputEl.value = "";
  };

  return {
    handleBeforeInput,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    handlePaste,
    handleInput,
  };
};
