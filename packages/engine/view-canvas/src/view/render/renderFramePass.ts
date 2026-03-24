import { now } from "../debugTrace";

export const executeRenderFramePass = ({
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
  getLastLayoutPageCount,
  setLastLayoutPageCount,
}: {
  renderer: any;
  scrollArea: any;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getLayoutVersion: () => number;
  getEditorState: () => any;
  getTextLength: () => number;
  clampOffset: (offset: number) => number;
  docPosToTextOffset: (doc: any, pos: number) => number;
  getSelectionOffsets: (state: any, mapPos: any, clamp: any) => { from: number; to: number };
  selectionFrame: { resolveSelectionRects: (args: any) => any };
  decorationFrame: { resolveDecorationData: (args: any) => any };
  overlaySync: { syncForFrame: (args: any) => void };
  getCaretRect: () => any;
  getLastLayoutPageCount: () => number;
  setLastLayoutPageCount: (count: number) => void;
}) => {
  const renderStart = now();
  const layout = getLayout();
  if (!layout) {
    return;
  }
  const layoutIndex = getLayoutIndex?.() || null;
  const editorState = getEditorState();
  const textLength = getTextLength();
  const scrollTop = Math.round(scrollArea.scrollTop * 10) / 10;
  const viewportWidth = scrollArea.clientWidth;
  const layoutToken = Number.isFinite(layout?.__version)
    ? Number(layout.__version)
    : getLayoutVersion();
  const prevPageCount = getLastLayoutPageCount() ?? 0;
  const currentPageCount = layout?.pages?.length ?? 0;
  const isProgressive = currentPageCount > prevPageCount;
  const selection = getSelectionOffsets(editorState, docPosToTextOffset, clampOffset);

  const { selectionRects, selectionMs, tableSelectionMs } = selectionFrame.resolveSelectionRects({
    layout,
    layoutIndex,
    editorState,
    selection,
    textLength,
    layoutToken,
    isProgressive,
    scrollTop,
    viewportWidth,
  });

  const { decorationData, decorationMs } = decorationFrame.resolveDecorationData({
    layout,
    layoutIndex,
    editorState,
    scrollTop,
    viewportWidth,
    textLength,
    layoutToken,
  });

  const nodeOverlayStart = now();
  overlaySync.syncForFrame({
    layout,
    layoutIndex,
    layoutToken,
    scrollTop,
    viewportWidth,
  });
  const nodeOverlayMs = Math.round((now() - nodeOverlayStart) * 100) / 100;

  const rendererStart = now();
  renderer.render(layout, scrollArea, getCaretRect(), selectionRects, [], decorationData);
  const rendererMs = Math.round((now() - rendererStart) * 100) / 100;

  setLastLayoutPageCount(currentPageCount);

  const totalMs = Math.round((now() - renderStart) * 100) / 100;
  void totalMs;
  void renderStart;
  void selectionMs;
  void tableSelectionMs;
  void decorationMs;
  void nodeOverlayMs;
  void rendererMs;
};
