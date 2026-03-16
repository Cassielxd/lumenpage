export { Editor } from "./Editor";
export type { EditorOptions } from "./Editor";
export { CommandManager } from "./CommandManager";
export { createChainableState } from "./createChainableState";
export { createDocument } from "./createDocument";
export { EventEmitter } from "./EventEmitter";
export { Extension } from "./Extension";
export { ExtensionManager } from "./ExtensionManager";
export { Mark } from "./Mark";
export { Node } from "./Node";
export {
  PasteRule,
  pasteRulesPlugin,
  type ExtendedRegExpMatchArray,
  type PasteRuleFinder,
  type PasteRuleMatch,
  type Range,
} from "./PasteRule";
export { markPasteRule, nodePasteRule, textPasteRule } from "./pasteRules";
export { createSchema } from "./createSchema";
export {
  attachExtensionPaginationDocWorker,
  type PaginationDocWorkerRequest,
  type PaginationDocWorkerResponse,
} from "./paginationWorker";
export {
  PaginationDocWorkerClient,
  type PaginationDocWorkerClientRequest,
} from "./paginationWorkerClient";

export type {
  AttributeConfig,
  AttributeConfigs,
  AnyExtension,
  AnyExtensionInput,
  CanvasHooks,
  CanvasSelectionGeometry,
  DispatchTransactionProps,
  EnableRules,
  EditorBaseEvent,
  EditorBeforeTransactionEvent,
  EditorDropEvent,
  EditorEvents,
  EditorFocusEvent,
  EditorPasteEvent,
  EditorTransactionEvent,
  ExtensionConfig,
  ExtensionContext,
  ExtensionInstance,
  ExtensionLike,
  ExtensionType,
  Extensions,
  GlobalAttribute,
  GlobalAttributes,
  HTMLAttributes,
  LayoutHooks,
  MarkAdapter,
  MarkAdapterContextLike,
  MarkAdapterMap,
  MarkAnnotationLike,
  MarkAnnotationResolver,
  MarkAnnotationResolverMap,
  MarkConfig,
  NodeConfig,
  PaginationPolicy,
  ResolvedExtensions,
  ResolvedState,
  ResolvedStructure,
  SchemaSpec,
} from "./types";
