export const createInputHandlers = ({
  getEditorState,
  dispatchTransaction,
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
  let lastDeleteHandledAt = 0;
  let lastDeleteRequestedAt = 0;
  let lastDeleteDirection = null;
  let deleteBurstCount = 0;
  let lastRepeatedDeleteKeyAt = 0;
  let lastRepeatedDeleteDirection = null;
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
  const markEnterHandled = (source) => {
    void source;
    lastEnterHandledAt = Date.now();
  };
  const wasEnterHandledRecently = () => Date.now() - lastEnterHandledAt <= 120;
  const markDeleteHandled = (source) => {
    void source;
    lastDeleteHandledAt = Date.now();
  };
  const wasDeleteHandledRecently = () => Date.now() - lastDeleteHandledAt <= 120;
  const markRepeatedDeleteKey = (direction) => {
    lastRepeatedDeleteKeyAt = Date.now();
    lastRepeatedDeleteDirection = direction;
  };
  const wasRepeatedDeleteKeyRecently = (direction) =>
    lastRepeatedDeleteDirection === direction && Date.now() - lastRepeatedDeleteKeyAt <= 96;
  const resolveDeleteDirection = (inputType) =>
    String(inputType || "").toLowerCase().includes("backward") ? "backward" : "forward";
  const resolveDeleteBurstAmount = (direction, repeated = false) => {
    const now = Date.now();
    const sameBurst = lastDeleteDirection === direction && now - lastDeleteRequestedAt <= 72;
    deleteBurstCount = sameBurst ? deleteBurstCount + 1 : 1;
    lastDeleteDirection = direction;
    lastDeleteRequestedAt = now;

    if (!(repeated || deleteBurstCount >= 3)) {
      return 1;
    }
    if (deleteBurstCount >= 12) {
      return 6;
    }
    if (deleteBurstCount >= 6) {
      return 4;
    }
    return 2;
  };
  const applyDeleteFallback = (direction, amount = 1) => {
    const state = getEditorState();
    const selection = state?.selection;
    if (!state?.tr || !selection) {
      return false;
    }
    if (!selection.empty) {
      setPendingPreferredUpdate(true);
      dispatchTransaction(state.tr.deleteSelection());
      return true;
    }

    if (direction === "backward") {
      const parent = selection.$from?.parent;
      const parentOffset = Number(selection.$from?.parentOffset);
      if (!Number.isFinite(parentOffset) || parentOffset <= 0 || selection.from <= 0) {
        return false;
      }
      const deleteCount =
        parent?.isTextblock === true
          ? Math.max(1, Math.min(Math.round(amount), parentOffset))
          : 1;
      setPendingPreferredUpdate(true);
      dispatchTransaction(state.tr.delete(selection.from - deleteCount, selection.from));
      return true;
    }

    const parent = selection.$to?.parent;
    const parentContentSize = Number(selection.$to?.parent?.content?.size);
    const parentOffset = Number(selection.$to?.parentOffset);
    if (
      !Number.isFinite(parentOffset) ||
      !Number.isFinite(parentContentSize) ||
      parentOffset >= parentContentSize
    ) {
      return false;
    }
    const deleteCount =
      parent?.isTextblock === true
        ? Math.max(1, Math.min(Math.round(amount), parentContentSize - parentOffset))
        : 1;
    setPendingPreferredUpdate(true);
    dispatchTransaction(state.tr.delete(selection.to, selection.to + deleteCount));
    return true;
  };

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
        if (wasEnterHandledRecently()) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        break;
      case "insertFromPaste":
      case "insertFromDrop":
      case "deleteByCut":
        event.preventDefault();
        break;
      case "historyUndo":
      case "historyRedo":
        event.preventDefault();
        break;
      default:
        if (event.inputType && event.inputType.startsWith("delete")) {
          if (wasDeleteHandledRecently()) {
            event.preventDefault();
            return;
          }
          const direction = resolveDeleteDirection(event.inputType);
          const burstAmount = resolveDeleteBurstAmount(
            direction,
            wasRepeatedDeleteKeyRecently(direction)
          );
          const handled =
            (typeof deleteText === "function" && deleteText(direction, burstAmount) !== false) ||
            applyDeleteFallback(direction, burstAmount);
          if (handled) {
            markDeleteHandled("beforeinput");
          }
          event.preventDefault();
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
        // Tail-edge Enter can create a new page while the key is auto-repeating.
        // Keep forcing the next pass sync in that narrow case so caret/page creation
        // does not visibly lag behind repeated Enter input.
        (globalThis as any).__lumenImmediateLayoutHint = nearDocTail;
        (globalThis as any).__lumenForceSyncLayoutOnce = nearDocTail;
      } catch (_error) {
        // no-op
      }
    }
    if (event.defaultPrevented) {
      return;
    }
    if (event?.key === "Backspace" || event?.key === "Delete") {
      const direction = event.key === "Backspace" ? "backward" : "forward";
      if (event.repeat === true) {
        markRepeatedDeleteKey(direction);
      }
    }
    if (editorHandlers?.handleKeyDown?.(event)) {
      if (event?.key === "Enter") {
        markEnterHandled("editor-handlers");
      }
      if (event?.key === "Backspace" || event?.key === "Delete") {
        markDeleteHandled("editor-handlers");
      }
      event.preventDefault();
      return;
    }
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    // 先走外部 keymap（PM 风格），未命中时再回退到内置按键行为。
    const metaKey = event.ctrlKey || event.metaKey;

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
        const burstAmount = resolveDeleteBurstAmount("backward", event.repeat === true);
        if (
          (typeof deleteText === "function" && deleteText("backward", burstAmount) !== false) ||
          applyDeleteFallback("backward", burstAmount)
        ) {
          markDeleteHandled("keydown-fallback");
        }
        event.preventDefault();
        return;
      }
      if (event.key === "Delete") {
        const burstAmount = resolveDeleteBurstAmount("forward", event.repeat === true);
        if (
          (typeof deleteText === "function" && deleteText("forward", burstAmount) !== false) ||
          applyDeleteFallback("forward", burstAmount)
        ) {
          markDeleteHandled("keydown-fallback");
        }
        event.preventDefault();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
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
