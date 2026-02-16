/*
 * 文件说明：输入事件桥接。
 * 主要职责：统一转发 beforeinput / keydown / composition / paste / copy / cut 事件。
 */

type InputBridgeHandlers = {
  onBeforeInput?: (event: InputEvent) => void;
  onInput?: (event: InputEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onCompositionStart?: (event: CompositionEvent) => void;
  onCompositionUpdate?: (event: CompositionEvent) => void;
  onCompositionEnd?: (event: CompositionEvent) => void;
  onPaste?: (event: ClipboardEvent) => void;
  onCopy?: (event: ClipboardEvent) => void;
  onCut?: (event: ClipboardEvent) => void;
};

export function attachInputBridge(
  textarea: HTMLTextAreaElement,
  handlers: InputBridgeHandlers = {}
) {
  const onBeforeInput = (event) => handlers.onBeforeInput?.(event);

  const onInput = (event) => handlers.onInput?.(event);

  const onKeyDown = (event) => handlers.onKeyDown?.(event);

  const onCompositionStart = (event) => handlers.onCompositionStart?.(event);

  const onCompositionUpdate = (event) => handlers.onCompositionUpdate?.(event);

  const onCompositionEnd = (event) => handlers.onCompositionEnd?.(event);

  const onPaste = (event) => handlers.onPaste?.(event);

  const onCopy = (event) => handlers.onCopy?.(event);

  const onCut = (event) => handlers.onCut?.(event);

  textarea.addEventListener("beforeinput", onBeforeInput);

  textarea.addEventListener("input", onInput);

  textarea.addEventListener("keydown", onKeyDown);

  textarea.addEventListener("compositionstart", onCompositionStart);

  textarea.addEventListener("compositionupdate", onCompositionUpdate);

  textarea.addEventListener("compositionend", onCompositionEnd);

  textarea.addEventListener("paste", onPaste);

  textarea.addEventListener("copy", onCopy);

  textarea.addEventListener("cut", onCut);

  return () => {
    textarea.removeEventListener("beforeinput", onBeforeInput);

    textarea.removeEventListener("input", onInput);

    textarea.removeEventListener("keydown", onKeyDown);

    textarea.removeEventListener("compositionstart", onCompositionStart);

    textarea.removeEventListener("compositionupdate", onCompositionUpdate);

    textarea.removeEventListener("compositionend", onCompositionEnd);

    textarea.removeEventListener("paste", onPaste);

    textarea.removeEventListener("copy", onCopy);

    textarea.removeEventListener("cut", onCut);
  };
}
