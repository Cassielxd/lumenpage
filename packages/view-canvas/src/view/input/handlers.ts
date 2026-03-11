export const createInputHandlers = ({
  getEditorState,
  dispatchTransaction,
  runCommand,
  basicCommands,
  runKeymap,
  enableBuiltInKeyFallback = true,
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
  transformPasted,
  transformPastedText,
  transformPastedHTML,
  clipboardTextParser,
  setPendingPreferredUpdate,
  editorHandlers,
}) => {
  const isReadOnly = () => inputEl?.readOnly === true;
  let lastCompositionCommitText = "";
  let lastCompositionCommitAt = 0;
  let lastEnterHandledAt = 0;
  const markCompositionCommit = (text) => {
    if (!text) {
      return;
    }
    lastCompositionCommitText = text;
    lastCompositionCommitAt = Date.now();
  };
  const wasRecentCompositionCommit = (text) => {
    if (!text || !lastCompositionCommitText) {
      return false;
    }
    if (text !== lastCompositionCommitText) {
      return false;
    }
    return Date.now() - lastCompositionCommitAt <= 120;
  };

  const runTextInputHandler = (from, to, text, deflt) =>
    !!editorHandlers?.handleTextInput?.(from, to, text, deflt);
  const runUndo = () => {
    runCommand(basicCommands.undo, getEditorState(), dispatchTransaction);
  };

  const runRedo = () => {
    runCommand(basicCommands.redo, getEditorState(), dispatchTransaction);
  };
  const markEnterHandled = (source) => {
    void source;
    lastEnterHandledAt = Date.now();
  };
  const wasEnterHandledRecently = () => Date.now() - lastEnterHandledAt <= 120;
  const runEnterCommand = (state) => runCommand(basicCommands.enter, state, dispatchTransaction);

  const handleBeforeInput = (event) => {
    if (isReadOnly()) {
      event?.preventDefault?.();
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleBeforeInput?.(event)) {
      event.preventDefault();
      return;
    }
    if (event.inputType == "insertCompositionText") {
      if (!getIsComposing()) {
        setIsComposing(true);
      }
      return;
    }

    if (getIsComposing() || event.isComposing) {
      return;
    }

    switch (event.inputType) {
      case "insertText":
      case "insertReplacementText":
        {
          const state = getEditorState();
          const text = event.data || "";
          if (wasRecentCompositionCommit(text)) {
            event.preventDefault();
            return;
          }
          let appliedDefault = false;
          const deflt = () => {
            if (appliedDefault) {
              return true;
            }
            appliedDefault = true;
            insertTextWithBreaks(text);
            return true;
          };
          if (runTextInputHandler(state.selection.from, state.selection.to, text, deflt)) {
            event.preventDefault();
            return;
          }
          if (appliedDefault) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          deflt();
        }
        break;
      case "insertFromComposition":
        {
          const text = event.data || "";
          if (wasRecentCompositionCommit(text)) {
            event.preventDefault();
            return;
          }
          if (!text) {
            event.preventDefault();
            return;
          }
          const state = getEditorState();
          let appliedDefault = false;
          const deflt = () => {
            if (appliedDefault) {
              return true;
            }
            appliedDefault = true;
            insertTextWithBreaks(text);
            return true;
          };
          if (runTextInputHandler(state.selection.from, state.selection.to, text, deflt)) {
            event.preventDefault();
            return;
          }
          if (appliedDefault) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          deflt();
        }
        break;
      case "insertLineBreak":
      case "insertParagraph":
        {
          const state = getEditorState();
          if (wasEnterHandledRecently()) {
            event.preventDefault();
            return;
          }
          const handled = runEnterCommand(state);
          event.preventDefault();
          if (!handled) {
            insertText("\n");
          }
        }
        break;
      case "insertFromPaste":
      case "insertFromDrop":
      case "deleteByCut":
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
          deleteText(event.inputType === "deleteContentForward" ? "forward" : "backward");
        }
        break;
    }
  };

  const handleKeyDown = (event) => {
    if (event?.key === "Enter") {
      const stateForEnterHint = getEditorState();
      const headPos = Number(stateForEnterHint?.selection?.head);
      const docSize = Number(stateForEnterHint?.doc?.content?.size);
      const nearDocTail =
        Number.isFinite(headPos) &&
        Number.isFinite(docSize) &&
        headPos >= Math.max(0, Number(docSize) - 2);
      try {
        // Keep the expensive sync path only for tail-edge Enter where visual drift was observed.
        (globalThis as any).__lumenImmediateLayoutHint = nearDocTail && event.repeat !== true;
        (globalThis as any).__lumenForceSyncLayoutOnce = nearDocTail && event.repeat !== true;
      } catch (_error) {
        // no-op
      }
    }
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleKeyDown?.(event)) {
      if (event?.key === "Enter") {
        markEnterHandled("editor-handlers");
      }
      event.preventDefault();
      return;
    }
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    // 先走外部 keymap（PM 风格），未命中时再回退到内置按键行为。
    if (typeof runKeymap === "function" && runKeymap(event)) {
      if (event.key === "Enter") {
        markEnterHandled("keydown:keymap");
      }
      event.preventDefault();
      return;
    }

    if (enableBuiltInKeyFallback === false) {
      return;
    }

    const metaKey = event.ctrlKey || event.metaKey;

    if (metaKey && !event.altKey) {
      const key = (event.key || "").toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          runRedo();
        } else {
          runUndo();
        }
        return;
      }
      if (key === "y") {
        event.preventDefault();
        runRedo();
        return;
      }
    }
    if (!metaKey && !event.altKey && event.key === "Enter") {
      event.preventDefault();
      markEnterHandled("keydown");
      const state = getEditorState();
      const handled = runEnterCommand(state);
      if (!handled) {
        insertText("\n");
      }
      return;
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
      default:
        break;
    }

    if (!supportsBeforeInput && !metaKey && !event.altKey) {
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
    }
  };

  const handleKeyPress = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleKeyPress?.(event)) {
      event.preventDefault();
      return;
    }
    if (event.isComposing) {
      return;
    }
    if (event.charCode === 0) {
      return;
    }
    if (supportsBeforeInput || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key.length === 1) {
      const state = getEditorState();
      let appliedDefault = false;
      const deflt = () => {
        if (appliedDefault) {
          return true;
        }
        appliedDefault = true;
        insertText(event.key);
        return true;
      };
      if (runTextInputHandler(state.selection.from, state.selection.to, event.key, deflt)) {
        event.preventDefault();
        return;
      }
      if (appliedDefault) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      deflt();
    }
  };

  const handleCompositionStart = (event) => {
    if (isReadOnly()) {
      event?.preventDefault?.();
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleCompositionStart?.(event)) {
      event.preventDefault();
      return;
    }
    setIsComposing(true);
  };

  const handleCompositionUpdate = (event) => {
    if (isReadOnly()) {
      event?.preventDefault?.();
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleCompositionUpdate?.(event)) {
      event.preventDefault();
      return;
    }
    if (!getIsComposing()) {
      setIsComposing(true);
    }
    if (typeof event?.data === "string") {
      inputEl.value = event.data;
    }
    setPendingPreferredUpdate(true);
  };

  const handleCompositionEnd = (event) => {
    if (isReadOnly()) {
      event?.preventDefault?.();
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleCompositionEnd?.(event)) {
      event.preventDefault();
      return;
    }
    setIsComposing(false);
    const text = event.data || inputEl.value;
    if (text) {
      insertTextWithBreaks(text);
      markCompositionCommit(text);
    }
    inputEl.value = "";
    // Ensure layout/selection sync after IME commit.
    setPendingPreferredUpdate(true);
  };

  const handlePaste = (event) => {
    if (isReadOnly()) {
      event?.preventDefault?.();
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    const rawHtml = event.clipboardData?.getData("text/html") || "";
    const rawText = event.clipboardData?.getData("text/plain") || "";
    const html =
      typeof transformPastedHTML === "function"
        ? (transformPastedHTML(rawHtml) ?? "")
        : rawHtml;
    const plain = !html;
    const text =
      typeof transformPastedText === "function"
        ? (transformPastedText(rawText, plain) ?? "")
        : rawText;

    let parsedSlice = null;
    if (html) {
      try {
        parsedSlice = parseHtmlToSlice(html);
      } catch (error) {
      }
    }
    if (!parsedSlice && text) {
      const parsedTextSlice = clipboardTextParser?.(text, plain) ?? null;
      if (parsedTextSlice) {
        parsedSlice = parsedTextSlice;
      }
    }
    const slice = parsedSlice ? transformPasted?.(parsedSlice) ?? parsedSlice : null;

    if (editorHandlers?.handlePaste?.(event, slice)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    if (slice) {
      const editorState = getEditorState();
      const tr = editorState.tr.replaceSelection(slice).setMeta("uiEvent", "paste");
      setPendingPreferredUpdate(true);
      dispatchTransaction(tr);
      inputEl.value = "";
      return;
    }

    insertTextWithBreaks(text);
    inputEl.value = "";
  };

  const handleInput = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleInput?.(event)) {
      event.preventDefault();
      return;
    }
    if (event.inputType === "insertCompositionText") {
      return;
    }
    if (getIsComposing()) {
      return;
    }
    inputEl.value = "";
  };

  return {
    handleBeforeInput,
    handleKeyDown,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    handlePaste,
    handleInput,
  };
};
