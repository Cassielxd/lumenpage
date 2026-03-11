import type { Editor } from "./Editor";

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
  addSchema?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addSchema"];
  }) => SchemaSpec | null;
  addGlobalAttributes?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addGlobalAttributes"];
  }) => GlobalAttributes;
  addLayout?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addLayout"];
  }) => LayoutHooks | null;
  addCanvas?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addCanvas"];
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
  addProseMirrorPlugins?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addProseMirrorPlugins"];
  }) => any[];
  addStateTransforms?: (this: ExtensionContext<Options, Storage> & {
    parent: ParentConfig<Config>["addStateTransforms"];
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

export type ExtensionInstance = {
  name: string;
  type: ExtensionType;
  priority: number;
  options: any;
  storage: any;
  extension: AnyExtension;
};

export type ResolvedState = {
  proseMirrorPlugins: any[];
  keyboardShortcuts: Record<string, any>[];
  inputRules: any[];
  commands: Record<string, any>;
  stateTransforms: Array<(state: any) => any>;
};

export type ResolvedStructure = {
  instances: ExtensionInstance[];
  schema: {
    nodes: Record<string, any>;
    marks: Record<string, any>;
  };
  layout: {
    byNodeName: Map<string, LayoutHooks>;
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
