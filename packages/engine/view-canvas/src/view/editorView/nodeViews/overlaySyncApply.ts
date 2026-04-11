export const hideOverlayEntry = (entry: any) => {
  entry?.view?.syncDOM?.({ visible: false });
  return false;
};

export const applyCachedOverlayFrame = ({
  entry,
  frame,
  layout,
}: {
  entry: any;
  frame: any;
  layout: any;
}) => {
  entry?.view?.syncDOM?.({
    x: frame?.x,
    y: frame?.y,
    width: frame?.width,
    height: frame?.height,
    visible: frame?.visible === true,
    pageIndex: frame?.pageIndex ?? null,
    layout,
  });
  return frame?.visible === true;
};

export const applyResolvedOverlayFrame = ({
  entry,
  frame,
  layout,
}: {
  entry: any;
  frame: any;
  layout: any;
}) => {
  entry?.view?.syncDOM?.({
    x: frame?.x,
    y: frame?.y,
    width: frame?.width,
    height: frame?.height,
    visible: frame?.visible === true,
    line: frame?.line ?? null,
    pageIndex: frame?.pageIndex ?? null,
    layout,
  });
  return frame?.visible === true;
};

export const createOverlayCacheState = ({
  frame,
  scrollTop,
  viewportWidth,
  layoutVersion,
}: {
  frame: any;
  scrollTop: number;
  viewportWidth: number;
  layoutVersion: number | null;
}) => ({
  x: frame?.x,
  y: frame?.y,
  width: frame?.width,
  height: frame?.height,
  visible: frame?.visible === true,
  pageIndex: frame?.pageIndex ?? null,
  scrollTop,
  viewportWidth,
  layoutVersion,
});
