export type LayoutContext = {
  node: any;
  settings: any;
  registry?: any;
};

export type OverlaySyncContext = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  line?: any;
  pageIndex?: number;
  layout?: any;
};

export type RenderContext = {
  ctx: CanvasRenderingContext2D;
  line: any;
  pageX: number;
  pageTop: number;
  layout: any;
  defaultRender?: (line: any, pageX: number, pageTop: number, layout: any) => void;
};

export interface CanvasNodeView {
  layout?(ctx: LayoutContext): any;
  render?(ctx: RenderContext): void;
  update?(node: any, decorations: any): boolean;
  destroy?(): void;
  selectNode?(): void;
  deselectNode?(): void;
  handleClick?(x: number, y: number): boolean;
  handleDoubleClick?(x: number, y: number): boolean;
  syncDOM?(ctx: OverlaySyncContext): void;
  isSelected?: boolean;
}

export type NodeViewFactory = (
  node: any,
  view: any,
  getPos: () => number
) => CanvasNodeView;




