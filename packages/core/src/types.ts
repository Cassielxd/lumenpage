import type { Editor } from "./Editor";
import type { PasteRule } from "./PasteRule";

export type ExtensionType = "extension" | "node" | "mark";

export type SchemaSpec = {
  nodes?: Record<string, any>;
  marks?: Record<string, any>;
};

export type HTMLAttributes = Record<string, any>;

export type AttributeConfig = {
  default?: any;
  parseHTML?: (element: any) => any;
  renderHTML?: (attributes: Record<string, any>) => HTMLAttributes | null | undefined;
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
  renderer?: any;
  pagination?: PaginationPolicy;
};

export type CanvasSelectionGeometry = {
  shouldComputeSelectionRects?: (ctx: any) => boolean;
  shouldRenderBorderOnly?: (ctx: any) => boolean;
};

export type CanvasHooks = {
  nodeViews?: Record<string, any>;
  selectionGeometries?: CanvasSelectionGeometry[];
  nodeSelectionTypes?: string[];
  decorationProviders?: any[];
  hitTestPolicies?: any[];
};

export type ParentConfig<T> = Partial<{
  [Key in keyof T]: T[Key] extends (...args: any[]) => any
    ? (...args: Parameters<T[Key]>) => ReturnType<T[Key]>
    : T[Key];
}>;

export type ExtensionContext<Options = any, Storage = any> = {
  name: string;
  options: Options;
  storage: Storage;
  editor: Editor | null;
  manager: any | null;
  schema: any | null;
  nodeRegistry: any | null;
};

export type EditorBaseEvent = {
  editor: Editor;
};

export type EditorTransactionEvent = EditorBaseEvent & {
  transaction: any;
  state?: any;
  oldState?: any;
  appendedTransactions?: any[];
};

export type EditorFocusEvent = EditorBaseEvent & {
  event: Event;
  view?: any;
};

export type EditorPasteEvent = EditorBaseEvent & {
  event: ClipboardEvent;
  slice: any;
  view?: any;
};

export type EditorDropEvent = EditorBaseEvent & {
  event: DragEvent;
  slice: any;
  moved: boolean;
  view?: any;
};

export type DispatchTransactionProps = {
  transaction: any;
  next: (transaction: any) => void;
};

export type EditorEvents = {
  mount: EditorBaseEvent;
  unmount: EditorBaseEvent;
  beforeCreate: EditorBaseEvent;
  create: EditorBaseEvent;
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
  addCommands?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addCommands"];
  }) => Record<string, any>;
  addKeyboardShortcuts?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addKeyboardShortcuts"];
  }) => Record<string, any>;
  addInputRules?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addInputRules"];
  }) => any[];
  addPasteRules?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addPasteRules"];
  }) => PasteRule[];
  transformCopied?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["transformCopied"];
  }, slice: any) => any;
  transformCopiedHTML?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["transformCopiedHTML"];
  }, html: string, slice?: any) => string | null | undefined;
  transformPasted?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["transformPasted"];
  }, slice: any) => any;
  clipboardTextSerializer?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["clipboardTextSerializer"];
  }, slice: any) => string | null | undefined;
  clipboardTextParser?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["clipboardTextParser"];
  }, text: string, context?: any, plain?: boolean) => any;
  clipboardParser?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["clipboardParser"];
  }) => any;
  clipboardSerializer?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["clipboardSerializer"];
  }) => any;
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
  }) => any[];
  extendState?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["extendState"];
  }) => Array<(state: any) => any> | ((state: any) => any) | null;
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
  }) => any;
  renderPreset?:
    | string
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["renderPreset"];
      }) => string | null);
  parseHTML?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<NodeConfig<Options, Storage>>["parseHTML"];
  }) => any[];
  renderHTML?: (
    this: ExtensionContext<Options, Storage> & {
      parent: ParentConfig<NodeConfig<Options, Storage>>["renderHTML"];
    },
    props: { node: any; HTMLAttributes: HTMLAttributes }
  ) => any;
  schema?:
    | Record<string, any>
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<NodeConfig<Options, Storage>>["schema"];
      }) => Record<string, any> | null);
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
  parseHTML?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<MarkConfig<Options, Storage>>["parseHTML"];
  }) => any[];
  renderHTML?: (
    this: ExtensionContext<Options, Storage> & {
      parent: ParentConfig<MarkConfig<Options, Storage>>["renderHTML"];
    },
    props: { mark: any; HTMLAttributes: HTMLAttributes }
  ) => any;
  schema?:
    | Record<string, any>
    | ((this: ExtensionContext<Options, Storage> & {
        parent: ParentConfig<MarkConfig<Options, Storage>>["schema"];
      }) => Record<string, any> | null);
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
  options: any;
  storage: any;
  extension: AnyExtension;
};

export type ResolvedState = {
  plugins: any[];
  keyboardShortcuts: Record<string, any>[];
  inputRules: any[];
  pasteRules: PasteRule[];
  commands: Record<string, any>;
  stateExtenders: Array<(state: any) => any>;
};

export type ResolvedStructure = {
  instances: ExtensionInstance[];
  schema: {
    nodes: Record<string, any>;
    marks: Record<string, any>;
  };
  layout: {
    byNodeName: Map<string, LayoutHooks>;
    renderPresetsByNodeName: Map<string, string>;
  };
  canvas: {
    nodeViews: Record<string, any>;
    selectionGeometries: CanvasSelectionGeometry[];
    nodeSelectionTypes: string[];
    decorationProviders: any[];
    hitTestPolicies: any[];
  };
};

export type ResolvedExtensions = ResolvedStructure & {
  state: ResolvedState;
};
