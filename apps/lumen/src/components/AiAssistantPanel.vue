<template>
  <aside class="doc-ai-assistant">
    <div class="doc-ai-assistant-header">
      <div class="doc-ai-assistant-heading">
        <span class="doc-ai-assistant-title">{{ texts.title }}</span>
        <span class="doc-ai-assistant-summary">{{ summaryLabel }}</span>
      </div>
      <button type="button" class="doc-ai-assistant-close" @click="$emit('close')">x</button>
    </div>

    <div class="doc-ai-assistant-toolbar">
      <t-tag size="small" variant="light" :theme="canManage ? 'success' : 'default'">
        {{ canManage ? texts.ready : texts.readonly }}
      </t-tag>
      <span class="doc-ai-assistant-build">{{ buildLabel }}</span>
      <t-button size="small" variant="outline" @click="settingsOpen = !settingsOpen">
        {{ settingsOpen ? texts.hideSettings : texts.showSettings }}
      </t-button>
    </div>

    <div v-if="settingsOpen" class="doc-ai-assistant-settings">
      <div class="doc-ai-assistant-field">
        <span class="doc-ai-assistant-label">{{ texts.provider }}</span>
        <t-select
          :model-value="providerConfig.providerId"
          :options="providerOptions"
          @update:model-value="handleProviderChange"
        />
      </div>

      <div class="doc-ai-assistant-field">
        <span class="doc-ai-assistant-label">{{ texts.model }}</span>
        <t-input
          :model-value="providerConfig.modelId"
          :placeholder="texts.modelPlaceholder"
          @update:model-value="handleModelChange"
        />
      </div>

      <template v-if="providerConfig.providerId === 'deepseek-official'">
        <div class="doc-ai-assistant-field">
          <span class="doc-ai-assistant-label">{{ texts.serverUrl }}</span>
          <t-input
            :model-value="providerConfig.serverUrl"
            :placeholder="texts.serverUrlPlaceholder"
            @update:model-value="handleServerUrlChange"
          />
        </div>

        <div class="doc-ai-assistant-field">
          <span class="doc-ai-assistant-label">{{ texts.systemPrompt }}</span>
          <t-textarea
            :model-value="providerConfig.systemPrompt"
            :placeholder="texts.systemPromptPlaceholder"
            :autosize="{ minRows: 3, maxRows: 6 }"
            @update:model-value="handleSystemPromptChange"
          />
        </div>

        <p class="doc-ai-assistant-provider-tip">{{ texts.providerTip }}</p>
      </template>
    </div>

    <div class="doc-ai-assistant-presets">
      <t-button size="small" variant="outline" :disabled="presetDisabled" @click="handlePreset('rewrite')">
        {{ texts.rewrite }}
      </t-button>
      <t-button size="small" variant="outline" :disabled="presetDisabled" @click="handlePreset('summarize')">
        {{ texts.summarize }}
      </t-button>
      <t-button size="small" variant="outline" :disabled="presetDisabled" @click="handlePreset('continue')">
        {{ texts.continueWriting }}
      </t-button>
    </div>

    <p class="doc-ai-assistant-hint">{{ composerHint }}</p>
    <p class="doc-ai-assistant-selection-status">{{ selectionStatusLabel }}</p>

    <div class="doc-ai-assistant-context">
      <div class="doc-ai-assistant-context-header">
        <span class="doc-ai-assistant-context-title">{{ texts.contextPreviewTitle }}</span>
        <t-tag v-if="selectionPreviewText" size="small" variant="light" theme="primary">
          {{ texts.contextPreviewSelection }}
        </t-tag>
      </div>
      <pre v-if="selectionPreviewText" class="doc-ai-assistant-context-content">{{ selectionPreviewText }}</pre>
      <p v-else class="doc-ai-assistant-context-empty">{{ texts.contextPreviewEmpty }}</p>
    </div>

    <div class="doc-ai-assistant-chat">
      <ChatList
        :data="messages"
        layout="both"
        animation="gradient"
        :auto-scroll="true"
        default-scroll-to="bottom"
        :clear-history="false"
        :show-scroll-button="true"
      />
    </div>

    <div v-if="latestGeneratedOutput" class="doc-ai-assistant-result-actions">
      <span class="doc-ai-assistant-result-meta">{{ latestResultHint }}</span>
      <div class="doc-ai-assistant-result-buttons">
        <t-button size="small" variant="outline" :disabled="replaceDisabled" @click="handleApplyLatest('replace')">
          {{ texts.replaceSelection }}
        </t-button>
        <t-button size="small" variant="outline" :disabled="insertDisabled" @click="handleApplyLatest('insert')">
          {{ texts.insertAfter }}
        </t-button>
        <t-button size="small" variant="outline" :disabled="copyDisabled" @click="handleCopyLatest">
          {{ texts.copyResult }}
        </t-button>
      </div>
    </div>

    <div class="doc-ai-assistant-composer">
      <t-textarea
        class="doc-ai-assistant-composer-input"
        :model-value="draft"
        :disabled="!canManage || !assistantStorage || running"
        :placeholder="texts.placeholder"
        :autosize="{ minRows: 3, maxRows: 6 }"
        @update:model-value="handleDraftChange"
        @keydown="handleComposerKeydown"
      />

      <div class="doc-ai-assistant-composer-footer">
        <span class="doc-ai-assistant-composer-meta">{{ texts.sendHint }}</span>
        <div class="doc-ai-assistant-composer-actions">
          <t-button v-if="running" size="small" variant="outline" @click="handleStop">
            {{ texts.stop }}
          </t-button>
          <t-button size="small" theme="primary" :disabled="sendDisabled" @click="handleSend">
            {{ texts.send }}
          </t-button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChatList } from "@tdesign-vue-next/chat";
import {
  getAiAssistantStorage,
  type AiAssistantIntent,
  type AiAssistantSelectionSnapshot,
} from "lumenpage-extension-ai";
import type { Editor as LumenEditor } from "lumenpage-core";
import {
  abortLumenAiProviderRequest,
  lumenAiProviderConfig,
  updateLumenAiProviderConfig,
  type LumenAiProviderId,
} from "../editor/aiAssistantProviders";

type AiAssistantMessage = {
  id: string;
  role: "assistant" | "user";
  name: string;
  datetime: string;
  content: Array<{
    type: "text";
    data: string;
  }>;
  status?: "pending" | "error";
};

type LatestGeneratedOutput = {
  outputText: string;
  selectionSnapshot: AiAssistantSelectionSnapshot | null;
};

type AiPanelTexts = {
  title: string;
  ready: string;
  readonly: string;
  showSettings: string;
  hideSettings: string;
  provider: string;
  model: string;
  serverUrl: string;
  systemPrompt: string;
  modelPlaceholder: string;
  serverUrlPlaceholder: string;
  systemPromptPlaceholder: string;
  providerTip: string;
  rewrite: string;
  summarize: string;
  continueWriting: string;
  placeholder: string;
  sendHint: string;
  send: string;
  stop: string;
  assistantName: string;
  userName: string;
  requestLabel: string;
  sourceLabel: string;
  sentContextLabel: string;
  welcome: string;
  missingEditor: string;
  missingPlugin: string;
  missingProviderConfig: string;
  emptyContext: string;
  cancelled: string;
  generating: string;
  turns: string;
  composerHint: string;
  selectionReady: string;
  selectionFallback: string;
  contextPreviewTitle: string;
  contextPreviewSelection: string;
  contextPreviewEmpty: string;
  latestSelectionActions: string;
  latestFallbackActions: string;
  demoProvider: string;
  deepSeekOfficialProvider: string;
  replaceSelection: string;
  insertAfter: string;
  copyResult: string;
  applyFailed: string;
  replaceApplied: string;
  insertApplied: string;
  copySucceeded: string;
  copyFailed: string;
  sourceSelection: string;
  sourceBlock: string;
  sourceDocument: string;
  sourceAuto: string;
};

const AI_PANEL_I18N: Record<"zh-CN" | "en-US", AiPanelTexts> = {
  "zh-CN": {
    title: "AI 助手",
    ready: "可用",
    readonly: "只读",
    showSettings: "显示设置",
    hideSettings: "隐藏设置",
    provider: "供应商",
    model: "模型",
    serverUrl: "AI 服务",
    systemPrompt: "系统提示词",
    modelPlaceholder: "例如 deepseek-chat 或你的部署模型 ID",
    serverUrlPlaceholder: "http://127.0.0.1:1234",
    systemPromptPlaceholder: "可选，不填则使用内置写作提示词。",
    providerTip: "浏览器先请求本地 collab-server，再由服务端调用官方 DeepSeek Chat Completions API。",
    rewrite: "改写",
    summarize: "总结",
    continueWriting: "续写",
    placeholder: "描述你希望 AI 如何处理当前内容",
    sendHint: "Ctrl/Cmd + Enter 发送",
    send: "发送",
    stop: "停止",
    assistantName: "Lumen AI",
    userName: "你",
    requestLabel: "请求",
    sourceLabel: "来源",
    sentContextLabel: "发送内容",
    welcome: "先在编辑器中选中内容，再让 AI 改写、总结或续写。生成结果会先留在面板里，由你决定如何插入文档。",
    missingEditor: "编辑器尚未就绪。",
    missingPlugin: "当前编辑器实例未挂载 AI 扩展。",
    missingProviderConfig: "当前 AI 供应商配置还不完整。",
    emptyContext: "当前没有可供 AI 处理的内容。请先选中一段文字，或将光标放入一个段落。",
    cancelled: "当前 AI 任务已取消。",
    generating: "生成中",
    turns: "轮",
    composerHint: "发送时会优先使用已捕获的选区；如果没有选区，再回退到当前块。",
    selectionReady: "已捕获最近一次有效选区。",
    selectionFallback: "当前没有已捕获选区，必要时会回退到当前块。",
    contextPreviewTitle: "当前上下文",
    contextPreviewSelection: "已选内容",
    contextPreviewEmpty: "暂未捕获选区。先在编辑器里选中一段内容，这里会立即显示。",
    latestSelectionActions: "结果已生成。你可以替换已捕获选区、插入到其后，或先复制。",
    latestFallbackActions: "结果已生成。你可以插入到文档，或先复制。",
    demoProvider: "本地演示",
    deepSeekOfficialProvider: "官方 DeepSeek",
    replaceSelection: "替换选区",
    insertAfter: "插入其后",
    copyResult: "复制",
    applyFailed: "生成结果未能写入文档。",
    replaceApplied: "已用生成结果替换选区。",
    insertApplied: "已将生成结果插入文档。",
    copySucceeded: "已复制生成结果。",
    copyFailed: "复制失败，请手动复制。",
    sourceSelection: "选区",
    sourceBlock: "当前块",
    sourceDocument: "整篇文档",
    sourceAuto: "自动",
  },
  "en-US": {
    title: "AI Assistant",
    ready: "Ready",
    readonly: "Read-only",
    showSettings: "Show Settings",
    hideSettings: "Hide Settings",
    provider: "Provider",
    model: "Model",
    serverUrl: "AI Server",
    systemPrompt: "System Prompt",
    modelPlaceholder: "Use deepseek-chat or your deployed model id",
    serverUrlPlaceholder: "http://127.0.0.1:1234",
    systemPromptPlaceholder: "Optional. Leave empty to use the built-in writing prompt.",
    providerTip: "The browser calls your local collab-server, and the server calls the official DeepSeek Chat Completions API.",
    rewrite: "Rewrite",
    summarize: "Summarize",
    continueWriting: "Continue",
    placeholder: "Describe what you want AI to do with the current content",
    sendHint: "Ctrl/Cmd + Enter to send",
    send: "Send",
    stop: "Stop",
    assistantName: "Lumen AI",
    userName: "You",
    requestLabel: "Request",
    sourceLabel: "Source",
    sentContextLabel: "Sent Content",
    welcome: "Select text in the editor, then ask me to rewrite, summarize, or continue writing. The result will stay in this panel until you choose how to apply it.",
    missingEditor: "Editor is not ready yet.",
    missingPlugin: "AI extension is not available in the current editor instance.",
    missingProviderConfig: "The current AI provider is not fully configured yet.",
    emptyContext: "No content is available for AI processing yet. Select some text first, or place the caret inside a paragraph.",
    cancelled: "The current AI task was cancelled.",
    generating: "Generating",
    turns: "turns",
    composerHint: "The assistant uses the last captured selection first, then falls back to the current block when needed.",
    selectionReady: "The latest valid selection has been captured.",
    selectionFallback: "No captured selection yet. The assistant will fall back to the current block when needed.",
    contextPreviewTitle: "Current Context",
    contextPreviewSelection: "Selected Content",
    contextPreviewEmpty: "No selection has been captured yet. Select some text in the editor and it will appear here immediately.",
    latestSelectionActions: "The result is ready. You can replace the captured selection, insert after it, or copy it first.",
    latestFallbackActions: "The result is ready. You can insert it into the document, or copy it first.",
    demoProvider: "Local Demo",
    deepSeekOfficialProvider: "Official DeepSeek",
    replaceSelection: "Replace Selection",
    insertAfter: "Insert After",
    copyResult: "Copy",
    applyFailed: "The generated result could not be applied to the document.",
    replaceApplied: "The generated result replaced the selection.",
    insertApplied: "The generated result was inserted into the document.",
    copySucceeded: "The generated result was copied to the clipboard.",
    copyFailed: "Copy failed. Please copy the result manually.",
    sourceSelection: "Selection",
    sourceBlock: "Current Block",
    sourceDocument: "Whole Document",
    sourceAuto: "Auto",
  },
};

const props = defineProps<{
  locale: "zh-CN" | "en-US";
  editor: LumenEditor | null;
  canManage: boolean;
}>();

defineEmits<{
  (event: "close"): void;
}>();

const draft = ref("");
const running = ref(false);
const settingsOpen = ref(true);
const messages = ref<AiAssistantMessage[]>([]);
const activeLoadingIndex = ref<number | null>(null);
const lastSelectionSnapshot = ref<AiAssistantSelectionSnapshot | null>(null);
const latestGeneratedOutput = ref<LatestGeneratedOutput | null>(null);
let messageSeed = 0;

const providerConfig = lumenAiProviderConfig;
const buildLabel = "ai-panel-debug-20260331-04";
const texts = computed(() => AI_PANEL_I18N[props.locale] || AI_PANEL_I18N["en-US"]);

const assistantStorage = computed(() => getAiAssistantStorage(props.editor));
const providerOptions = computed(() => [
  {
    label: texts.value.deepSeekOfficialProvider,
    value: "deepseek-official",
  },
  {
    label: texts.value.demoProvider,
    value: "demo",
  },
]);
const providerConfigReady = computed(() => {
  if (providerConfig.providerId === "demo") {
    return true;
  }
  return providerConfig.modelId.trim().length > 0;
});
const canRunAssistant = computed(
  () => !running.value && props.canManage && !!assistantStorage.value && providerConfigReady.value
);
const presetDisabled = computed(() => !canRunAssistant.value);
const sendDisabled = computed(() => !canRunAssistant.value || !draft.value.trim());
const canApplyLatest = computed(
  () => !running.value && props.canManage && !!assistantStorage.value && !!latestGeneratedOutput.value
);
const replaceDisabled = computed(
  () => !canApplyLatest.value || !latestGeneratedOutput.value?.selectionSnapshot
);
const insertDisabled = computed(() => !canApplyLatest.value);
const copyDisabled = computed(() => !latestGeneratedOutput.value);
const summaryLabel = computed(() => {
  if (running.value) {
    return texts.value.generating;
  }
  const turns = messages.value.filter((item) => item.role === "user").length;
  return `${turns} ${texts.value.turns}`;
});
const composerHint = computed(() => {
  if (!providerConfigReady.value) {
    return texts.value.missingProviderConfig;
  }
  return texts.value.composerHint;
});
const selectionStatusLabel = computed(() =>
  lastSelectionSnapshot.value ? texts.value.selectionReady : texts.value.selectionFallback
);
const latestResultHint = computed(() =>
  latestGeneratedOutput.value?.selectionSnapshot
    ? texts.value.latestSelectionActions
    : texts.value.latestFallbackActions
);

const formatNow = () =>
  new Intl.DateTimeFormat(props.locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const createTextContent = (value: string) => [
  {
    type: "text" as const,
    data: String(value || ""),
  },
];

const createMessage = ({
  role,
  name,
  content,
  status,
}: {
  role: "assistant" | "user";
  name: string;
  content: string;
  status?: "pending" | "error";
}): AiAssistantMessage => ({
  id: `ai-message-${messageSeed++}`,
  role,
  name,
  datetime: formatNow(),
  content: status === "pending" ? [] : createTextContent(content),
  ...(status ? { status } : {}),
});

const pushMessage = (message: AiAssistantMessage) => {
  messages.value = [...messages.value, message];
  return messages.value.length - 1;
};

const replaceMessage = (index: number, message: AiAssistantMessage) => {
  if (index < 0 || index >= messages.value.length) {
    return;
  }
  const next = messages.value.slice();
  next.splice(index, 1, message);
  messages.value = next;
};

const pushAssistantNotice = (content: string, status?: "error") => {
  pushMessage(
    createMessage({
      role: "assistant",
      name: texts.value.assistantName,
      content,
      ...(status ? { status } : {}),
    })
  );
};

const ensureWelcomeMessage = () => {
  if (messages.value.length > 0) {
    return;
  }
  pushMessage(
    createMessage({
      role: "assistant",
      name: texts.value.assistantName,
      content: texts.value.welcome,
    })
  );
};

watch(
  () => texts.value.welcome,
  () => {
    if (messages.value.length === 0) {
      ensureWelcomeMessage();
    }
  },
  { immediate: true }
);

const cloneSelectionSnapshot = (
  snapshot: AiAssistantSelectionSnapshot | null | undefined
): AiAssistantSelectionSnapshot | null => {
  if (!snapshot) {
    return null;
  }
  return {
    from: snapshot.from,
    to: snapshot.to,
  };
};

const readSelectionSnapshot = (editor: LumenEditor | null) => {
  const state = editor?.view?.state || editor?.state;
  const selection = state?.selection;
  if (!selection) {
    return null;
  }

  const from = Number(selection.from);
  const to = Number(selection.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return null;
  }

  return { from, to } satisfies AiAssistantSelectionSnapshot;
};

const readSelectionPreview = (
  editor: LumenEditor | null,
  snapshot: AiAssistantSelectionSnapshot | null
) => {
  if (!editor || !snapshot) {
    return "";
  }

  const state = editor.view?.state || editor.state;
  const doc = state?.doc;
  if (!doc?.textBetween || !Number.isFinite(doc?.content?.size)) {
    return "";
  }

  const max = Number(doc.content.size);
  const from = Math.max(0, Math.min(max, Math.trunc(snapshot.from)));
  const to = Math.max(0, Math.min(max, Math.trunc(snapshot.to)));
  if (to <= from) {
    return "";
  }

  return String(doc.textBetween(from, to, "\n\n", "\n") || "")
    .replace(/\r\n?/g, "\n")
    .trim();
};

const selectionPreviewText = computed(() => readSelectionPreview(props.editor, lastSelectionSnapshot.value));

watch(
  () => props.editor,
  (editor, _previousEditor, onCleanup) => {
    latestGeneratedOutput.value = null;
    lastSelectionSnapshot.value = readSelectionSnapshot(editor);

    if (!editor) {
      return;
    }

    const syncSelectionSnapshot = () => {
      const snapshot = readSelectionSnapshot(editor);
      if (snapshot) {
        lastSelectionSnapshot.value = snapshot;
      }
    };

    syncSelectionSnapshot();
    editor.on("selectionUpdate", syncSelectionSnapshot);
    editor.on("transaction", syncSelectionSnapshot);

    onCleanup(() => {
      editor.off("selectionUpdate", syncSelectionSnapshot);
      editor.off("transaction", syncSelectionSnapshot);
    });
  },
  { immediate: true }
);

const createIntentLabel = (intent: AiAssistantIntent) => {
  if (intent === "rewrite") {
    return texts.value.rewrite;
  }
  if (intent === "summarize") {
    return texts.value.summarize;
  }
  if (intent === "continue") {
    return texts.value.continueWriting;
  }
  return texts.value.send;
};

const formatSourceLabel = (source: string | null | undefined) => {
  if (source === "selection") {
    return texts.value.sourceSelection;
  }
  if (source === "block") {
    return texts.value.sourceBlock;
  }
  if (source === "document") {
    return texts.value.sourceDocument;
  }
  if (source === "auto") {
    return texts.value.sourceAuto;
  }
  return String(source || "").trim();
};

const buildUserRequestContent = ({
  requestText,
  contextText,
  source,
}: {
  requestText: string;
  contextText?: string | null;
  source?: string | null;
}) => {
  const sections = [`${texts.value.requestLabel}:\n${requestText}`];
  const normalizedSource = formatSourceLabel(source);

  if (normalizedSource) {
    sections.push(`${texts.value.sourceLabel}: ${normalizedSource}`);
  }

  if (contextText) {
    sections.push(`${texts.value.sentContextLabel}:\n${contextText}`);
  }

  return sections.join("\n\n");
};

const resolveFailureMessage = (reason: string, fallback: string) => {
  if (reason === "cancelled") {
    return texts.value.cancelled;
  }
  if (reason === "empty-context") {
    return texts.value.emptyContext;
  }
  return fallback;
};

const runAssistant = async ({
  intent,
  instruction,
  userMessage,
}: {
  intent: AiAssistantIntent;
  instruction: string;
  userMessage: string;
}) => {
  const selectionSnapshot = cloneSelectionSnapshot(lastSelectionSnapshot.value);
  const source = selectionSnapshot ? "selection" : "auto";

  console.info("[lumen-ai] runAssistant called", {
    intent,
    instruction,
    userMessage,
    providerId: providerConfig.providerId,
    modelId: providerConfig.modelId,
    serverUrl: providerConfig.serverUrl,
    canManage: props.canManage,
    hasEditor: !!props.editor,
    hasStorage: !!assistantStorage.value,
    selectionSnapshot,
    source,
  });

  ensureWelcomeMessage();

  if (!props.editor) {
    pushAssistantNotice(texts.value.missingEditor, "error");
    return false;
  }

  const storage = assistantStorage.value;
  if (!storage) {
    pushAssistantNotice(texts.value.missingPlugin, "error");
    return false;
  }

  if (!providerConfigReady.value) {
    pushAssistantNotice(texts.value.missingProviderConfig, "error");
    return false;
  }

  if (!props.canManage || running.value) {
    return false;
  }

  latestGeneratedOutput.value = null;
  const previewContextText = source === "selection" ? selectionPreviewText.value : "";
  const userMessageIndex = pushMessage(
    createMessage({
      role: "user",
      name: texts.value.userName,
      content: buildUserRequestContent({
        requestText: userMessage,
        source: source === "selection" ? source : null,
        contextText: previewContextText,
      }),
    })
  );

  running.value = true;
  const loadingIndex = pushMessage(
    createMessage({
      role: "assistant",
      name: texts.value.assistantName,
      content: "",
      status: "pending",
    })
  );
  activeLoadingIndex.value = loadingIndex;

  const result = await storage.run({
    intent,
    instruction,
    source,
    selectionSnapshot,
    applyMode: "none",
  });

  console.info("[lumen-ai] storage.run resolved", result);

  if (activeLoadingIndex.value === loadingIndex) {
    activeLoadingIndex.value = null;
  }
  running.value = false;

  if (result.ok) {
    latestGeneratedOutput.value = {
      outputText: result.outputText,
      selectionSnapshot,
    };
    replaceMessage(
      userMessageIndex,
      createMessage({
        role: "user",
        name: texts.value.userName,
        content: buildUserRequestContent({
          requestText: userMessage,
          source: result.source,
          contextText: result.contextText,
        }),
      })
    );
    replaceMessage(
      loadingIndex,
      createMessage({
        role: "assistant",
        name: texts.value.assistantName,
        content: result.outputText,
      })
    );
    return true;
  }

  latestGeneratedOutput.value = null;
  replaceMessage(
    loadingIndex,
    createMessage({
      role: "assistant",
      name: texts.value.assistantName,
      content: resolveFailureMessage(result.reason, result.message),
      status: "error",
    })
  );
  return false;
};

const handleProviderChange = (value: string) => {
  updateLumenAiProviderConfig({
    providerId: value as LumenAiProviderId,
  });
};

const handleModelChange = (value: string) => {
  updateLumenAiProviderConfig({
    modelId: String(value || ""),
  });
};

const handleServerUrlChange = (value: string) => {
  updateLumenAiProviderConfig({
    serverUrl: String(value || ""),
  });
};

const handleSystemPromptChange = (value: string) => {
  updateLumenAiProviderConfig({
    systemPrompt: String(value || ""),
  });
};

const handleDraftChange = (value: string) => {
  draft.value = String(value || "");
};

const handlePreset = (intent: AiAssistantIntent) => {
  if (!canRunAssistant.value) {
    return;
  }
  void runAssistant({
    intent,
    instruction: "",
    userMessage: createIntentLabel(intent),
  });
};

const handleSend = () => {
  const instruction = draft.value.trim();
  console.info("[lumen-ai] handleSend triggered", {
    draft: draft.value,
    instruction,
    running: running.value,
    sendDisabled: sendDisabled.value,
    providerId: providerConfig.providerId,
  });
  if (!instruction || sendDisabled.value) {
    return;
  }
  draft.value = "";
  void runAssistant({
    intent: "custom",
    instruction,
    userMessage: instruction,
  });
};

const handleComposerKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }
  event.preventDefault();
  handleSend();
};

const handleApplyLatest = (applyMode: "replace" | "insert") => {
  const storage = assistantStorage.value;
  const latest = latestGeneratedOutput.value;
  if (!storage || !latest || !props.canManage || running.value) {
    return;
  }

  const source = applyMode === "replace" && latest.selectionSnapshot ? "selection" : "auto";
  const applied = storage.applyOutput({
    outputText: latest.outputText,
    applyMode,
    source,
    selectionSnapshot: cloneSelectionSnapshot(latest.selectionSnapshot),
  });

  if (!applied) {
    pushAssistantNotice(texts.value.applyFailed, "error");
    return;
  }

  lastSelectionSnapshot.value = readSelectionSnapshot(props.editor);
  pushAssistantNotice(applyMode === "replace" ? texts.value.replaceApplied : texts.value.insertApplied);
};

const handleCopyLatest = async () => {
  const latest = latestGeneratedOutput.value;
  if (!latest) {
    return;
  }

  try {
    await navigator.clipboard.writeText(latest.outputText);
    pushAssistantNotice(texts.value.copySucceeded);
  } catch (_error) {
    pushAssistantNotice(texts.value.copyFailed, "error");
  }
};

const handleStop = () => {
  abortLumenAiProviderRequest();
  assistantStorage.value?.cancel?.();
  running.value = false;

  if (activeLoadingIndex.value != null) {
    replaceMessage(
      activeLoadingIndex.value,
      createMessage({
        role: "assistant",
        name: texts.value.assistantName,
        content: texts.value.cancelled,
        status: "error",
      })
    );
    activeLoadingIndex.value = null;
  }
};
</script>

<style scoped>
.doc-ai-assistant {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: #ffffff;
}

.doc-ai-assistant-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.doc-ai-assistant-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.doc-ai-assistant-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  color: #111827;
}

.doc-ai-assistant-summary {
  font-size: 12px;
  line-height: 1.4;
  color: #64748b;
}

.doc-ai-assistant-close {
  width: 28px;
  height: 28px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
}

.doc-ai-assistant-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px 0;
}

.doc-ai-assistant-build {
  flex: 1 1 auto;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.4;
  color: #94a3b8;
  text-align: center;
}

.doc-ai-assistant-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 18px 0;
}

.doc-ai-assistant-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.doc-ai-assistant-label {
  font-size: 12px;
  line-height: 1.4;
  color: #475569;
}

.doc-ai-assistant-provider-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.doc-ai-assistant-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 18px 0;
}

.doc-ai-assistant-hint,
.doc-ai-assistant-selection-status {
  margin: 0;
  padding: 10px 18px 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.doc-ai-assistant-selection-status {
  padding-top: 4px;
}

.doc-ai-assistant-context {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 12px 18px 0;
  padding: 12px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #f8fafc;
}

.doc-ai-assistant-context-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.doc-ai-assistant-context-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: #334155;
}

.doc-ai-assistant-context-content,
.doc-ai-assistant-context-empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #475569;
}

.doc-ai-assistant-context-content {
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.doc-ai-assistant-chat {
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 18px;
  overflow: hidden;
  --td-chat-font-size: 12px;
}

.doc-ai-assistant-chat :deep(.t-chat) {
  height: 100%;
}

.doc-ai-assistant-chat :deep(.t-chat-list) {
  height: 100%;
}

.doc-ai-assistant-chat :deep(.t-chat__list) {
  height: 100%;
  padding-right: 4px;
  overflow-y: auto;
}

.doc-ai-assistant-chat :deep(.t-chat__text pre) {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.doc-ai-assistant-chat :deep(.t-chat__text__content p) {
  margin: 0 0 0.75em;
}

.doc-ai-assistant-chat :deep(.t-chat__text__content p:last-child) {
  margin-bottom: 0;
}

.doc-ai-assistant-result-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid #e5e7eb;
  padding: 12px 18px 0;
}

.doc-ai-assistant-result-meta {
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
}

.doc-ai-assistant-result-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.doc-ai-assistant-composer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid #e5e7eb;
  padding: 12px 18px 18px;
}

.doc-ai-assistant-composer-input {
  width: 100%;
}

.doc-ai-assistant-composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.doc-ai-assistant-composer-meta {
  font-size: 12px;
  line-height: 1.4;
  color: #64748b;
}

.doc-ai-assistant-composer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>


