import { now } from "./debugTrace.js";
import { createCaretFrameUpdater } from "./caretFrameUpdater.js";
import { createNodeOverlaySyncCoordinator } from "./render/nodeOverlaySyncCoordinator.js";
import { createRenderFrameDecorations } from "./render/renderFrameDecorations.js";
import { executeRenderFramePass } from "./render/renderFramePass.js";
import { createRenderFrameSelection } from "./render/renderFrameSelection.js";

type CreateRenderFrameCoordinatorArgs = {
  view: any;
  renderer: any;
  scrollArea: any;
  getRafId: () => number;
  setRafId: (id: number) => void;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getLayoutVersion: () => number;
  getEditorState: () => any;
  getTextLength: () => number;
  clampOffset: (offset: number) => number;
  docPosToTextOffset: (doc: any, pos: number) => number;
  getSelectionOffsets: (state: any, mapPos: any, clamp: any) => { from: number; to: number };
  selectionToRects: (
    layout: any,
    from: number,
    to: number,
    scrollTop: number,
    viewportWidth: number,
    textLength: number,
    layoutIndex: any
  ) => any[];
  getDecorations?: () => any;
  coordsAtPos: (
    layout: any,
    offset: number,
    scrollTop: number,
    viewportWidth: number,
    textLength: number,
    options?: any
  ) => any;
  getCaretRect: () => any;
  getCaretOffset: () => number;
  setCaretRect: (rect: any) => void;
  setInputPosition?: (x: number, y: number) => void;
  setPreferredX: (x: number) => void;
  queryEditorProp?: (name: string, args?: any) => any;
  syncNodeViewOverlays?: (args: { layout: any; layoutIndex: any; scrollArea: any }) => void;
};

export const createRenderFrameCoordinator = ({
  view,
  renderer,
  scrollArea,
  getRafId,
  setRafId,
  getLayout,
  getLayoutIndex,
  getLayoutVersion,
  getEditorState,
  getTextLength,
  clampOffset,
  docPosToTextOffset,
  getSelectionOffsets,
  selectionToRects,
  getDecorations,
  coordsAtPos,
  getCaretRect,
  getCaretOffset,
  setCaretRect,
  setInputPosition,
  setPreferredX,
  queryEditorProp,
  syncNodeViewOverlays,
}: CreateRenderFrameCoordinatorArgs) => {
  let lastLayoutPageCount = 0;
  const selectionFrame = createRenderFrameSelection({
    queryEditorProp,
    docPosToTextOffset,
    selectionToRects,
  });
  const decorationFrame = createRenderFrameDecorations({
    getDecorations,
    coordsAtPos,
    docPosToTextOffset,
  });
  const overlaySync = createNodeOverlaySyncCoordinator({
    scrollArea,
    settings: renderer?.settings ?? null,
    syncNodeViewOverlays,
  });
  const caretFrameUpdater = createCaretFrameUpdater({
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
  });

  const scheduleRender = () => {
    if (getRafId()) {
      return;
    }

    setRafId(
      requestAnimationFrame(() => {
        try {
          setRafId(0);
          executeRenderFramePass({
            renderer,
            scrollArea,
            getLayout,
            getLayoutIndex,
            getLayoutVersion,
            getEditorState,
            getTextLength,
            clampOffset,
            docPosToTextOffset,
            getSelectionOffsets,
            selectionFrame,
            decorationFrame,
            overlaySync,
            getCaretRect,
            getLastLayoutPageCount: () => lastLayoutPageCount,
            setLastLayoutPageCount: (count) => {
              lastLayoutPageCount = count;
            },
          });
        } catch (error) {
          setRafId(0);
          console.error("[render-sync] render fatal", error);
        }
      })
    );
  };

  const updateCaret = (updatePreferred: boolean) => {
    caretFrameUpdater.updateCaret(updatePreferred);
  };

  return {
    scheduleRender,
    updateCaret,
    handleDecorationClick: (event: any, coords: any) =>
      decorationFrame.handleDecorationClick({
        view,
        event,
        coords,
      }),
    hasClickableDecorationAt: (coords: any) =>
      decorationFrame.hasClickableDecorationAt({
        coords,
      }),
    onLayoutApplied: (layout: any) => {
      lastLayoutPageCount = layout?.pages?.length ?? 0;
    },
    destroy: () => {
      overlaySync.destroy();
      const renderRafId = getRafId();
      if (renderRafId) {
        cancelAnimationFrame(renderRafId);
        setRafId(0);
      }
    },
  };
};
