import { Extension, type Editor } from "lumenpage-core";
import { Fragment } from "lumenpage-model";

export type AiAssistantIntent = "rewrite" | "summarize" | "continue" | "custom";
export type AiAssistantSource = "auto" | "selection" | "block" | "document";
export type AiAssistantApplyMode = "auto" | "none" | "replace" | "insert";

export interface AiAssistantSelectionSnapshot {
  from: number;
  to: number;
}

export interface AiAssistantCommandRequest {
  intent?: AiAssistantIntent;
  instruction?: string;
  source?: AiAssistantSource;
  applyMode?: AiAssistantApplyMode;
  selectionSnapshot?: AiAssistantSelectionSnapshot | null;
}

export interface AiAssistantRequestContext {
  editor: Editor;
  intent: AiAssistantIntent;
  instruction: string;
  source: AiAssistantSource;
  text: string;
  documentText: string;
  selection: {
    from: number;
    to: number;
    empty: boolean;
  };
}

export type AiAssistantProviderResult =
  | string
  | {
      text?: string | null;
    };

export type AiAssistantProvider = (
  request: AiAssistantRequestContext
) => Promise<AiAssistantProviderResult> | AiAssistantProviderResult;

export interface AiAssistantStateSnapshot {
  status: "idle" | "running" | "success" | "error";
  requestId: number;
  activeIntent: AiAssistantIntent | null;
  activeInstruction: string;
  lastResult: string;
  error: string | null;
}

export type AiAssistantRunSuccess = {
  ok: true;
  requestId: number;
  intent: AiAssistantIntent;
  source: AiAssistantSource;
  contextText: string;
  outputText: string;
  applied: boolean;
  state: AiAssistantStateSnapshot;
};

export type AiAssistantRunFailureReason =
  | "busy"
  | "missing-editor"
  | "missing-provider"
  | "empty-context"
  | "cancelled"
  | "failed";

export type AiAssistantRunFailure = {
  ok: false;
  reason: AiAssistantRunFailureReason;
  message: string;
  state: AiAssistantStateSnapshot;
};

export type AiAssistantRunResult = AiAssistantRunSuccess | AiAssistantRunFailure;

export interface AiAssistantApplyRequest {
  outputText: string;
  source?: AiAssistantSource;
  applyMode?: Exclude<AiAssistantApplyMode, "none">;
  selectionSnapshot?: AiAssistantSelectionSnapshot | null;
}

export interface AiAssistantStorage {
  state: AiAssistantStateSnapshot;
  activeRequestId: number;
  run: (request?: AiAssistantCommandRequest) => Promise<AiAssistantRunResult>;
  applyOutput: (request: AiAssistantApplyRequest) => boolean;
  cancel: () => void;
  isBusy: () => boolean;
}

export interface AiAssistantOptions {
  provider?: AiAssistantProvider | null;
  onStateChange?: ((state: AiAssistantStateSnapshot) => void) | null;
}

type AiAssistantResolvedRequest = AiAssistantRequestContext & {
  target: {
    mode: "replace" | "insert";
    from: number;
    to: number;
  };
};

type AiAssistantCommandMethods<ReturnType> = {
  aiAssist: (request?: AiAssistantCommandRequest) => ReturnType;
  aiRewriteSelection: (instruction?: string) => ReturnType;
  aiSummarizeSelection: (instruction?: string) => ReturnType;
  aiContinueWriting: (instruction?: string) => ReturnType;
  cancelAiAssist: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    aiAssistant: AiAssistantCommandMethods<ReturnType>;
  }
}

const DEFAULT_STATE: AiAssistantStateSnapshot = {
  status: "idle",
  requestId: 0,
  activeIntent: null,
  activeInstruction: "",
  lastResult: "",
  error: null,
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

const callStateChange = (options: AiAssistantOptions, state: AiAssistantStateSnapshot) => {
  options.onStateChange?.({
    ...state,
  });
};

const setStorageState = (
  storage: AiAssistantStorage,
  options: AiAssistantOptions,
  patch: Partial<AiAssistantStateSnapshot>
) => {
  storage.state = {
    ...storage.state,
    ...patch,
  };
  callStateChange(options, storage.state);
  return storage.state;
};

const createStorageFailure = (
  storage: AiAssistantStorage,
  reason: AiAssistantRunFailureReason,
  message: string
): AiAssistantRunFailure => ({
  ok: false,
  reason,
  message,
  state: storage.state,
});

const readDocumentText = (state: any) => {
  if (!state?.doc?.textBetween || !Number.isFinite(state?.doc?.content?.size)) {
    return "";
  }
  return normalizeText(state.doc.textBetween(0, state.doc.content.size, "\n\n", "\n"));
};

const readSelectionText = (state: any, from: number, to: number) => {
  if (!state?.doc?.textBetween || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return "";
  }
  return normalizeText(state.doc.textBetween(from, to, "\n\n", "\n"));
};

const clampDocPos = (doc: any, value: number) => {
  const size = Number(doc?.content?.size);
  if (!Number.isFinite(size)) {
    return 0;
  }
  const pos = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.max(0, Math.min(size, pos));
};

const resolveSelectionRange = (state: any, snapshot?: AiAssistantSelectionSnapshot | null) => {
  const activeSelection = state?.selection;
  const rawFrom = snapshot?.from ?? activeSelection?.from;
  const rawTo = snapshot?.to ?? activeSelection?.to;
  const from = clampDocPos(state?.doc, Number(rawFrom));
  const to = clampDocPos(state?.doc, Number(rawTo));

  return {
    from,
    to,
    empty: to <= from,
  };
};

const resolveAssistantRequest = (
  editor: Editor,
  request: AiAssistantCommandRequest = {}
): AiAssistantResolvedRequest | null => {
  const state = editor.view?.state || editor.state;
  if (!state?.doc || !state?.selection) {
    return null;
  }

  const selection = resolveSelectionRange(state, request.selectionSnapshot);
  const selectionFrom = selection.from;
  const selectionTo = selection.to;
  const selectionText = readSelectionText(state, selectionFrom, selectionTo);
  const resolvedFrom =
    typeof state.doc.resolve === "function"
      ? state.doc.resolve(selectionFrom)
      : (state.selection?.$from ?? null);
  const blockText = normalizeText(resolvedFrom?.parent?.textContent);
  const documentText = readDocumentText(state);
  const intent = request.intent || "custom";
  const instruction = normalizeText(request.instruction);
  const requestedSource = request.source || "auto";
  let source = requestedSource;
  let text = "";
  let targetFrom = selectionFrom;
  let targetTo = selectionTo;
  const targetMode = intent === "continue" ? "insert" : "replace";

  if (requestedSource === "auto") {
    if (selectionText) {
      source = "selection";
      text = selectionText;
    } else if (blockText) {
      source = "block";
      text = blockText;
      targetFrom = clampDocPos(state.doc, Number(resolvedFrom?.start?.() ?? selectionFrom));
      targetTo = clampDocPos(state.doc, Number(resolvedFrom?.end?.() ?? selectionTo));
    } else if (documentText) {
      source = "document";
      text = documentText;
    }
  } else if (requestedSource === "selection") {
    source = "selection";
    text = selectionText;
  } else if (requestedSource === "block") {
    source = "block";
    text = blockText;
    targetFrom = clampDocPos(state.doc, Number(resolvedFrom?.start?.() ?? selectionFrom));
    targetTo = clampDocPos(state.doc, Number(resolvedFrom?.end?.() ?? selectionTo));
  } else if (requestedSource === "document") {
    source = "document";
    text = documentText;
  }

  text = normalizeText(text);
  if (!text) {
    return null;
  }

  return {
    editor,
    intent,
    instruction,
    source,
    text,
    documentText,
    selection: {
      from: selectionFrom,
      to: selectionTo,
      empty: selection.empty,
    },
    target: {
      mode: targetMode,
      from: targetFrom,
      to: targetTo,
    },
  };
};

const buildParagraphContent = (schema: any, text: string) => {
  const paragraphType = schema?.nodes?.paragraph;
  if (!paragraphType || typeof schema?.text !== "function") {
    return null;
  }

  const blocks = normalizeText(text)
    .split(/\n{2,}/)
    .map((item) => item.replace(/\n+/g, " ").trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return null;
  }

  const nodes = blocks
    .map((item) => {
      const content = [schema.text(item)];
      return paragraphType.createAndFill?.(null, content) ?? paragraphType.create?.(null, content) ?? null;
    })
    .filter(Boolean);

  if (nodes.length === 0) {
    return null;
  }

  return nodes.length === 1 ? nodes[0] : Fragment.fromArray(nodes);
};

const shouldInsertLeadingSpace = (state: any, pos: number, nextText: string) => {
  if (!state?.doc?.textBetween || pos <= 0) {
    return false;
  }
  const previous = String(state.doc.textBetween(Math.max(0, pos - 1), pos, "", "") || "");
  if (!previous || /\s/.test(previous)) {
    return false;
  }
  const nextChar = String(nextText || "").charAt(0);
  if (!nextChar || /[.,!?;:)\]}]/.test(nextChar)) {
    return false;
  }
  return /[A-Za-z0-9]/.test(previous) && /[A-Za-z0-9]/.test(nextChar);
};

const dispatchEditorTransaction = (editor: Editor, state: any, tr: any) => {
  if (editor.view?.dispatch) {
    editor.view.dispatch(tr);
    return true;
  }
  if (!editor.state) {
    return false;
  }
  editor.state = state.apply?.(tr) ?? editor.state;
  return true;
};

const applyAssistantResult = (
  editor: Editor,
  resolved: AiAssistantResolvedRequest,
  outputText: string,
  applyMode: Exclude<AiAssistantApplyMode, "none"> = "auto"
) => {
  const state = editor.view?.state || editor.state;
  const normalizedOutput = normalizeText(outputText);
  const mode = applyMode === "auto" ? resolved.target.mode : applyMode;

  if (!state?.tr || !state?.schema || !normalizedOutput) {
    return false;
  }

  if (mode === "insert") {
    const insertPos = clampDocPos(state.doc, resolved.target.to);
    const nextText = shouldInsertLeadingSpace(state, insertPos, normalizedOutput)
      ? ` ${normalizedOutput}`
      : normalizedOutput;
    return dispatchEditorTransaction(editor, state, state.tr.insertText(nextText, insertPos, insertPos).scrollIntoView());
  }

  const from = clampDocPos(state.doc, resolved.target.from);
  const to = clampDocPos(state.doc, resolved.target.to);

  if (normalizedOutput.includes("\n\n") || resolved.source === "block" || resolved.source === "document") {
    const content = buildParagraphContent(state.schema, normalizedOutput);
    if (!content) {
      return false;
    }
    return dispatchEditorTransaction(editor, state, state.tr.replaceWith(from, to, content).scrollIntoView());
  }

  return dispatchEditorTransaction(
    editor,
    state,
    state.tr.insertText(normalizedOutput.replace(/\n+/g, " "), from, to).scrollIntoView()
  );
};

const normalizeProviderOutput = (value: AiAssistantProviderResult) => {
  if (typeof value === "string") {
    return normalizeText(value);
  }
  return normalizeText(value?.text);
};

const createDemoSentenceParts = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .split(/[\n.!?]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const ensureSentenceEnding = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return normalized;
  }
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const summarizeDemoText = (text: string) => {
  const parts = createDemoSentenceParts(text).slice(0, 3);
  if (parts.length === 0) {
    return "Select text to summarize first.";
  }
  return ensureSentenceEnding(`Key points: ${parts.join("; ")}`);
};

const rewriteDemoText = (text: string, instruction: string) => {
  const base = createDemoSentenceParts(text).join(". ");
  if (!base) {
    return "Select text to rewrite first.";
  }
  if (!instruction) {
    return ensureSentenceEnding(base);
  }
  return ensureSentenceEnding(`${base} This version also follows: ${instruction}`);
};

const continueDemoText = (text: string) => {
  const base = ensureSentenceEnding(text);
  return `${base} Next, clarify the goal, constraints, and expected outcome.`;
};

const customDemoText = (text: string, instruction: string) => {
  const normalizedInstruction = instruction.toLowerCase();

  if (normalizedInstruction.includes("summary") || normalizedInstruction.includes("summarize")) {
    return summarizeDemoText(text);
  }

  if (normalizedInstruction.includes("continue") || normalizedInstruction.includes("expand")) {
    return continueDemoText(text);
  }

  if (normalizedInstruction.includes("title")) {
    const head = normalizeText(createDemoSentenceParts(text)[0] || text).slice(0, 36);
    return head || "Untitled";
  }

  return rewriteDemoText(text, instruction);
};

export interface DemoAiAssistantProviderOptions {
  latency?: number;
  locale?: "zh-CN" | "en-US";
}

export const createDemoAiAssistantProvider = (options: DemoAiAssistantProviderOptions = {}) => {
  const latency = Number.isFinite(options.latency) ? Math.max(0, Math.trunc(Number(options.latency))) : 240;

  return async (request: AiAssistantRequestContext) => {
    if (latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, latency));
    }

    if (request.intent === "summarize") {
      return summarizeDemoText(request.text);
    }

    if (request.intent === "continue") {
      return continueDemoText(request.text);
    }

    if (request.intent === "rewrite") {
      return rewriteDemoText(request.text, request.instruction);
    }

    return customDemoText(request.text, request.instruction);
  };
};

const createInitialStorage = (): AiAssistantStorage => ({
  state: { ...DEFAULT_STATE },
  activeRequestId: 0,
  run: async () => ({
    ok: false,
    reason: "missing-editor",
    message: "AI assistant is not ready.",
    state: { ...DEFAULT_STATE },
  }),
  applyOutput: () => false,
  cancel: () => undefined,
  isBusy() {
    return this.activeRequestId > 0;
  },
});

const runAssistantRequest = async (
  editor: Editor | null,
  storage: AiAssistantStorage,
  options: AiAssistantOptions,
  request: AiAssistantCommandRequest = {}
): Promise<AiAssistantRunResult> => {
  if (!editor) {
    return createStorageFailure(storage, "missing-editor", "Editor is not ready.");
  }

  if (storage.activeRequestId > 0) {
    return createStorageFailure(storage, "busy", "AI assistant is already running.");
  }

  if (typeof options.provider !== "function") {
    setStorageState(storage, options, {
      status: "error",
      error: "AI provider is not configured.",
    });
    return createStorageFailure(storage, "missing-provider", "AI provider is not configured.");
  }

  const resolved = resolveAssistantRequest(editor, request);
  if (!resolved) {
    setStorageState(storage, options, {
      status: "error",
      error: "No editor text is available for AI processing.",
    });
    return createStorageFailure(storage, "empty-context", "No editor text is available for AI processing.");
  }

  const requestId = storage.state.requestId + 1;
  storage.activeRequestId = requestId;
  setStorageState(storage, options, {
    status: "running",
    requestId,
    activeIntent: resolved.intent,
    activeInstruction: resolved.instruction,
    error: null,
  });

  try {
    const output = normalizeProviderOutput(await options.provider(resolved));

    if (storage.activeRequestId !== requestId) {
      return createStorageFailure(storage, "cancelled", "AI request was cancelled.");
    }

    if (!output) {
      setStorageState(storage, options, {
        status: "error",
        error: "AI provider returned an empty result.",
      });
      return createStorageFailure(storage, "failed", "AI provider returned an empty result.");
    }

    const applyMode = request.applyMode ?? "auto";
    const applied = applyMode === "none" ? false : applyAssistantResult(editor, resolved, output, applyMode);
    const state = setStorageState(storage, options, {
      status: "success",
      lastResult: output,
      error: null,
      activeIntent: null,
      activeInstruction: "",
    });

    return {
      ok: true,
      requestId,
      intent: resolved.intent,
      source: resolved.source,
      contextText: resolved.text,
      outputText: output,
      applied,
      state,
    };
  } catch (error) {
    if (storage.activeRequestId !== requestId) {
      return createStorageFailure(storage, "cancelled", "AI request was cancelled.");
    }

    const message = error instanceof Error ? error.message : "AI provider failed.";
    setStorageState(storage, options, {
      status: "error",
      error: message,
      activeIntent: null,
      activeInstruction: "",
    });
    return createStorageFailure(storage, "failed", message);
  } finally {
    if (storage.activeRequestId === requestId) {
      storage.activeRequestId = 0;
    }
  }
};

export const AiAssistant = Extension.create<AiAssistantOptions, AiAssistantStorage>({
  name: "aiAssistant",
  priority: 175,
  addOptions() {
    return {
      provider: null,
      onStateChange: null,
    };
  },
  addStorage() {
    return createInitialStorage();
  },
  onCreate() {
    this.storage.run = (request = {}) => runAssistantRequest(this.editor, this.storage, this.options, request);
    this.storage.applyOutput = (request) => {
      if (!this.editor) {
        return false;
      }

      const resolved = resolveAssistantRequest(this.editor, {
        source: request.source || "auto",
        selectionSnapshot: request.selectionSnapshot,
      });

      if (!resolved) {
        return false;
      }

      return applyAssistantResult(this.editor, resolved, request.outputText, request.applyMode || "auto");
    };
    this.storage.cancel = () => {
      this.storage.activeRequestId = 0;
      setStorageState(this.storage, this.options, {
        status: "idle",
        activeIntent: null,
        activeInstruction: "",
        error: null,
      });
    };
    callStateChange(this.options, this.storage.state);
  },
  onDestroy() {
    this.storage.cancel();
  },
  addCommands() {
    return {
      aiAssist:
        (request: AiAssistantCommandRequest = {}) =>
        () => {
          void this.storage.run(request);
          return true;
        },
      aiRewriteSelection:
        (instruction = "") =>
        () => {
          void this.storage.run({
            intent: "rewrite",
            instruction,
            source: "selection",
          });
          return true;
        },
      aiSummarizeSelection:
        (instruction = "") =>
        () => {
          void this.storage.run({
            intent: "summarize",
            instruction,
            source: "selection",
          });
          return true;
        },
      aiContinueWriting:
        (instruction = "") =>
        () => {
          void this.storage.run({
            intent: "continue",
            instruction,
            source: "auto",
          });
          return true;
        },
      cancelAiAssist:
        () =>
        () => {
          this.storage.cancel();
          return true;
        },
    };
  },
});

export const getAiAssistantStorage = (editor: Editor | null | undefined) => {
  const storage = editor?.storage?.aiAssistant as unknown as AiAssistantStorage | undefined;
  if (!storage || typeof storage.run !== "function") {
    return null;
  }
  return storage;
};

export default AiAssistant;

