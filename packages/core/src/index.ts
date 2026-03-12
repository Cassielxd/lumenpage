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

export type {
  AttributeConfig,
  AttributeConfigs,
  AnyExtension,
  AnyExtensionInput,
  CanvasHooks,
  CanvasSelectionGeometry,
  EnableRules,
  EditorBaseEvent,
  EditorEvents,
  EditorFocusEvent,
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
  MarkConfig,
  NodeConfig,
  PaginationPolicy,
  ResolvedExtensions,
  ResolvedState,
  ResolvedStructure,
  SchemaSpec,
} from "./types";
