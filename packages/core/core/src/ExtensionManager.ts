import type { Schema, Slice } from "lumenpage-model";
import type { NodeRendererRegistry } from "lumenpage-layout-engine";
import type { Transaction } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import type { Editor } from "./Editor";
import { bindExtensionEditorEvents } from "./helpers/bindExtensionEditorEvents";
import { createClipboardTextParser } from "./helpers/createClipboardTextParser";
import { createClipboardTextSerializer } from "./helpers/createClipboardTextSerializer";
import { createCopiedHtmlTransformPipeline } from "./helpers/createCopiedHtmlTransformPipeline";
import { createExtensionContext, type ExtensionContextRuntime } from "./helpers/createExtensionContext";
import { createExtensionInstances } from "./helpers/createExtensionInstances";
import { createDispatchTransactionPipeline } from "./helpers/createDispatchTransactionPipeline";
import { createHtmlTransformPipeline } from "./helpers/createHtmlTransformPipeline";
import { createSliceTransformPipeline } from "./helpers/createSliceTransformPipeline";
import { createTextTransformPipeline } from "./helpers/createTextTransformPipeline";
import { getPluginsByResolvedExtensions } from "./helpers/getPluginsByResolvedExtensions";
import { resolveClipboardParser } from "./helpers/resolveClipboardParser";
import { resolveClipboardSerializer } from "./helpers/resolveClipboardSerializer";
import { resolveExtensions } from "./helpers/resolveExtensions";
import { resolveExtensionOptions } from "./helpers/resolveExtensionOptions";
import { resolveExtensionStorage } from "./helpers/resolveExtensionStorage";
import { resolveGlobalAttributes as resolveGlobalAttributesByExtensionInstances } from "./helpers/resolveGlobalAttributes";
import { resolveStateByExtensionInstances } from "./helpers/resolveStateByExtensionInstances";
import { resolveStructureByExtensionInstances } from "./helpers/resolveStructureByExtensionInstances";
import { resolveExtensionSchema } from "./schemaFields";
import type {
  AnyExtension,
  AnyExtensionInput,
  ClipboardParserLike,
  ClipboardSerializerLike,
  ClipboardTextParser,
  ClipboardTextSerializer,
  EditorPlugin,
  ExtensionContext,
  ExtensionInstance,
  ResolvedExtensions,
  ResolvedState,
  ResolvedStructure,
} from "./types";


export class ExtensionManager {
  readonly extensions: AnyExtension[];

  editor: Editor | null;
  schema: Schema | null;
  nodeRegistry: NodeRendererRegistry | null;
  private boundEditor: Editor | null;

  constructor(extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput, editor: Editor | null = null) {
    this.editor = editor;
    this.schema = null;
    this.nodeRegistry = null;
    this.boundEditor = null;
    this.extensions = resolveExtensions({
      input: extensions,
      getContext: (extension) => this.createDetachedContext(extension),
    });
  }

  setRuntime({ schema, nodeRegistry }: { schema?: Schema | null; nodeRegistry?: NodeRendererRegistry | null }) {
    this.schema = schema ?? null;
    this.nodeRegistry = nodeRegistry ?? null;
  }

  get plugins(): EditorPlugin[] {
    const editor = this.editor;

    if (!editor) {
      return [];
    }

    const resolved = editor.resolvedExtensions ?? this.resolve(editor);
    return getPluginsByResolvedExtensions({
      editor,
      resolved,
    });
  }

  resolveStructure(editor: Editor | null = this.editor): ResolvedStructure {
    const instances = this.createInstances(editor);
    const structure = resolveStructureByExtensionInstances({
      instances,
      getContext: (instance) => this.createContext(instance, editor),
      resolveDirectSchema: (instance, ctx) => resolveExtensionSchema(instance, ctx),
      resolveGlobalAttributes: (resolvedInstances) =>
        resolveGlobalAttributesByExtensionInstances({
          instances: resolvedInstances,
          runtime: this.createRuntime(editor),
        }),
    });

    return {
      instances,
      ...structure,
    };
  }

  resolveState(input: ResolvedStructure | ExtensionInstance[], editor: Editor | null = this.editor): ResolvedState {
    const instances = Array.isArray(input) ? input : input.instances;
    return resolveStateByExtensionInstances({
      instances,
      getContext: (instance) => this.createContext(instance, editor),
      enableInputRules: this.editor?.options?.enableInputRules,
      enablePasteRules: this.editor?.options?.enablePasteRules,
    });
  }

  resolve(editor: Editor | null = this.editor): ResolvedExtensions {
    const structure = this.resolveStructure(editor);
    const state = this.resolveState(structure, editor);
    return {
      ...structure,
      state,
    };
  }

  dispatchTransaction(baseDispatch: (transaction: Transaction) => void) {
    return createDispatchTransactionPipeline({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      baseDispatch,
    });
  }

  transformPastedHTML(baseTransform?: (html: string, view?: CanvasEditorView | null) => string) {
    return createHtmlTransformPipeline({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      field: "transformPastedHTML",
      baseTransform,
    });
  }

  transformPastedText(baseTransform?: (text: string, plain: boolean, view?: CanvasEditorView | null) => string) {
    return createTextTransformPipeline({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      field: "transformPastedText",
      baseTransform,
    });
  }

  transformPasted(baseTransform?: (slice: Slice, view?: CanvasEditorView | null) => Slice) {
    return createSliceTransformPipeline({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      field: "transformPasted",
      baseTransform,
    });
  }

  transformCopied(baseTransform?: (slice: Slice, view?: CanvasEditorView | null) => Slice) {
    return createSliceTransformPipeline({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      field: "transformCopied",
      baseTransform,
    });
  }

  transformCopiedHTML(baseTransform?: (html: string, slice?: Slice, view?: CanvasEditorView | null) => string) {
    return createCopiedHtmlTransformPipeline({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      baseTransform,
    });
  }

  clipboardTextSerializer(baseSerializer?: ClipboardTextSerializer) {
    return createClipboardTextSerializer({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      baseSerializer,
    });
  }

  clipboardTextParser(baseParser?: ClipboardTextParser) {
    return createClipboardTextParser({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      baseParser,
    });
  }

  clipboardParser(baseParser?: ClipboardParserLike | null) {
    return resolveClipboardParser({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      baseParser,
    });
  }

  clipboardSerializer(baseSerializer?: ClipboardSerializerLike | null) {
    return resolveClipboardSerializer({
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
      baseSerializer,
    });
  }

  bindEditorEvents(editor: Editor | null = this.editor) {
    if (!editor || this.boundEditor === editor) {
      return;
    }

    this.boundEditor = editor;
    bindExtensionEditorEvents({
      editor,
      extensions: this.extensions,
      getContext: (extension) => this.createDetachedContext(extension),
    });
  }

  private createInstances(editor: Editor | null = this.editor) {
    return createExtensionInstances({
      extensions: this.extensions,
      runtime: this.createRuntime(editor),
    });
  }

  private resolveOptions(extension: AnyExtension) {
    return resolveExtensionOptions(extension);
  }

  private resolveStorage(extension: AnyExtension, options: Record<string, unknown>, editor: Editor | null) {
    return resolveExtensionStorage({
      extension,
      options,
      runtime: this.createRuntime(editor),
    });
  }

  private createDetachedContext(extension: AnyExtension): ExtensionContext {
    const options = this.resolveOptions(extension);
    const storage = this.resolveStorage(extension, options, this.editor);

    return createExtensionContext({
      name: extension.name,
      options,
      storage,
      runtime: this.createRuntime(this.editor),
    });
  }

  private createContext(instance: ExtensionInstance, editor: Editor | null = this.editor): ExtensionContext {
    return createExtensionContext({
      name: instance.name,
      options: instance.options,
      storage: instance.storage,
      runtime: this.createRuntime(editor),
    });
  }

  private createRuntime(editor: Editor | null = this.editor): ExtensionContextRuntime {
    return {
      editor,
      manager: this,
      schema: this.schema,
      nodeRegistry: this.nodeRegistry,
    };
  }
}
