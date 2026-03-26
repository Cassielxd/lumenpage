import type { DOMParser as PMDOMParser, Node as PMNode, ResolvedPos, Slice } from "lumenpage-model";
import type { EditorState, Selection, Transaction } from "lumenpage-state";

import type { CanvasViewConfig } from "../canvasConfig";
import type { CanvasEditorView } from "../editorView";
import type { CanvasDecoration, DecorationSet } from "../decorations";
import type { NodeViewFactory } from "../nodeView";

export type CanvasEditorViewHandle = CanvasEditorView;

export type NodeSelectionTargetArgs = {
  node: PMNode;
  pos: number;
  hit?: unknown;
  event?: Event | null;
};

export type CanvasViewAttributes = Record<string, unknown>;
export type CanvasSelectionRange = {
  from: number;
  to: number;
};
export type CanvasSelectionRect = {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  borderOnly?: boolean;
  [key: string]: unknown;
};
export type CanvasSelectionGeometryDecisionContext = {
  editorState: EditorState;
  selection: CanvasSelectionRange;
};
export type CanvasSelectionGeometryResolveContext = CanvasSelectionGeometryDecisionContext & {
  layout: unknown;
  scrollTop: number;
  viewportWidth: number;
  layoutIndex: unknown;
  docPosToTextOffset: (doc: PMNode, pos: number) => number;
};
export type CanvasTableCellSelectionRectsResolver = (
  ctx: CanvasSelectionGeometryResolveContext & {
    doc: PMNode;
    selection: Selection;
  }
) => CanvasSelectionRect[] | null | undefined;
export type CanvasTableRangeSelectionRectsResolver = (
  ctx: Omit<CanvasSelectionGeometryResolveContext, "selection"> & {
    fromOffset: number;
    toOffset: number;
  }
) => CanvasSelectionRect[] | null | undefined;
export type CanvasSelectionGeometry = {
  shouldComputeSelectionRects?: (ctx: CanvasSelectionGeometryDecisionContext) => boolean;
  shouldRenderBorderOnly?: (ctx: CanvasSelectionGeometryDecisionContext) => boolean;
  resolveSelectionRects?: (
    ctx: CanvasSelectionGeometryResolveContext
  ) => CanvasSelectionRect[] | null | undefined;
  tableCellSelectionToRects?: CanvasTableCellSelectionRectsResolver;
  tableRangeSelectionToCellRects?: CanvasTableRangeSelectionRectsResolver;
};
export type CanvasSelectionGeometryProp =
  | CanvasSelectionGeometry
  | ((view: CanvasEditorViewHandle) => CanvasSelectionGeometry | null | undefined);

export type CanvasDecorations = DecorationSet | CanvasDecoration[];
export type CanvasClipboardSerializer = {
  serializeFragment: (fragment: PMNode["content"]) => Node;
};
export type CanvasClipboardParser = {
  parseSlice: (content: ParentNode | globalThis.Node | unknown) => Slice | null | undefined;
};
export type CanvasSelectionFactory = (
  view: CanvasEditorViewHandle,
  anchor: ResolvedPos,
  head: ResolvedPos
) => Selection | null | undefined;
export type CanvasStateChangeSelection = {
  from: number;
  to: number;
  anchor: number;
  head: number;
};
export type CanvasStateChangeEvent = {
  transaction: Transaction;
  state: EditorState;
  oldState?: EditorState;
  transactions: Transaction[];
  appendedTransactions: Transaction[];
  source: string;
  docChanged: boolean;
  selectionChanged: boolean;
  steps: unknown[];
  selection: CanvasStateChangeSelection | null;
  summary: unknown;
  timestamp: number;
};
export type CanvasAutoAdvanceArgs = {
  prevState: EditorState;
  nextState: EditorState;
  prevHead: number;
};

export type HookArgsWithoutView<T> = T extends (view: CanvasEditorViewHandle, ...args: infer A) => unknown
  ? A
  : [];
export type HookReturn<T> = T extends (...args: unknown[]) => infer R ? R : T;

export type CanvasEditorViewProps = {
  state: EditorState;
  canvasViewConfig?: CanvasViewConfig;
  dispatchTransaction?: (tr: Transaction) => void;
  editable?: boolean | ((view: CanvasEditorViewHandle) => boolean);
  attributes?: CanvasViewAttributes | ((state: EditorState) => CanvasViewAttributes);
  formatStatusText?: (
    view: CanvasEditorViewHandle,
    args: { pageCount: number; focused: "typing" | "idle"; inputFocused: boolean }
  ) => string | null;
  onBeforeTransaction?: (
    view: CanvasEditorViewHandle,
    args: { transaction: Transaction; nextState: EditorState }
  ) => void;
  onChange?: (view: CanvasEditorViewHandle, event: CanvasStateChangeEvent) => void;
  nodeSelectionTypes?: string[];
  isNodeSelectionTarget?: (view: CanvasEditorViewHandle, args: NodeSelectionTargetArgs) => boolean | null;
  isInSpecialStructureAtPos?: (view: CanvasEditorViewHandle, state: EditorState, pos: number) => boolean;
  shouldAutoAdvanceAfterEnter?: (
    view: CanvasEditorViewHandle,
    args: CanvasAutoAdvanceArgs
  ) => boolean | null;
  getText?: (view: CanvasEditorViewHandle, doc: PMNode) => string;
  getTextLength?: (view: CanvasEditorViewHandle, doc: PMNode) => number;
  parseHtmlToSlice?: (view: CanvasEditorViewHandle, html: string) => Slice | null | undefined;
  transformCopied?: (view: CanvasEditorViewHandle, slice: Slice) => Slice | null | undefined;
  transformCopiedHTML?: (view: CanvasEditorViewHandle, html: string, slice?: Slice) => string;
  transformPasted?: (view: CanvasEditorViewHandle, slice: Slice) => Slice | null | undefined;
  transformPastedText?: (view: CanvasEditorViewHandle, text: string, plain: boolean) => string;
  transformPastedHTML?: (view: CanvasEditorViewHandle, html: string) => string;
  clipboardTextSerializer?: (view: CanvasEditorViewHandle, slice: Slice) => string | null;
  clipboardTextParser?: (
    view: CanvasEditorViewHandle,
    text: string,
    context: ResolvedPos | null | undefined,
    plain: boolean
  ) => Slice | null | undefined;
  clipboardSerializer?: CanvasClipboardSerializer | null;
  clipboardParser?: CanvasClipboardParser | null;
  domParser?: Pick<PMDOMParser, "parseSlice"> | null;
  createSelectionBetween?: CanvasSelectionFactory;
  selectionGeometry?: CanvasSelectionGeometryProp;
  handleBeforeInput?: (view: CanvasEditorViewHandle, event: InputEvent) => boolean;
  handleInput?: (view: CanvasEditorViewHandle, event: InputEvent) => boolean;
  handleKeyDown?: (view: CanvasEditorViewHandle, event: KeyboardEvent) => boolean;
  handleKeyPress?: (view: CanvasEditorViewHandle, event: KeyboardEvent) => boolean;
  handleTextInput?: (
    view: CanvasEditorViewHandle,
    from: number,
    to: number,
    text: string,
    deflt: () => boolean
  ) => boolean;
  handleCompositionStart?: (view: CanvasEditorViewHandle, event: CompositionEvent) => boolean;
  handleCompositionUpdate?: (view: CanvasEditorViewHandle, event: CompositionEvent) => boolean;
  handleCompositionEnd?: (view: CanvasEditorViewHandle, event: CompositionEvent) => boolean;
  handlePaste?: (view: CanvasEditorViewHandle, event: ClipboardEvent, slice: Slice) => boolean;
  handleDrop?: (
    view: CanvasEditorViewHandle,
    event: DragEvent,
    slice: Slice,
    moved: boolean
  ) => boolean;
  handleCopy?: (view: CanvasEditorViewHandle, event: ClipboardEvent) => boolean;
  handleCut?: (view: CanvasEditorViewHandle, event: ClipboardEvent) => boolean;
  handleClickOn?: (
    view: CanvasEditorViewHandle,
    pos: number,
    node: PMNode,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleClick?: (view: CanvasEditorViewHandle, pos: number, event: MouseEvent) => boolean;
  handleDoubleClickOn?: (
    view: CanvasEditorViewHandle,
    pos: number,
    node: PMNode,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleDoubleClick?: (view: CanvasEditorViewHandle, pos: number, event: MouseEvent) => boolean;
  handleTripleClickOn?: (
    view: CanvasEditorViewHandle,
    pos: number,
    node: PMNode,
    nodePos: number,
    event: MouseEvent,
    direct: boolean
  ) => boolean;
  handleTripleClick?: (view: CanvasEditorViewHandle, pos: number, event: MouseEvent) => boolean;
  decorations?: CanvasDecorations | ((state: EditorState) => CanvasDecorations | null | undefined);
  nodeViews?: Record<string, NodeViewFactory>;
  handleDOMEvents?: Record<string, (view: CanvasEditorViewHandle, event: Event) => boolean>;
  [key: string]: unknown;
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
  | "handleDrop"
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
