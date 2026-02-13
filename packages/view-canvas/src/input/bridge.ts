/*
 * 文件说明：输入事件桥接。
 * 主要职责：统一绑定/解绑 beforeinput、keydown、composition、paste 等事件。
 */

export function attachInputBridge(textarea, handlers = {}) {
  const onBeforeInput = (event) => handlers.onBeforeInput?.(event);

  const onInput = (event) => handlers.onInput?.(event);

  const onKeyDown = (event) => handlers.onKeyDown?.(event);

  const onCompositionStart = (event) => handlers.onCompositionStart?.(event);

  const onCompositionUpdate = (event) => handlers.onCompositionUpdate?.(event);

  const onCompositionEnd = (event) => handlers.onCompositionEnd?.(event);

  const onPaste = (event) => handlers.onPaste?.(event);

  textarea.addEventListener("beforeinput", onBeforeInput);

  textarea.addEventListener("input", onInput);

  textarea.addEventListener("keydown", onKeyDown);

  textarea.addEventListener("compositionstart", onCompositionStart);

  textarea.addEventListener("compositionupdate", onCompositionUpdate);

  textarea.addEventListener("compositionend", onCompositionEnd);

  textarea.addEventListener("paste", onPaste);

  return () => {
    textarea.removeEventListener("beforeinput", onBeforeInput);

    textarea.removeEventListener("input", onInput);

    textarea.removeEventListener("keydown", onKeyDown);

    textarea.removeEventListener("compositionstart", onCompositionStart);

    textarea.removeEventListener("compositionupdate", onCompositionUpdate);

    textarea.removeEventListener("compositionend", onCompositionEnd);

    textarea.removeEventListener("paste", onPaste);
  };
}
