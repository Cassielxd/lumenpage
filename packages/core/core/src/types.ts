import type { InputRule } from "lumenpage-inputrules";
import type { Mark as PMMark, MarkSpec, Node as PMNode, NodeSpec, ParseRule, Schema, Slice } from "lumenpage-model";
import type { NodeRenderer, NodeRendererRegistry } from "lumenpage-layout-engine";
import type { Command as StateCommand, EditorState, Plugin, Transaction } from "lumenpage-state";
import type { CanvasEditorView, NodeViewFactory } from "lumenpage-view-canvas";

import type { Editor } from "./Editor.js";
import type { ExtensionManager } from "./ExtensionManager.js";
import type { PasteRule } from "./PasteRule.js";

export type ExtensionType = "extension" | "node" | "mark";

type ValueOf<T> = T[keyof T];
export type UnionToIntersection<U> =
  (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
export type KeysWithTypeOf<T, Type> = {
  [Key in keyof T]: T[Key] extends Type ? Key : never;
}[keyof T];

export type FocusPosition = "start" | "end" | "all" | number | boolean | null;
export type CommandDispatch = (tr: Transaction) => void;
export type LegacyCommand = StateCommand;
export type CommandProps = {
  editor: Editor;
  tr: Transaction;
  commands: SingleCommands;
  can: () => CanCommands;
  chain: () => ChainedCommands;
  state: EditorState;
  view: CanvasEditorView | null;
  dispatch: CommandDispatch | undefined;
};
export type EditorCommand = (props: CommandProps) => boolean;
export type ResolvedCommand = LegacyCommand | EditorCommand;
export type CommandFactory = (...args: unknown[]) => ResolvedCommand | boolean;
export type AnyCommand = ResolvedCommand | CommandFactory;

export type NormalizeCommandMethod<T, ReturnType> = T extends LegacyCommand | EditorCommand
  ? () => ReturnType
  : T extends (...args: infer Args) => unknown
    ? (...args: Args) => ReturnType
    : never;

export type NormalizeCommandArgs<T> = T extends LegacyCommand | EditorCommand
  ? []
  : T extends (...args: infer Args) => unknown
    ? Args
    : never;

export type NormalizeCommandMethods<T, ReturnType> = {
  [Key in keyof T]: NormalizeCommandMethod<T[Key], ReturnType>;
};

type RegisteredCommands<ReturnType> = import("./index.js").Commands<ReturnType>;

export type UnionCommands<ReturnType = AnyCommand> = UnionToIntersection<
  ValueOf<
    Pick<RegisteredCommands<ReturnType>, KeysWithTypeOf<RegisteredCommands<ReturnType>, object>>
  >
>;

export type RawCommands = {
  [Key in keyof UnionCommands]: UnionCommands<ResolvedCommand>[Key];
};

export type CommandNameInvoker = {
  <Name extends keyof RawCommands>(
    name: Name,
    ...args: NormalizeCommandArgs<RawCommands[Name]>
  ): boolean;
  (name: string, ...args: unknown[]): boolean;
};

export type SingleCommands = {
  [Key in keyof UnionCommands]: UnionCommands<boolean>[Key];
} & {
  run: (command: AnyCommand, ...args: unknown[]) => boolean;
  can: CommandNameInvoker;
  chain: () => ChainedCommands;
};

export type ChainedCommands = {
  [Key in keyof UnionCommands]: UnionCommands<ChainedCommands>[Key];
} & {
  run: () => boolean;
  can: () => ChainedCommands;
};

export type CanCommands = {
  [Key in keyof UnionCommands]: UnionCommands<boolean>[Key];
} & {
  run: (command: AnyCommand, ...args: unknown[]) => boolean;
  can: CommandNameInvoker;
  chain: () => ChainedCommands;
};

export type CommandMap = Record<string, AnyCommand>;

export type UnknownRecord = Record<string, unknown>;
export type KeyboardShortcutMap = Record<string, LegacyCommand>;
export type EditorPlugin = Plugin<unknown>;
export type ExtensionStorage = Record<string, unknown>;
export type ParseHTMLSource = {
  style?: Partial<CSSStyleDeclaration> | null;
  getAttribute?: ((name: string) => string | null) | null;
  textContent?: string | null;
};
export type SelectionRectLike = {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
} & UnknownRecord;
export type SelectionGeometryRuntime = {
  shouldComputeSelectionRects?: (ctx: unknown) => boolean;
  shouldRenderBorderOnly?: (ctx: unknown) => boolean;
  resolveSelectionRects?: (ctx: unknown) => SelectionRectLike[] | null | undefined;
};
export type SelectionGeometryFactory = () => SelectionGeometryRuntime;
export type MarkStyleStateLike = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  underlineStyle: "solid" | "wavy";
  underlineColor: string | null;
  strike: boolean;
  strikeColor: string | null;
  code: boolean;
  isLink: boolean;
  linkHref: string | null;
  subscript: boolean;
  superscript: boolean;
  textColor: string | null;
  textBackground: string | null;
  textFontSize: number | null;
  textFontFamily: string | null;
  backgroundRadius: number;
  backgroundPaddingX: number;
  extras: UnknownRecord;
  drawInstructions: unknown[];
} & UnknownRecord;
export type SliceTransform = (
  slice: Slice,
  view?: CanvasEditorView | null
) => Slice | null | undefined;
export type HtmlTransform = (
  html: string,
  view?: CanvasEditorView | null
) => string | null | undefined;
export type CopiedHtmlTransform = (
  html: string,
  slice?: Slice,
  view?: CanvasEditorView | null
) => string | null | undefined;
export type ClipboardTextSerializer = (
  slice: Slice,
  view?: CanvasEditorView | null
) => string | null | undefined;
export type ClipboardTextParser = (
  text: string,
  context?: unknown,
  plain?: boolean,
  view?: CanvasEditorView | null
) => Slice | null | undefined;
export type ClipboardParserLike = {
  parseSlice: (content: unknown) => Slice | null | undefined;
};
export type ClipboardSerializerLike = {
  serializeFragment: (fragment: unknown) => Node;
};
export type StateExtender = (state: EditorState) => EditorState;

export type SchemaSpec = {
  nodes?: Record<string, NodeSpec>;
  marks?: Record<string, MarkSpec>;
};

export type HTMLAttributes = UnknownRecord;

export type AttributeConfig = {
  default?: unknown;
  parseHTML?: (element: ParseHTMLSource) => unknown;
  renderHTML?: (attributes: HTMLAttributes) => HTMLAttributes | null | undefined;
};

export type AttributeConfigs = Record<string, AttributeConfig>;

export type GlobalAttribute = {
  types: string[];
  attributes: AttributeConfigs;
};

export type GlobalAttributes = GlobalAttribute[];

export type PaginationPolicy = {
  fragmentModel?: "none" | "continuation";
  reusePolicy?: "actual-slice-only" | "always-sensitive" | "token-based";
};

export type LayoutHooks = {
  renderer?: NodeRenderer;
  pagination?: PaginationPolicy;
};

export type CanvasSelectionGeometry = SelectionGeometryRuntime;

export type CanvasHooks = {
  nodeViews?: Record<string, NodeViewFactory>;
  selectionGeometries?: CanvasSelectionGeometry[];
  nodeSelectionTypes?: string[];
  decorationProviders?: unknown[];
  hitTestPolicies?: unknown[];
};

export type MarkAdapterContextLike = {
  baseFont: string;
  settings: unknown;
  marks: PMMark[];
  markIndex: number;
  annotation?: MarkAnnotationLike | null;
  annotations?: MarkAnnotationLike[];
};

export type MarkAdapter = (state: MarkStyleStateLike, mark: PMMark, ctx: MarkAdapterContextLike) => void;

export type MarkAdapterMap = Record<string, MarkAdapter>;

export type MarkAnnotationLike = {
  name: string;
  attrs?: UnknownRecord | null;
  key?: string | null;
  rank?: number;
  sourceIndex?: number;
  group?: string | null;
  inclusive?: boolean | null;
  excludes?: string | null;
  spanning?: boolean | null;
  data?: unknown;
};

export type MarkAnnotationResolver = (
  mark: PMMark,
  ctx: MarkAdapterContextLike
) => MarkAnnotationLike | null | undefined;

export type MarkAnnotationResolverMap = Record<string, MarkAnnotationResolver>;

export type ParentConfig<T> = Partial<{
  [Key in keyof T]: T[Key] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : T[Key];
}>;

export type ExtensionContext<Options = any, Storage = any> = {
  name: string;
  options: Options;
  storage: Storage;
  editor: Editor | null;
  manager: ExtensionManager | null;
  schema: Schema | null;
  nodeRegistry: NodeRendererRegistry | null;
};

export type EditorBaseEvent = {
  editor: Editor;
};

export type EditorTransactionEvent = EditorBaseEvent & {
  transaction: Transaction;
  state?: EditorState;
  oldState?: EditorState;
  appendedTransactions?: Transaction[];
};

export type EditorBeforeTransactionEvent = EditorBaseEvent & {
  transaction: Transaction;
  nextState: EditorState;
};

export type EditorFocusEvent = EditorBaseEvent & {
  event: FocusEvent;
  transaction: Transaction;
  view?: CanvasEditorView;
};

export type EditorPasteEvent = EditorBaseEvent & {
  event: ClipboardEvent;
  slice: Slice;
  view?: CanvasEditorView;
};

export type EditorDropEvent = EditorBaseEvent & {
  event: DragEvent;
  slice: Slice;
  moved: boolean;
  view?: CanvasEditorView;
};

export type DispatchTransactionProps = {
  transaction: Transaction;
  next: (transaction: Transaction) => void;
};

export type EditorEvents = {
  mount: EditorBaseEvent;
  unmount: EditorBaseEvent;
  beforeCreate: EditorBaseEvent;
  create: EditorBaseEvent;
  beforeTransaction: EditorBeforeTransactionEvent;
  update: EditorTransactionEvent;
  selectionUpdate: EditorTransactionEvent;
  transaction: EditorTransactionEvent;
  focus: EditorFocusEvent;
  blur: EditorFocusEvent;
  paste: EditorPasteEvent;
  drop: EditorDropEvent;
  destroy: EditorBaseEvent;
};

export interface ExtendableConfig<
  Options = any,
  Storage = any,
  Config extends ExtendableConfig<Options, Storage, Config> = ExtendableConfig<Options, Storage, any>,
> {
  name: string;
  priority?: number;
  addOptions?: (this: { name: string; parent: ParentConfig<Config>["addOptions"] }) => Options;
  addStorage?: (this: {
    name: string;
    options: Options;
    parent: ParentConfig<Config>["addStorage"];
  }) => Storage;
  addExtensions?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addExtensions"];
  }) => Extensions;
  addGlobalAttributes?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addGlobalAttributes"];
  }) => GlobalAttributes;
  layout?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["layout"];
  }) => LayoutHooks | null;
  canvas?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["canvas"];
  }) => CanvasHooks | null;
  // Batch registration for shared render-engine mark adapters.
  addMarkAdapters?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addMarkAdapters"];
  }) => MarkAdapterMap;
  // Batch registration for shared serializable inline mark annotations.
  addMarkAnnotations?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addMarkAnnotations"];
  }) => MarkAnnotationResolverMap;
  addCommands?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addCommands"];
  }) => CommandMap;
  addKeyboardShortcuts?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addKeyboardShortcuts"];
  }) => KeyboardShortcutMap;
  addInputRules?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addInputRules"];
  }) => InputRule[];
  addPasteRules?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addPasteRules"];
  }) => PasteRule[];
  transformCopied?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["transformCopied"];
  }, slice: Slice) => Slice | null | undefined;
  transformCopiedHTML?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["transformCopiedHTML"];
  }, html: string, slice?: Slice) => string | null | undefined;
  transformPasted?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["transformPasted"];
  }, slice: Slice) => Slice | null | undefined;
  clipboardTextSerializer?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["clipboardTextSerializer"];
  }, slice: Slice) => string | null | undefined;
  clipboardTextParser?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["clipboardTextParser"];
  }, text: string, context?: unknown, plain?: boolean) => Slice | null | undefined;
  clipboardParser?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["clipboardParser"];
  }) => ClipboardParserLike | null;
  clipboardSerializer?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["clipboardSerializer"];
  }) => ClipboardSerializerLike | null;
  transformPastedText?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["transformPastedText"];
  }, text: string, plain: boolean) => string | null | undefined;
  transformPastedHTML?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["transformPastedHTML"];
  }, html: string) => string | null | undefined;
  onBeforeCreate?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onBeforeCreate"];
  }, event: EditorBaseEvent) => void;
  onMount?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onMount"];
  }, event: EditorBaseEvent) => void;
  onUnmount?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onUnmount"];
  }, event: EditorBaseEvent) => void;
  onCreate?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onCreate"];
  }, event: EditorBaseEvent) => void;
  onBeforeTransaction?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onBeforeTransaction"];
  }, event: EditorBeforeTransactionEvent) => void;
  onUpdate?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onUpdate"];
  }, event: EditorTransactionEvent) => void;
  onSelectionUpdate?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onSelectionUpdate"];
  }, event: EditorTransactionEvent) => void;
  onTransaction?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onTransaction"];
  }, event: EditorTransactionEvent) => void;
  onFocus?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onFocus"];
  }, event: EditorFocusEvent) => void;
  onBlur?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onBlur"];
  }, event: EditorFocusEvent) => void;
  onPaste?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onPaste"];
  }, event: EditorPasteEvent) => void;
  onDrop?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onDrop"];
  }, event: EditorDropEvent) => void;
  onDestroy?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["onDestroy"];
  }, event: EditorBaseEvent) => void;
  dispatchTransaction?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["dispatchTransaction"];
  }, props: DispatchTransactionProps) => void;
  addPlugins?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addPlugins"];
  }) => EditorPlugin[];
  extendState?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["extendState"];
  }) => StateExtender[] | StateExtender | null;
}

export interface ExtensionConfig<Options = any, Storage = any>
  extends ExtendableConfig<Options, Storage, ExtensionConfig<Options, Storage>> {}

export interface NodeConfig<Options = any, Storage = any>
  extends ExtendableConfig<Options, Storage, NodeConfig<Options, Storage>> {
  topNode?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["topNode"];
      }) => boolean | null);
  content?:
    | string
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["content"];
      }) => string | null);
  marks?:
    | string
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["marks"];
      }) => string | null);
  group?:
    | string
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["group"];
      }) => string | null);
  inline?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["inline"];
      }) => boolean | null);
  atom?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["atom"];
      }) => boolean | null);
  selectable?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["selectable"];
      }) => boolean | null);
  draggable?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["draggable"];
      }) => boolean | null);
  code?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["code"];
      }) => boolean | null);
  whitespace?:
    | string
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["whitespace"];
      }) => string | null);
  isolating?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["isolating"];
      }) => boolean | null);
  defining?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["defining"];
      }) => boolean | null);
  linebreakReplacement?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["linebreakReplacement"];
      }) => boolean | null);
  addAttributes?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<NodeConfig<Options, Storage>>["addAttributes"];
  }) => AttributeConfigs;
  addNodeView?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<NodeConfig<Options, Storage>>["addNodeView"];
  }) => NodeViewFactory | null;
  renderPreset?:
    | string
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["renderPreset"];
      }) => string | null);
  parseHTML?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<NodeConfig<Options, Storage>>["parseHTML"];
  }) => ParseRule[];
  renderHTML?: (
    this: ExtensionContext<Options, Storage> & {
      parent: ParentConfig<NodeConfig<Options, Storage>>["renderHTML"];
    },
    props: { node: PMNode; HTMLAttributes: HTMLAttributes }
  ) => unknown;
  schema?:
    | NodeSpec
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["schema"];
      }) => NodeSpec | null);
}

export interface MarkConfig<Options = any, Storage = any>
  extends ExtendableConfig<Options, Storage, MarkConfig<Options, Storage>> {
  group?:
    | string
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<MarkConfig<Options, Storage>>["group"];
      }) => string | null);
  inclusive?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<MarkConfig<Options, Storage>>["inclusive"];
      }) => boolean | null);
  excludes?:
    | string
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<MarkConfig<Options, Storage>>["excludes"];
      }) => string | null);
  spanning?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<MarkConfig<Options, Storage>>["spanning"];
      }) => boolean | null);
  code?:
    | boolean
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<MarkConfig<Options, Storage>>["code"];
      }) => boolean | null);
  addAttributes?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<MarkConfig<Options, Storage>>["addAttributes"];
  }) => AttributeConfigs;
  // Explicit override for this mark's default render-engine adapter.
  addMarkAdapter?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<MarkConfig<Options, Storage>>["addMarkAdapter"];
  }) => MarkAdapter | null;
  addMarkAnnotation?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<MarkConfig<Options, Storage>>["addMarkAnnotation"];
  }) => MarkAnnotationResolver | null;
  parseHTML?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<MarkConfig<Options, Storage>>["parseHTML"];
  }) => ParseRule[];
  renderHTML?: (
    this: ExtensionContext<Options, Storage> & {
      parent: ParentConfig<MarkConfig<Options, Storage>>["renderHTML"];
    },
    props: { mark: PMMark; HTMLAttributes: HTMLAttributes }
  ) => unknown;
  schema?:
    | MarkSpec
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<MarkConfig<Options, Storage>>["schema"];
      }) => MarkSpec | null);
}

export interface ExtensionLike<Options = any, Storage = any> {
  type: ExtensionType;
  name: string;
  priority: number;
  parent: ExtensionLike<any, any> | null;
  config: Partial<ExtendableConfig<Options, Storage, any>>;
  options: Partial<Options>;
}

export type AnyExtension = ExtensionLike<any, any>;
export type AnyExtensionInput = AnyExtension | ReadonlyArray<AnyExtensionInput>;
export type Extensions = ReadonlyArray<AnyExtensionInput>;
export type EnableRules = ReadonlyArray<AnyExtension | string> | boolean;

export type ExtensionInstance = {
  name: string;
  type: ExtensionType;
  priority: number;
  options: Record<string, unknown>;
  storage: ExtensionStorage;
  extension: AnyExtension;
};

export type ResolvedState = {
  plugins: EditorPlugin[];
  keyboardShortcuts: KeyboardShortcutMap[];
  inputRules: InputRule[];
  pasteRules: PasteRule[];
  commands: CommandMap;
  stateExtenders: StateExtender[];
};

export type ResolvedStructure = {
  instances: ExtensionInstance[];
  schema: {
    nodes: Record<string, NodeSpec>;
    marks: Record<string, MarkSpec>;
  };
  layout: {
    byNodeName: Map<string, LayoutHooks>;
    renderPresetsByNodeName: Map<string, string>;
  };
  canvas: {
    nodeViews: Record<string, NodeViewFactory>;
    markAdapters: MarkAdapterMap;
    markAnnotationResolvers: MarkAnnotationResolverMap;
    selectionGeometries: CanvasSelectionGeometry[];
    nodeSelectionTypes: string[];
    decorationProviders: unknown[];
    hitTestPolicies: unknown[];
  };
};

export type ResolvedExtensions = ResolvedStructure & {
  state: ResolvedState;
};
