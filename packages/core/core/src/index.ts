export { Editor } from "./Editor.js";
export type { EditorOptions } from "./Editor.js";
export { CommandManager } from "./CommandManager.js";
export {
  EDITOR_SHORTCUTS,
  formatShortcutLabel,
  getPrimaryShortcutBinding,
  getShortcutDisplayLabel,
  type EditorShortcutBinding,
} from "./keyboardShortcuts.js";
export * as commands from "./commands/index.js";
export * as extensions from "./extensions/index.js";
export * as helpers from "./helpers/index.js";
export * as utilities from "./utilities/index.js";
export * from "./commands/index.js";
export { BeforeInput, Commands, FocusEvents, Keymap, basicCommands, focusEventsPluginKey } from "./extensions/index.js";
export { Drop, Paste, dropPluginKey, pastePluginKey } from "./extensions/index.js";
export { EventEmitter } from "./EventEmitter.js";
export { Extension } from "./Extension.js";
export { ExtensionManager } from "./ExtensionManager.js";
export * from "./helpers/index.js";
export { Mark } from "./Mark.js";
export { Node } from "./Node.js";
export {
  PasteRule,
  pasteRulesPlugin,
  type ExtendedRegExpMatchArray,
  type PasteRuleFinder,
  type PasteRuleMatch,
  type Range,
} from "./PasteRule.js";
export { markPasteRule, nodePasteRule, textPasteRule } from "./pasteRules/index.js";
export { createSchema } from "./createSchema.js";
export * from "./utilities/index.js";
export {
  attachExtensionPaginationDocWorker,
  type PaginationDocWorkerRequest,
  type PaginationDocWorkerResponse,
} from "./paginationWorker.js";
export {
  PaginationDocWorkerClient,
  type PaginationDocWorkerClientRequest,
} from "./paginationWorkerClient.js";

export interface Commands<ReturnType = boolean> {}

export type {
  AttributeConfig,
  AttributeConfigs,
  AnyCommand,
  AnyExtension,
  AnyExtensionInput,
  CanCommands,
  CanvasHooks,
  CanvasSelectionGeometry,
  ChainedCommands,
  CommandDispatch,
  CommandMap,
  CommandNameInvoker,
  CommandProps,
  DispatchTransactionProps,
  EditorCommand,
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
  FocusPosition,
  GlobalAttribute,
  GlobalAttributes,
  HTMLAttributes,
  LayoutHooks,
  LegacyCommand,
  MarkAdapter,
  MarkAdapterContextLike,
  MarkAdapterMap,
  NormalizeCommandMethod,
  NormalizeCommandMethods,
  MarkAnnotationLike,
  MarkAnnotationResolver,
  MarkAnnotationResolverMap,
  MarkConfig,
  NodeConfig,
  PaginationPolicy,
  ResolvedExtensions,
  ResolvedCommand,
  ResolvedState,
  ResolvedStructure,
  SchemaSpec,
  SingleCommands,
} from "./types.js";

