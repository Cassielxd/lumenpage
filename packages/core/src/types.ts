export type LumenExtensionKind = "extension" | "node" | "mark";

export type LumenSchemaSpec = {
  nodes?: Record<string, any>;
  marks?: Record<string, any>;
};

export type LumenPaginationPolicy = {
  fragmentModel?: "none" | "continuation";
  reusePolicy?: "actual-slice-only" | "always-sensitive" | "token-based";
};

export type LumenLayoutHooks = {
  renderer?: any;
  pagination?: LumenPaginationPolicy;
};

export type LumenCanvasSelectionGeometry = {
  shouldComputeSelectionRects?: (ctx: any) => boolean;
  shouldRenderBorderOnly?: (ctx: any) => boolean;
};

export type LumenCanvasHooks = {
  nodeViews?: Record<string, any>;
  selectionGeometries?: LumenCanvasSelectionGeometry[];
  nodeSelectionTypes?: string[];
  decorationProviders?: any[];
  hitTestPolicies?: any[];
};

export type LumenExtensionContext<Options = any, Storage = any> = {
  name: string;
  options: Options;
  storage: Storage;
  editor: any | null;
  manager: any | null;
};

export type LumenExtensionConfig<Options = any, Storage = any> = {
  name: string;
  kind?: LumenExtensionKind;
  priority?: number;
  addOptions?: () => Options;
  addStorage?: (ctx: LumenExtensionContext<Options, Storage>) => Storage;
  addSchema?: (ctx: LumenExtensionContext<Options, Storage>) => LumenSchemaSpec | null;
  addLayout?: (ctx: LumenExtensionContext<Options, Storage>) => LumenLayoutHooks | null;
  addCanvas?: (ctx: LumenExtensionContext<Options, Storage>) => LumenCanvasHooks | null;
  addPlugins?: (ctx: LumenExtensionContext<Options, Storage>) => any[];
  addShortcuts?: (ctx: LumenExtensionContext<Options, Storage>) => Record<string, any>;
  addInputRules?: (ctx: LumenExtensionContext<Options, Storage>) => any[];
  addCommands?: (ctx: LumenExtensionContext<Options, Storage>) => Record<string, any>;
  addStateTransforms?: (ctx: LumenExtensionContext<Options, Storage>) => Array<(state: any) => any> | ((state: any) => any) | null;
};

export type LumenExtensionInstance = {
  name: string;
  kind: LumenExtensionKind;
  priority: number;
  options: any;
  storage: any;
  config: LumenExtensionConfig<any, any>;
};

export type LumenExtensionLike = {
  config: LumenExtensionConfig<any, any>;
};

export type LumenExtensionInput = LumenExtensionLike | ReadonlyArray<LumenExtensionInput>;

export type LumenResolvedState = {
  plugins: any[];
  shortcuts: Record<string, any>[];
  inputRules: any[];
  commands: Record<string, any>;
  stateTransforms: Array<(state: any) => any>;
};

export type LumenResolvedStructure = {
  instances: LumenExtensionInstance[];
  schema: {
    nodes: Record<string, any>;
    marks: Record<string, any>;
  };
  layout: {
    byNodeName: Map<string, LumenLayoutHooks>;
  };
  canvas: {
    nodeViews: Record<string, any>;
    selectionGeometries: LumenCanvasSelectionGeometry[];
    nodeSelectionTypes: string[];
    decorationProviders: any[];
    hitTestPolicies: any[];
  };
};

export type LumenResolvedExtensions = LumenResolvedStructure & {
  state: LumenResolvedState;
};
