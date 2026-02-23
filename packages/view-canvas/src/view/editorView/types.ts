import type { CanvasViewConfig } from "../canvasConfig";

export type CanvasCommandConfig = {
  basicCommands?: Record<string, any>;
  runCommand?: (command: any, state: any, dispatch: any, view?: any) => boolean;
  setBlockAlign?: (...args: any[]) => any;
  keymap?: Record<string, any>;
  fallbackKeyHandling?: boolean;
  viewCommands?: Record<string, any>;
};

export type NodeSelectionTargetArgs = {
  node: any;
  pos: number;
  hit?: any;
  event?: Event | null;
};

export type HookArgsWithoutView<T> = T extends (view: any, ...args: infer A) => any ? A : any[];
export type HookReturn<T> = T extends (...args: any[]) => infer R ? R : T;

export type CanvasEditorViewProps = {
  state: any;
  canvasViewConfig?: CanvasViewConfig;
  commandConfig?: CanvasCommandConfig | null;
  dispatchTransaction?: (tr: any) => void;
  editable?: boolean | ((view: any) => boolean);
  attributes?: Record<string, any> | ((state: any) => Record<string, any>);
  onChange?: (view: any, event: any) => void;
  nodeSelectionTypes?: string[];
  isNodeSelectionTarget?: (view: any, args: NodeSelectionTargetArgs) => boolean | null;
  isInSpecialStructureAtPos?: (view: any, state: any, pos: number) => boolean;
  shouldAutoAdvanceAfterEnter?: (view: any, args: any) => boolean | null;
  getText?: (view: any, doc: any) => string;
  parseHtmlToSlice?: (view: any, html: string) => any;
  transformCopied?: (view: any, slice: any) => any;
  transformCopiedHTML?: (view: any, html: string, slice: any) => string;
  transformPasted?: (view: any, slice: any) => any;
  transformPastedText?: (view: any, text: string, plain: boolean) => string;
  transformPastedHTML?: (view: any, html: string) => string;
  clipboardTextSerializer?: (view: any, slice: any) => string | null;
  clipboardTextParser?: (view: any, text: string, context: any, plain: boolean) => any;
  clipboardSerializer?: any;
  clipboardParser?: any;
  domParser?: any;
  createSelectionBetween?: (view: any, anchor: any, head: any) => any;
  selectionGeometry?: (view: any, args: any) => any;
  handleBeforeInput?: (view: any, event: InputEvent) => boolean;
  handleInput?: (view: any, event: InputEvent) => boolean;
  handleKeyDown?: (view: any, event: KeyboardEvent) => boolean;
  handleKeyPress?: (view: any, event: KeyboardEvent) => boolean;
  handleTextInput?: (view: any, from: number, to: number, text: string, deflt: any) => boolean;
  handleCompositionStart?: (view: any, event: CompositionEvent) => boolean;
  handleCompositionUpdate?: (view: any, event: CompositionEvent) => boolean;
  handleCompositionEnd?: (view: any, event: CompositionEvent) => boolean;
  handlePaste?: (view: any, event: ClipboardEvent, slice: any) => boolean;
  handleCopy?: (view: any, event: ClipboardEvent) => boolean;
  handleCut?: (view: any, event: ClipboardEvent) => boolean;
  handleClickOn?: (
    view: any,
    pos: number,
    node: any,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleClick?: (view: any, pos: number, event: MouseEvent) => boolean;
  handleDoubleClickOn?: (
    view: any,
    pos: number,
    node: any,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleDoubleClick?: (view: any, pos: number, event: MouseEvent) => boolean;
  handleTripleClickOn?: (
    view: any,
    pos: number,
    node: any,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleTripleClick?: (view: any, pos: number, event: MouseEvent) => boolean;
  decorations?: (state: any) => any;
  nodeViews?: Record<string, any>;
  handleDOMEvents?: Record<string, (view: any, event: Event) => boolean>;
  [key: string]: any;
};

export type QueryEditorProp = <K extends keyof CanvasEditorViewProps & string>(
  name: K,
  ...args: HookArgsWithoutView<CanvasEditorViewProps[K]>
) => HookReturn<CanvasEditorViewProps[K]> | null;

export type CanvasBooleanHandlerKey =
  | "handleBeforeInput"
  | "handleInput"
  | "handleKeyDown"
  | "handleKeyPress"
  | "handleTextInput"
  | "handleCompositionStart"
  | "handleCompositionUpdate"
  | "handleCompositionEnd"
  | "handlePaste"
  | "handleCopy"
  | "handleCut"
  | "handleClickOn"
  | "handleClick"
  | "handleDoubleClickOn"
  | "handleDoubleClick"
  | "handleTripleClickOn"
  | "handleTripleClick";

export type DispatchEditorProp = <K extends CanvasBooleanHandlerKey>(
  name: K,
  ...args: HookArgsWithoutView<CanvasEditorViewProps[K]>
) => boolean;
