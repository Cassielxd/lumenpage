import { inputRules } from "lumenpage-inputrules";
import { keymap } from "lumenpage-keymap";
import { createNodeRegistry } from "lumenpage-layout-engine";
import { EditorState, Selection } from "lumenpage-state";
import {
  CanvasEditorView,
  type CanvasCommands,
  type CanvasEditorViewProps,
} from "lumenpage-view-canvas";

import { CommandManager } from "./CommandManager";
import { createDocument } from "./createDocument";
import { EventEmitter } from "./EventEmitter";
import { createSchema } from "./createSchema";
import { ExtensionManager } from "./ExtensionManager";
import { pasteRulesPlugin } from "./PasteRule";
import { collectNodeSelectionTypes, createSelectionGeometry } from "./selectionGeometry";
import type {
  AnyExtensionInput,
  EnableRules,
  EditorBaseEvent,
  EditorBeforeTransactionEvent,
  EditorDropEvent,
  EditorEvents,
  EditorFocusEvent,
  EditorPasteEvent,
  EditorTransactionEvent,
  ResolvedExtensions,
  ResolvedStructure,
} from "./types";

type CreateStateOptions = {
  content?: any;
  plugins?: any[];
};

// 这组命令会同步暴露给 CanvasEditorView 的基础命令运行时。
// 它们对应的是编辑器最底层、最常用的一批编辑动作：
// 删除、左右合并、回车拆块、撤销/重做等。
// 这里不直接暴露所有 rawCommands，而是先筛出一组稳定的基础能力，
// 这样 view 层可以在不理解完整扩展命令集的情况下运行核心编辑流程。
const BASIC_COMMAND_KEYS = [
  "deleteSelection",
  "joinBackward",
  "selectNodeBackward",
  "joinForward",
  "selectNodeForward",
  "splitBlock",
  "enter",
  "undo",
  "redo",
] as const;

export type EditorOptions = {
  // 扩展体系是 Editor 的主入口。schema、commands、plugins、renderer 语义
  // 最终都会从这里汇总出来。
  extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput;
  // 如果传 element，构造时会自动 mount；否则只创建逻辑 Editor，不创建 view。
  element?: HTMLElement | null;
  // 唯一内容入口。允许 JSON / PM Node / HTML 字符串，具体由 createDocument 解析。
  content?: any;
  // editorProps 是唯一的 view 层配置入口。
  // 这点刻意对齐 tiptap：Editor 顶层不再继续暴露 state/plugins/canvas 之类的分叉配置。
  editorProps?: Partial<CanvasEditorViewProps>;
  enableInputRules?: EnableRules;
  enablePasteRules?: EnableRules;
  autofocus?: boolean | "start" | "end" | number;
  editable?: boolean;
  onBeforeCreate?: ((args: EditorBaseEvent) => void) | null;
  onMount?: ((args: EditorBaseEvent) => void) | null;
  onUnmount?: ((args: EditorBaseEvent) => void) | null;
  onCreate?: ((args: EditorBaseEvent) => void) | null;
  onBeforeTransaction?: ((args: EditorBeforeTransactionEvent) => void) | null;
  onUpdate?: ((args: EditorTransactionEvent) => void) | null;
  onSelectionUpdate?: ((args: EditorTransactionEvent) => void) | null;
  onTransaction?: ((args: EditorTransactionEvent) => void) | null;
  onFocus?: ((args: EditorFocusEvent) => void) | null;
  onBlur?: ((args: EditorFocusEvent) => void) | null;
  onPaste?: ((args: EditorPasteEvent) => void) | null;
  onDrop?: ((args: EditorDropEvent) => void) | null;
  onDestroy?: ((args: EditorBaseEvent) => void) | null;
};

// 默认配置尽量保持“最小但可用”：
// - 默认空内容
// - 默认可编辑
// - 默认打开 input/paste rules
// - 所有事件回调默认为 null，避免构造阶段做多余函数包装
const defaultOptions: EditorOptions = {
  extensions: [],
  element: null,
  content: "",
  editorProps: {},
  enableInputRules: true,
  enablePasteRules: true,
  autofocus: false,
  editable: true,
  onBeforeCreate: null,
  onMount: null,
  onUnmount: null,
  onCreate: null,
  onBeforeTransaction: null,
  onUpdate: null,
  onSelectionUpdate: null,
  onTransaction: null,
  onFocus: null,
  onBlur: null,
  onPaste: null,
  onDrop: null,
  onDestroy: null,
};

// 只有在扩展实际提供了 node/mark spec 时，才创建 schema。
// 这样可以支持“纯扩展能力但不声明 schema”的轻量场景。
const hasSchemaSpec = (resolved: ResolvedStructure) =>
  Object.keys(resolved.schema.nodes).length > 0 || Object.keys(resolved.schema.marks).length > 0;

// keyboard shortcuts 最终会转成 state plugin。
// 这里保持和 inputRules/pasteRules 一致：都先从扩展里收集，再统一注入到 state。
const createShortcutPlugins = (resolved: ResolvedExtensions) =>
  resolved.state.keyboardShortcuts
    .filter((shortcuts) => shortcuts && Object.keys(shortcuts).length > 0)
    .map((shortcuts) => keymap(shortcuts));

// inputRules 只有在扩展实际返回规则时才创建 plugin，避免空插件进入 state。
const createInputRulePlugins = (resolved: ResolvedExtensions) => {
  const rules = resolved.state.inputRules.filter(Boolean);
  return rules.length ? [inputRules({ rules })] : [];
};

// pasteRules 依赖 editor 实例本身，因为规则执行时可能要访问 commands、storage 等运行时能力。
const createPasteRulePlugins = (editor: Editor, resolved: ResolvedExtensions) => {
  const rules = resolved.state.pasteRules.filter(Boolean);
  return rules.length ? pasteRulesPlugin({ editor, rules }) : [];
};

// Editor 是整个公开 API 的中心：
// - 上接扩展系统（schema / commands / events）
// - 下接 CanvasEditorView（view / dispatch / render）
// - 本身不直接做 canvas 渲染，只负责组装和事件编排
export class Editor extends EventEmitter<EditorEvents> {
  options: EditorOptions;
  readonly extensionManager: ExtensionManager;
  readonly schema: ReturnType<typeof createSchema> | null;
  readonly nodeRegistry: any | null;
  readonly selectionGeometry: any;
  readonly nodeSelectionTypes: string[];
  readonly resolvedExtensions: ResolvedExtensions;
  readonly extensionStorage: Record<string, any>;
  readonly rawCommands: Record<string, any>;
  readonly plugins: any[];

  state: any | null;
  view: CanvasEditorView | null;
  isFocused: boolean;
  isCapturingTransaction: boolean;

  private readonly commandManager: CommandManager;
  private customDispatchTransaction: ((transaction: any) => void) | null;
  private capturedTransaction: any | null;

  constructor(options: Partial<EditorOptions> = {}) {
    super();

    // 1. 先合并配置，确定扩展集合。
    this.options = { ...defaultOptions, ...options };
    this.extensionManager = new ExtensionManager(this.options.extensions, this);

    // 2. 解析结构层：schema / layout / canvas 相关静态信息。
    const structure = this.extensionManager.resolveStructure(this);
    this.schema = hasSchemaSpec(structure) ? createSchema(structure) : null;
    this.nodeRegistry = this.schema ? createNodeRegistry(structure) : null;
    this.extensionManager.setRuntime({ schema: this.schema, nodeRegistry: this.nodeRegistry });

    // 3. 解析 selection / nodeSelection 这类 view 运行时辅助能力。
    this.selectionGeometry = createSelectionGeometry(structure);
    this.nodeSelectionTypes = collectNodeSelectionTypes(structure);

    // 4. 解析状态层：plugins / rules / commands / state extenders。
    const state = this.extensionManager.resolveState(structure, this);
    this.resolvedExtensions = {
      ...structure,
      state,
    };

    // 5. 缓存扩展存储和命令表，后续 commands/chain/can 都直接复用。
    this.extensionStorage = Object.fromEntries(
      this.resolvedExtensions.instances.map((instance) => [instance.name, instance.storage])
    );
    this.rawCommands = this.resolvedExtensions.state.commands;
    this.plugins = this.buildPlugins();
    this.state = this.initializeState();
    this.view = null;
    this.isFocused = false;
    this.isCapturingTransaction = false;
    this.customDispatchTransaction = null;
    this.capturedTransaction = null;
    this.commandManager = new CommandManager(this, this.rawCommands);

    // 6. 先绑定 EditorOptions 级事件，再绑定扩展级事件。
    // 这样对外回调和扩展回调最终都通过同一条 EventEmitter 链路触发。
    this.bindOptionEvents();
    this.extensionManager.bindEditorEvents(this);

    // 7. create 之前先发 beforeCreate。
    this.emit("beforeCreate", { editor: this });

    // 8. 如果传入 element，则构造阶段直接创建 view。
    if (this.options.element) {
      this.mount(this.options.element);
    }

    // 9. 构造完成后发 create。
    this.emit("create", { editor: this });
  }

  // storage 对齐 tiptap：统一暴露所有扩展 storage。
  get storage() {
    return this.extensionStorage;
  }

  // commands 是命令 facade，直接返回可调用对象。
  get commands() {
    return this.commandManager.commands;
  }

  // chain() 返回链式命令接口。
  chain() {
    return this.commandManager.chain();
  }

  // can() 返回“只判断不派发”的命令接口。
  can() {
    return this.commandManager.can();
  }

  // 是否可编辑最终取决于 EditorOptions.editable 和 view 当前 editable 状态。
  get isEditable() {
    return this.options.editable !== false && !!this.view?.editable;
  }

  // focus 只是把焦点委托给 view，本身不直接改 state。
  focus() {
    this.view?.focus();
    return this;
  }

  // captureTransaction 对齐 tiptap：
  // 在一段同步逻辑里临时收集事务，不立刻向下分发。
  // 常用于“我要知道这一串命令最后合成了什么事务”，而不是立刻提交。
  captureTransaction(fn: () => void) {
    this.isCapturingTransaction = true;
    fn();
    this.isCapturingTransaction = false;

    const transaction = this.capturedTransaction;
    this.capturedTransaction = null;

    return transaction;
  }

  // setOptions 只负责更新运行时配置。
  // 如果 view 已存在，需要立即同步到 view props。
  // 这里尤其要重新生成 dispatchTransaction，因为 editorProps.dispatchTransaction
  // 可能被动态替换。
  setOptions(options: Partial<EditorOptions> = {}) {
    this.options = {
      ...this.options,
      ...options,
    };
    if (this.view) {
      const editorProps = this.options.editorProps || {};
      this.view.setProps({
        ...editorProps,
        dispatchTransaction: this.createViewDispatchTransaction(editorProps),
        editable: this.options.editable,
      });
    }
  }

  // setEditable 本质上是 setOptions 的语义包装。
  // emitUpdate = true 时，会主动发一次 update，方便外部状态同步。
  setEditable(editable: boolean, emitUpdate = true) {
    this.setOptions({ editable });
    if (emitUpdate) {
      const transaction = this.view?.state?.tr || this.state?.tr;
      if (transaction) {
        this.emit("update", {
          editor: this,
          transaction,
          state: this.view?.state || this.state,
          appendedTransactions: [],
        });
      }
    }
  }

  // createState 只做两件事：
  // 1. 用当前 schema + content 创建 EditorState
  // 2. 让扩展的 state extenders 继续加工这个初始 state
  createState(overrides: CreateStateOptions = {}) {
    if (!this.schema) {
      throw new Error("Cannot create editor state without a resolved schema.");
    }

    const doc = createDocument({
      content: overrides.content ?? this.options.content,
      schema: this.schema,
    });

    return this.applyStateTransforms(
      EditorState.create({
        schema: this.schema,
        doc,
        selection: Selection.atEnd(doc),
        plugins: overrides.plugins ?? this.plugins,
      })
    );
  }

  // mount 是公开入口，负责保证 state 已准备好，并避免重复创建 view。
  mount(element: HTMLElement) {
    if (!element) {
      throw new Error("Editor mount element is required.");
    }
    if (!this.state) {
      this.state = this.initializeState();
    }
    if (!this.state) {
      throw new Error("Editor state is not available. Pass state or content.");
    }
    if (this.view) {
      return this.view;
    }

    return this.createView(element);
  }

  // createView 是真正的 view 组装入口，对齐 tiptap 的 createView 语义。
  // 核心职责是：
  // - 组装最终 dispatchTransaction 链
  // - 组装 transform / clipboard / DOM events 等 view props
  // - 创建 CanvasEditorView
  // - 将 Editor 事件桥接到 view 事件流上
  private createView(element: HTMLElement) {
    const editorProps = this.options.editorProps || {};
    const dispatchTransaction = this.createViewDispatchTransaction(editorProps);

    // 这些 baseXxx 都是“用户直接传进 editorProps 的原始 handler/transform”。
    // 后续会和扩展系统返回的 transform 链合并。
    const baseOnChange = typeof editorProps.onChange === "function" ? editorProps.onChange : null;
    const baseHandleDOMEvents = editorProps.handleDOMEvents || {};
    const baseHandlePaste =
      typeof editorProps.handlePaste === "function" ? editorProps.handlePaste : null;
    const baseHandleDrop =
      typeof editorProps.handleDrop === "function" ? editorProps.handleDrop : null;
    const baseTransformCopied =
      typeof editorProps.transformCopied === "function"
        ? (slice: any, view?: any) => editorProps.transformCopied?.(view, slice) ?? slice
        : undefined;
    const transformCopied = this.extensionManager.transformCopied(baseTransformCopied);
    const baseTransformCopiedHTML =
      typeof editorProps.transformCopiedHTML === "function"
        ? (html: string, slice?: any, view?: any) =>
            editorProps.transformCopiedHTML?.(view, html, slice) ?? html
        : undefined;
    const transformCopiedHTML = this.extensionManager.transformCopiedHTML(baseTransformCopiedHTML);
    const baseClipboardTextSerializer =
      typeof editorProps.clipboardTextSerializer === "function"
        ? (slice: any, view?: any) => editorProps.clipboardTextSerializer?.(view, slice) ?? null
        : undefined;
    const clipboardTextSerializer = this.extensionManager.clipboardTextSerializer(
      baseClipboardTextSerializer
    );
    const baseClipboardTextParser =
      typeof editorProps.clipboardTextParser === "function"
        ? (text: string, context?: any, plain?: boolean, view?: any) =>
            editorProps.clipboardTextParser?.(view, text, context, plain) ?? null
        : undefined;
    const clipboardTextParser = this.extensionManager.clipboardTextParser(baseClipboardTextParser);
    const clipboardParser = this.extensionManager.clipboardParser(editorProps.clipboardParser ?? null);
    const clipboardSerializer = this.extensionManager.clipboardSerializer(
      editorProps.clipboardSerializer ?? null
    );
    const baseTransformPasted =
      typeof editorProps.transformPasted === "function"
        ? (slice: any, view?: any) => editorProps.transformPasted?.(view, slice) ?? slice
        : undefined;
    const transformPasted = this.extensionManager.transformPasted(baseTransformPasted);
    const baseTransformPastedText =
      typeof editorProps.transformPastedText === "function"
        ? (text: string, plain: boolean, view?: any) =>
            editorProps.transformPastedText?.(view, text, plain) ?? text
        : undefined;
    const transformPastedText = this.extensionManager.transformPastedText(baseTransformPastedText);
    const baseTransformPastedHTML =
      typeof editorProps.transformPastedHTML === "function"
        ? (html: string, view?: any) => editorProps.transformPastedHTML?.(view, html) ?? html
        : undefined;
    const transformPastedHTML = this.extensionManager.transformPastedHTML(baseTransformPastedHTML);
    const resolvedCanvasViewConfig = {
      ...(editorProps.canvasViewConfig || {}),
      // nodeRegistry 是 render/layout 主链的根输入。
      // 如果用户没有显式覆盖，默认走扩展系统解析出的 registry。
      nodeRegistry: editorProps.canvasViewConfig?.nodeRegistry || this.nodeRegistry,
    };

    const viewProps: CanvasEditorViewProps = {
      ...editorProps,
      state: this.state,
      editable: this.options.editable,
      canvasViewConfig: resolvedCanvasViewConfig,
      dispatchTransaction,
      commands: this.createResolvedCommands(editorProps.commands || null),
      onChange: (view, event) => {
        // onChange 是 CanvasEditorView 基础状态流应用完成后的回调。
        // 当前 Editor 的 transaction / selectionUpdate / update 事件
        // 都通过这条链从 view 侧回流上来。
        const oldState = event?.oldState ?? this.state;
        const nextState = event?.state ?? view?.state ?? oldState;
        this.state = nextState ?? this.state;
        baseOnChange?.(view, event);

        const transaction = event?.transaction;
        if (!transaction) {
          return;
        }

        const payload = {
          editor: this,
          transaction,
          state: nextState,
          oldState,
          appendedTransactions: event?.appendedTransactions || [],
        };

        this.emit("transaction", payload);

        if (event?.selectionChanged === true) {
          this.emit("selectionUpdate", payload);
        }

        // focus / blur 已经不再直接依赖 DOM 事件本身发射。
        // 现在改成 tiptap 风格：由带 meta 的 transaction 驱动，
        // 这样 focus/blur 和事务链保持一致，外部也能拿到对应 transaction。
        const transactions = [transaction, ...(event?.appendedTransactions || [])].filter(Boolean);
        const focusTransaction = [...transactions].reverse().find((tr: any) => {
          return tr?.getMeta?.("focus") || tr?.getMeta?.("blur");
        });
        const focusMeta = focusTransaction?.getMeta?.("focus");
        const blurMeta = focusTransaction?.getMeta?.("blur");

        if (focusMeta) {
          this.emit("focus", { editor: this, event: focusMeta.event, transaction: focusTransaction, view });
        }

        if (blurMeta) {
          this.emit("blur", { editor: this, event: blurMeta.event, transaction: focusTransaction, view });
        }

        if (event?.docChanged) {
          this.emit("update", payload);
        }
      },
      handleDOMEvents: {
        ...baseHandleDOMEvents,
        focus: (view, event) => {
          const handled = baseHandleDOMEvents.focus?.(view, event) === true;
          if (!this.isFocused) {
            this.isFocused = true;
            // 不直接在这里 emit("focus")，而是发一个带 meta 的事务，
            // 再由 onChange 统一解释为 Editor 事件。
            const transaction = view?.state?.tr
              ?.setMeta("focus", { event })
              ?.setMeta("addToHistory", false);
            if (transaction) {
              view.dispatch(transaction);
            }
          }
          return handled;
        },
        blur: (view, event) => {
          const handled = baseHandleDOMEvents.blur?.(view, event) === true;
          if (this.isFocused) {
            this.isFocused = false;
            // blur 同理，保持和 focus 完全一致的事务语义。
            const transaction = view?.state?.tr
              ?.setMeta("blur", { event })
              ?.setMeta("addToHistory", false);
            if (transaction) {
              view.dispatch(transaction);
            }
          }
          return handled;
        },
      },
      selectionGeometry: editorProps.selectionGeometry || this.selectionGeometry || undefined,
      nodeSelectionTypes:
        editorProps.nodeSelectionTypes || (this.nodeSelectionTypes.length ? this.nodeSelectionTypes : undefined),
      transformCopied: (view, slice) => transformCopied(slice, view),
      transformCopiedHTML: (view, html, slice) => transformCopiedHTML(html, slice, view),
      transformPasted: (view, slice) => transformPasted(slice, view),
      transformPastedText: (view, text, plain) => transformPastedText(text, plain, view),
      transformPastedHTML: (view, html) => transformPastedHTML(html, view),
      clipboardTextSerializer: (view, slice) => clipboardTextSerializer(slice, view),
      clipboardTextParser: (view, text, context, plain) =>
        clipboardTextParser(text, context, plain, view),
      clipboardParser,
      clipboardSerializer,
      handlePaste: (view, event, slice) => {
        // paste/drop 仍然是“先尊重用户 editorProps handler，再统一发 Editor 事件”。
        const handled = baseHandlePaste?.(view, event, slice) === true;
        this.emit("paste", { editor: this, event, slice, view });
        return handled;
      },
      handleDrop: (view, event, slice, moved) => {
        const handled = baseHandleDrop?.(view, event, slice, moved) === true;
        this.emit("drop", { editor: this, event, slice, moved, view });
        return handled;
      },
    };

    this.view = new CanvasEditorView(element, viewProps);
    this.emit("mount", { editor: this });
    return this.view;
  }

  // createViewDispatchTransaction 对齐 tiptap createView 里的 dispatch 组装逻辑。
  // 组合顺序是：
  // 1. 先拿到用户 editorProps.dispatchTransaction 作为 base dispatch
  // 2. 再让扩展通过 dispatchTransaction({ transaction, next }) 包裹它
  // 3. 最终把这条链传给 CanvasEditorView
  private createViewDispatchTransaction(editorProps: Partial<CanvasEditorViewProps>) {
    this.customDispatchTransaction =
      typeof editorProps.dispatchTransaction === "function" ? editorProps.dispatchTransaction : null;

    return this.extensionManager.dispatchTransaction(this.dispatchTransaction.bind(this));
  }

  // 这是 Editor 内部私有 dispatch 主链。
  // 注意：它不是公开 API。
  // 它的职责是：
  // - 处理 captureTransaction 模式
  // - 发 beforeTransaction
  // - 决定最终走用户 base dispatch，还是走 view 的基础 state apply
  private dispatchTransaction(transaction: any) {
    if (!transaction) {
      return;
    }

    // captureTransaction 模式下，不立即向下分发，只累积事务。
    if (this.isCapturingTransaction) {
      if (!this.capturedTransaction) {
        this.capturedTransaction = transaction;
        return;
      }

      transaction.steps?.forEach?.((step: any) => this.capturedTransaction?.step?.(step));
      return;
    }

    // 如果用户提供了 editorProps.dispatchTransaction，就把它当成 base dispatch。
    if (this.customDispatchTransaction) {
      this.customDispatchTransaction(transaction);
      return;
    }

    // 在真正应用事务前，先算出 nextState 并发 beforeTransaction。
    const currentState = this.view?.state ?? this.state;
    if (currentState && typeof currentState.applyTransaction === "function") {
      const applied = currentState.applyTransaction(transaction);
      this.emit("beforeTransaction", {
        editor: this,
        transaction,
        nextState: applied?.state ?? currentState,
      });
    }

    // 最终真正落到 CanvasEditorView 的基础事务应用链。
    const baseDispatch = this.view?._internals?.dispatchTransactionBase;
    if (typeof baseDispatch !== "function") {
      throw new Error("Editor view dispatch pipeline is not initialized.");
    }

    baseDispatch(transaction);
  }

  // unmount 只销毁 view，不销毁 Editor 本身。
  unmount() {
    if (!this.view) {
      return;
    }
    this.view?.destroy();
    this.view = null;
    this.emit("unmount", { editor: this });
  }

  // destroy 终止整个 Editor 生命周期，并清空事件监听器。
  destroy() {
    this.unmount();
    this.emit("destroy", { editor: this });
    this.removeAllListeners();
  }

  // buildPlugins 统一拼接 state plugin：
  // 扩展 plugins + keyboard shortcuts + input rules + paste rules
  private buildPlugins() {
    return [
      ...this.resolvedExtensions.state.plugins,
      ...createShortcutPlugins(this.resolvedExtensions),
      ...createInputRulePlugins(this.resolvedExtensions),
      ...createPasteRulePlugins(this, this.resolvedExtensions),
    ];
  }

  // initializeState 只在 schema 存在时创建默认 state。
  // 没有 schema 时允许 Editor 处于“逻辑已构造、state 尚不可用”的状态。
  private initializeState() {
    if (!this.schema) {
      return null;
    }

    return this.createState();
  }

  // 扩展允许对初始 state 做二次加工，比如注入定制 plugin state。
  private applyStateTransforms(state: any) {
    return this.resolvedExtensions.state.stateExtenders.reduce((currentState, transform) => {
      const nextState = transform(currentState);
      return nextState ?? currentState;
    }, state);
  }

  // view 层只依赖一小组稳定命令，所以这里要把 rawCommands 收敛成 CanvasCommands。
  // 如果用户通过 editorProps.commands 传了覆盖项，按字段合并。
  private createResolvedCommands(override: CanvasCommands | null) {
    const base = this.createDefaultCommands();
    if (!override) {
      return base;
    }
    return {
      ...base,
      ...override,
      basicCommands: {
        ...(base.basicCommands || {}),
        ...(override.basicCommands || {}),
      },
      viewCommands: {
        ...(base.viewCommands || {}),
        ...(override.viewCommands || {}),
      },
    };
  }

  // 默认命令集是 rawCommands 的一个受控子集。
  // 这样 view 层可以运行基本编辑动作，但不会和扩展命令表强耦合。
  private createDefaultCommands(): CanvasCommands {
    const basicCommands = Object.fromEntries(
      BASIC_COMMAND_KEYS.map((key) => [key, this.rawCommands[key]]).filter(([, value]) => typeof value === "function")
    );
    return {
      basicCommands,
      viewCommands: this.rawCommands,
    };
  }

  // 把 EditorOptions 里的事件回调统一挂到 EventEmitter。
  // 之后无论事件来自 DOM、事务链还是扩展系统，最终都会走同一条事件总线。
  private bindOptionEvents() {
    const events: Array<[keyof EditorEvents, ((payload: any) => void) | null | undefined]> = [
      ["mount", this.options.onMount],
      ["unmount", this.options.onUnmount],
      ["beforeCreate", this.options.onBeforeCreate],
      ["create", this.options.onCreate],
      ["beforeTransaction", this.options.onBeforeTransaction],
      ["update", this.options.onUpdate],
      ["selectionUpdate", this.options.onSelectionUpdate],
      ["transaction", this.options.onTransaction],
      ["focus", this.options.onFocus],
      ["blur", this.options.onBlur],
      ["paste", this.options.onPaste],
      ["drop", this.options.onDrop],
      ["destroy", this.options.onDestroy],
    ];

    for (const [event, listener] of events) {
      if (typeof listener === "function") {
        this.on(event, listener);
      }
    }
  }
}
