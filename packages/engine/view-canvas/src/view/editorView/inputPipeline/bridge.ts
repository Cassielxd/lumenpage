import { attachInputBridge } from "../../input/bridge";
import { isEditorDomEventHandled } from "../plugins";

export const attachEditorInputBridge = ({
  inputEl,
  handlers,
}: {
  inputEl: any;
  handlers: {
    handleBeforeInput: (event: any) => void;
    handleInput: (event: any) => void;
    handleKeyDown: (event: any) => void;
    handleKeyPress: (event: any) => void;
    handleCompositionStart: (event: any) => void;
    handleCompositionUpdate: (event: any) => void;
    handleCompositionEnd: (event: any) => void;
    handlePaste: (event: any) => void;
    handleCopy: (event: any) => void;
    handleCut: (event: any) => void;
  };
}) => {
  const shouldSkipHandledDomEvent = (event: any) =>
    event?.defaultPrevented || isEditorDomEventHandled(event);

  return attachInputBridge(inputEl, {
    onBeforeInput: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleBeforeInput(event);
      }
    },
    onInput: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleInput(event);
      }
    },
    onKeyDown: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleKeyDown(event);
      }
    },
    onKeyPress: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleKeyPress(event);
      }
    },
    onCompositionStart: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleCompositionStart(event);
      }
    },
    onCompositionUpdate: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleCompositionUpdate(event);
      }
    },
    onCompositionEnd: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleCompositionEnd(event);
      }
    },
    onPaste: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handlePaste(event);
      }
    },
    onCopy: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleCopy(event);
      }
    },
    onCut: (event: any) => {
      if (!shouldSkipHandledDomEvent(event)) {
        handlers.handleCut(event);
      }
    },
  });
};
