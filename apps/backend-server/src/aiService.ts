import type { RuntimeConfig } from "./types.js";

const defaultDeepSeekBaseUrl = "https://api.deepseek.com";

const trimText = (value: unknown) => String(value ?? "").trim();

const limitText = (value: unknown, size: number) => {
  const normalized = trimText(value);
  if (!normalized || normalized.length <= size) {
    return normalized;
  }
  return `${normalized.slice(0, size)}...`;
};

const buildDefaultSystemPrompt = () =>
  "You are the writing assistant inside Lumen. Apply the user's instruction to the provided primary content and return only the final text that should be inserted into the document. Do not add explanations, labels, or markdown fences unless the user explicitly asks for them. Unless the user explicitly asks to copy or quote the source, do not return the primary content unchanged.";

const buildIntentPrompt = (intent: string) => {
  if (intent === "rewrite") {
    return "Rewrite the primary content to make it clearer, more direct, and better structured. Preserve meaning, but avoid copying the original wording unchanged unless absolutely necessary.";
  }
  if (intent === "summarize") {
    return "Summarize the primary content into a concise final paragraph. Do not copy the original wording sentence by sentence.";
  }
  if (intent === "continue") {
    return "Continue the writing in the same language and tone. Return only the new continuation, not the original content again.";
  }
  return "Apply the extra instruction to the primary content and return only the transformed final text. Do not echo the original content unless the instruction explicitly asks for exact copying.";
};

const buildUserPrompt = ({
  intent,
  instruction,
  text,
  source,
}: {
  intent: string;
  instruction: unknown;
  text: unknown;
  source: unknown;
}) =>
  [
    buildIntentPrompt(intent),
    "Required behavior:\n- Use the primary content as the input.\n- Follow the extra instruction exactly.\n- If the request is a transformation, return the transformed result instead of repeating the input.\n- Keep the original language unless the instruction asks to change it.",
    trimText(source) ? `Context source:\n${trimText(source)}` : "",
    trimText(instruction) ? `Extra instruction:\n${trimText(instruction)}` : "",
    `Primary content:\n${limitText(text, 6000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

const extractMessageText = (value: unknown) => {
  if (typeof value === "string") {
    return trimText(value);
  }

  if (Array.isArray(value)) {
    return trimText(
      value
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (!item || typeof item !== "object") {
            return "";
          }
          if ("text" in item && typeof item.text === "string") {
            return item.text;
          }
          if ("content" in item && typeof item.content === "string") {
            return item.content;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (value && typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return trimText(value.text);
    }
    if ("content" in value && typeof value.content === "string") {
      return trimText(value.content);
    }
  }

  return "";
};

export interface DeepSeekChatRequest {
  model?: string;
  intent?: string;
  instruction?: string;
  text?: string;
  source?: string;
  systemPrompt?: string;
}

export interface DeepSeekChatResponse {
  outputText: string;
  completionId: string | null;
  model: string;
}

export const createAiService = ({ config }: { config: RuntimeConfig }) => ({
  async requestDeepSeekChatCompletion(payload: DeepSeekChatRequest): Promise<DeepSeekChatResponse> {
    if (!config.deepSeekApiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured on the server.");
    }

    const model = trimText(payload?.model) || config.deepSeekDefaultModel;
    if (!model) {
      throw new Error("Model is required.");
    }

    const response = await fetch(
      `${config.deepSeekBaseUrl || defaultDeepSeekBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.deepSeekApiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: "system",
              content: trimText(payload?.systemPrompt) || buildDefaultSystemPrompt(),
            },
            {
              role: "user",
              content: buildUserPrompt({
                intent: trimText(payload?.intent) || "custom",
                instruction: trimText(payload?.instruction),
                text: trimText(payload?.text),
                source: trimText(payload?.source) || "auto",
              }),
            },
          ],
        }),
      },
    );

    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (_error) {
      data = null;
    }

    if (!response.ok) {
      const message = trimText(data?.error?.message) || trimText(raw) || "DeepSeek request failed.";
      throw new Error(message);
    }

    const outputText = extractMessageText(data?.choices?.[0]?.message?.content);
    if (!outputText) {
      throw new Error("DeepSeek returned an empty result.");
    }

    return {
      outputText,
      completionId: trimText(data?.id) || null,
      model,
    };
  },
});
