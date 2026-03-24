import { NodeSelection } from "lumenpage-state";

type CreateCaretFrameUpdaterArgs = {
  getLayout: () => any;
  getLayoutIndex: () => any;
  getEditorState: () => any;
  getTextLength: () => number;
  coordsAtPos: (
    layout: any,
    offset: number,
    scrollTop: number,
    viewportWidth: number,
    textLength: number,
    options?: any
  ) => any;
  getCaretOffset: () => number;
  scrollArea: any;
  setCaretRect: (rect: any) => void;
  setInputPosition?: (x: number, y: number) => void;
  setPreferredX: (x: number) => void;
};

export const createCaretFrameUpdater = ({
  getLayout,
  getLayoutIndex,
  getEditorState,
  getTextLength,
  coordsAtPos,
  getCaretOffset,
  scrollArea,
  setCaretRect,
  setInputPosition,
  setPreferredX,
}: CreateCaretFrameUpdaterArgs) => {
  const updateCaret = (updatePreferred: boolean) => {
    const layout = getLayout();
    if (!layout) {
      return;
    }
    const layoutIndex = getLayoutIndex?.() ?? null;
    const selection = getEditorState().selection;
    if (selection instanceof NodeSelection) {
      setCaretRect(null);
      setInputPosition?.(-9999, -9999);
      return;
    }
    const headParent = selection?.$head?.parent ?? null;
    const headParentOffset = Number.isFinite(selection?.$head?.parentOffset)
      ? Number(selection.$head.parentOffset)
      : null;
    const headParentSize =
      Number.isFinite(headParent?.content?.size) && headParent != null
        ? Number(headParent.content.size)
        : null;
    const preferBoundary =
      selection?.empty === true && headParent?.isTextblock === true
        ? headParentOffset === 0
          ? "start"
          : headParentSize != null && headParentOffset === headParentSize
            ? "end"
            : "start"
        : "start";

    const caretRect = coordsAtPos(
      layout,
      getCaretOffset(),
      scrollArea.scrollTop,
      scrollArea.clientWidth,
      getTextLength(),
      { preferBoundary, layoutIndex }
    );

    setCaretRect(caretRect);
    if (caretRect) {
      setInputPosition?.(caretRect.x, caretRect.y);
      if (updatePreferred) {
        setPreferredX(caretRect.x);
      }
    }
  };

  return {
    updateCaret,
  };
};
