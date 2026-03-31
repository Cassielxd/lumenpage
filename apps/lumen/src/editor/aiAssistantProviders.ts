import { reactive } from "vue";
import { createDemoAiAssistantProvider, type AiAssistantProvider } from "lumenpage-extension-ai";
import type { PlaygroundLocale } from "./i18n";

export type LumenAiProviderId = "demo" | "deepseek-official";

export interface LumenAiProviderConfig {
  providerId: LumenAiProviderId;
  modelId: string;
  serverUrl: string;
  systemPrompt: string;
}

const DEFAULT_AI_SERVER_URL = "http://127.0.0.1:1234";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_DEMO_MODEL = "demo-balanced";
const STORAGE_KEY = "lumen.ai.provider.config.v2";

let activeAbortController: AbortController | null = null;

const trimText = (value: unknown) => String(value || "").trim();

const sanitizeProviderId = (value: unknown): LumenAiProviderId =>
  value === "demo" ? "demo" : "deepseek-official";

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readStoredConfig = (): Partial<LumenAiProviderConfig> => {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Partial<LumenAiProviderConfig> | null;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch (_error) {
    return {};
  }
};

const writeStoredConfig = (config: LumenAiProviderConfig) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (_error) {
    // Ignore storage quota and privacy-mode failures.
  }
};

const createInitialConfig = (): LumenAiProviderConfig => {
  const stored = readStoredConfig();
  const providerId = sanitizeProviderId(stored.providerId);
  const fallbackModelId = providerId === "demo" ? DEFAULT_DEMO_MODEL : DEFAULT_DEEPSEEK_MODEL;

  return {
    providerId,
    modelId: trimText(stored.modelId) || fallbackModelId,
    serverUrl: trimText(stored.serverUrl) || DEFAULT_AI_SERVER_URL,
    systemPrompt: trimText(stored.systemPrompt),
  };
};

export const lumenAiProviderConfig = reactive<LumenAiProviderConfig>(createInitialConfig());

const persistProviderConfig = () => {
  writeStoredConfig({
    providerId: lumenAiProviderConfig.providerId,
    modelId: lumenAiProviderConfig.modelId,
    serverUrl: lumenAiProviderConfig.serverUrl,
    systemPrompt: lumenAiProviderConfig.systemPrompt,
  });
};

const normalizeServerEndpoint = (serverUrl: string) => {
  const raw = trimText(serverUrl) || DEFAULT_AI_SERVER_URL;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw.replace(/^\/+/, "")}`;
  const protocolNormalized = withProtocol
    .replace(/^ws:\/\//i, "http://")
    .replace(/^wss:\/\//i, "https://");
  const normalized = protocolNormalized.replace(/\/+$/, "");
  return /\/ai\/deepseek\/chat\/completions$/i.test(normalized)
    ? normalized
    : `${normalized}/ai/deepseek/chat/completions`;
};

const buildModelRequiredMessage = (locale: PlaygroundLocale) =>
  locale === "zh-CN" ? "必须填写模型。" : "Model is required.";

const buildRequestFailedMessage = (locale: PlaygroundLocale) =>
  locale === "zh-CN" ? "DeepSeek 请求失败。" : "The DeepSeek request failed.";

const buildEmptyResultMessage = (locale: PlaygroundLocale) =>
  locale === "zh-CN" ? "DeepSeek 返回了空结果。" : "The DeepSeek API returned an empty result.";

const buildCancelledMessage = (locale: PlaygroundLocale) =>
  locale === "zh-CN" ? "AI 请求已取消。" : "AI request was cancelled.";

export const abortLumenAiProviderRequest = () => {
  activeAbortController?.abort();
  activeAbortController = null;
};

const requestDeepSeekOfficialProvider = async (
  locale: PlaygroundLocale,
  request: {
    intent: string;
    instruction: string;
    text: string;
    source: string;
  }
) => {
  const modelId = trimText(lumenAiProviderConfig.modelId);
  if (!modelId) {
    throw new Error(buildModelRequiredMessage(locale));
  }

  const endpoint = normalizeServerEndpoint(lumenAiProviderConfig.serverUrl);
  abortLumenAiProviderRequest();
  const controller = new AbortController();
  activeAbortController = controller;

  try {
    console.info("[lumen-ai] sending request", {
      endpoint,
      model: modelId,
      intent: request.intent,
      source: request.source,
      textLength: request.text.length,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        locale,
        intent: request.intent,
        instruction: request.instruction,
        text: request.text,
        source: request.source,
        systemPrompt: trimText(lumenAiProviderConfig.systemPrompt),
      }),
    });

    if (!response.ok) {
      const errorText = trimText(await response.text());
      throw new Error(errorText || buildRequestFailedMessage(locale));
    }

    const payload = (await response.json()) as {
      outputText?: unknown;
      error?: unknown;
    };

    console.info("[lumen-ai] received response", {
      endpoint,
      ok: true,
    });

    const outputText = trimText(payload.outputText);
    if (!outputText) {
      throw new Error(trimText(payload.error) || buildEmptyResultMessage(locale));
    }

    return outputText;
  } catch (error) {
    console.error("[lumen-ai] request failed", {
      endpoint,
      error,
    });
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(buildCancelledMessage(locale));
    }
    throw error;
  } finally {
    if (activeAbortController === controller) {
      activeAbortController = null;
    }
  }
};

export const updateLumenAiProviderConfig = (patch: Partial<LumenAiProviderConfig>) => {
  if (patch.providerId && patch.providerId !== lumenAiProviderConfig.providerId) {
    lumenAiProviderConfig.providerId = sanitizeProviderId(patch.providerId);

    const currentModelId = trimText(patch.modelId ?? lumenAiProviderConfig.modelId);
    if (lumenAiProviderConfig.providerId === "demo") {
      lumenAiProviderConfig.modelId = currentModelId || DEFAULT_DEMO_MODEL;
    } else if (!currentModelId || /^demo-/i.test(currentModelId)) {
      lumenAiProviderConfig.modelId = DEFAULT_DEEPSEEK_MODEL;
    }
  }

  if (typeof patch.modelId === "string") {
    lumenAiProviderConfig.modelId = patch.modelId;
  }
  if (typeof patch.serverUrl === "string") {
    lumenAiProviderConfig.serverUrl = patch.serverUrl;
  }
  if (typeof patch.systemPrompt === "string") {
    lumenAiProviderConfig.systemPrompt = patch.systemPrompt;
  }

  persistProviderConfig();
};

export const createLumenAiAssistantProvider = ({
  locale = "zh-CN",
}: {
  locale?: PlaygroundLocale;
} = {}): AiAssistantProvider => {
  const demoProvider = createDemoAiAssistantProvider({ locale });

  return async (request) => {
    console.info("[lumen-ai] provider selected", {
      providerId: lumenAiProviderConfig.providerId,
      modelId: lumenAiProviderConfig.modelId,
      serverUrl: lumenAiProviderConfig.serverUrl,
      intent: request.intent,
    });

    if (lumenAiProviderConfig.providerId === "deepseek-official") {
      return requestDeepSeekOfficialProvider(locale, {
        intent: request.intent,
        instruction: request.instruction,
        text: request.text,
        source: request.source,
      });
    }

    console.warn("[lumen-ai] using local demo provider, no backend request will be sent");
    return demoProvider(request);
  };
};



