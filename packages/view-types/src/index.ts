export type EditorView = {
  state?: unknown;
  dispatch?: (tr: unknown) => void;
  dispatchTransaction?: (tr: unknown) => void;
  setProps?: (props: Record<string, any>) => void;
  hasFocus?: () => boolean;
  focus?: () => void;
  destroy?: () => void;
  scrollIntoView?: (pos?: number) => void;
  getPaginationInfo?: () => any;
  someProp?: (propName: string, f?: (value: any) => any) => any;
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
  state?: unknown;
  dispatchTransaction?: (tr: any) => void;
  onChange?: (view: EditorView, event: any) => void;
  nodeViews?: Record<string, any>;
  nodeSelectionTypes?: string[];
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
  handlePaste?: (view: EditorView, event: ClipboardEvent, slice?: any) => boolean;
  scrollThreshold?: number | { top?: number; right?: number; bottom?: number; left?: number };
  scrollMargin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  blockSelection?:
    | boolean
    | string[]
    | {
        enabled?: boolean;
        types?: string[];
        excludeTypes?: string[];
      };
  dropCursor?:
    | boolean
    | {
        color?: string;
        width?: number;
      };
  createDropCursorDecoration?: (view: EditorView, pos: number, context: any) => any;
  parseHtmlToSlice?: (view: EditorView, html: string) => any;
  getText?: (view: EditorView, doc: any) => string;
  isInSpecialStructureAtPos?: (view: EditorView, state: any, pos: number) => boolean;
  shouldAutoAdvanceAfterEnter?: (
    view: EditorView,
    args: { prevState: any; nextState: any; prevHead: number }
  ) => boolean;
  resolveDragNodePos?: (
    view: EditorView,
    event: PointerEvent | DragEvent | MouseEvent | Event
  ) => number | null | undefined;
  handleScrollToSelection?: (view: EditorView) => boolean;
  handleDrop?: (view: EditorView, event: DragEvent, slice?: any, moved?: boolean) => boolean;
  handleCopy?: (view: EditorView, event: ClipboardEvent) => boolean;
  handleCut?: (view: EditorView, event: ClipboardEvent) => boolean;
  dragCopies?: boolean | ((view: EditorView, event: DragEvent) => boolean);
  handleTextInput?: (
    view: EditorView,
    from: number,
    to: number,
    text: string,
    deflt?: () => boolean
  ) => boolean;
  handleClickOn?: (
    view: EditorView,
    pos: number,
    node: any,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleClick?: (view: EditorView, pos: number, event: MouseEvent) => boolean;
  handleDoubleClickOn?: (
    view: EditorView,
    pos: number,
    node: any,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleDoubleClick?: (view: EditorView, pos: number, event: MouseEvent) => boolean;
  handleTripleClickOn?: (
    view: EditorView,
    pos: number,
    node: any,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleTripleClick?: (view: EditorView, pos: number, event: MouseEvent) => boolean;
  transformCopied?: (view: EditorView, slice: any) => any;
  transformCopiedHTML?: (view: EditorView, html: string, slice?: any) => string;
  transformPastedText?: (view: EditorView, text: string, plain: boolean) => string;
  transformPastedHTML?: (view: EditorView, html: string) => string;
  transformPasted?: (view: EditorView, slice: any) => any;
  clipboardParser?: any;
  domParser?: any;
  clipboardSerializer?: any;
  clipboardTextSerializer?: (view: EditorView, slice: any) => string;
  clipboardTextParser?: (view: EditorView, text: string, context?: any, plain?: boolean) => any;
  createSelectionBetween?: (view: EditorView, $anchor: any, $head: any) => any;
  isNodeSelectionTarget?: (view: EditorView, hit: NodeSelectionHit) => boolean | null | undefined;
  [key: string]: any;
};
