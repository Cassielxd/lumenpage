import { createTouchHandlers } from "../../input/touchHandlers.js";

export const createTouchInteractionHandlers = ({
  settings,
  dom,
  getLayout,
  getText,
  getTextLength,
  setSelectionOffsets,
  getSelectionAnchorOffset,
  setPreferredX,
  dispatchEditorProp,
  resolvers,
}: {
  settings: any;
  dom: any;
  getLayout: () => any;
  getText: () => string;
  getTextLength: () => number;
  setSelectionOffsets: any;
  getSelectionAnchorOffset: () => any;
  setPreferredX: (value: any) => void;
  dispatchEditorProp: (name: any, ...args: any[]) => boolean;
  resolvers: {
    resolveOffsetAtCoords: any;
  };
}) => {
  return createTouchHandlers({
    getLayout,
    scrollArea: dom.scrollArea,
    getText,
    getTextLength,
    posAtCoords: resolvers.resolveOffsetAtCoords,
    setSelectionOffsets,
    getSelectionAnchorOffset,
    setPreferredX,
    dispatchEditorProp,
    inputEl: dom.input,
    longPressDelay: settings?.touch?.longPressDelay,
    tapMoveThreshold: settings?.touch?.tapMoveThreshold,
  });
};
