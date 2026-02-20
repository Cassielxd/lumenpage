export type EditorView = {
  state?: unknown;
  dispatch?: (tr: unknown) => void;
  setProps?: (props: Record<string, any>) => void;
  endOfTextblock?: (dir: "forward" | "backward" | string, state?: unknown) => boolean;
  posAtCoords?: (
    coords: { left?: number; top?: number; x?: number; y?: number; clientX?: number; clientY?: number }
  ) => number | { pos: number; inside: number } | null;
  coordsAtPos?: (
    pos: number
  ) => { left: number; right: number; top: number; bottom: number } | null;
  editable?: boolean;
  [key: string]: any;
};

export type DOMEventHandler = (view: EditorView, event: Event) => boolean;

export type NodeSelectionHit = {
  node: any;
  pos: number;
  hit: any;
  event?: PointerEvent | MouseEvent | null;
};

export type EditorProps<T = any> = {
  attributes?: Record<string, any> | ((state: unknown) => Record<string, any> | null | undefined);
  editable?: boolean | ((state: unknown) => boolean);
  decorations?: any;
  handleDOMEvents?: Record<string, DOMEventHandler>;
  handleBeforeInput?: (view: EditorView, event: InputEvent) => boolean;
  handleKeyDown?: (view: EditorView, event: KeyboardEvent) => boolean;
  handleKeyPress?: (view: EditorView, event: KeyboardEvent) => boolean;
  handleInput?: (view: EditorView, event: InputEvent) => boolean;
  handleCompositionStart?: (view: EditorView, event: CompositionEvent) => boolean;
  handleCompositionUpdate?: (view: EditorView, event: CompositionEvent) => boolean;
  handleCompositionEnd?: (view: EditorView, event: CompositionEvent) => boolean;
  handlePaste?: (view: EditorView, event: ClipboardEvent) => boolean;
  handleCopy?: (view: EditorView, event: ClipboardEvent) => boolean;
  handleCut?: (view: EditorView, event: ClipboardEvent) => boolean;
  handleTextInput?: (view: EditorView, from: number, to: number, text: string) => boolean;
  handleClick?: (view: EditorView, pos: number, event: MouseEvent) => boolean;
  handleDoubleClick?: (view: EditorView, pos: number, event: MouseEvent) => boolean;
  transformCopied?: (view: EditorView, slice: any) => any;
  transformPasted?: (view: EditorView, slice: any) => any;
  createSelectionBetween?: (view: EditorView, $anchor: any, $head: any) => any;
  isNodeSelectionTarget?: (view: EditorView, hit: NodeSelectionHit) => boolean | null | undefined;
  [key: string]: any;
};