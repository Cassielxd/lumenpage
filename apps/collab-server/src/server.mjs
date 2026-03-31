import { Server } from "@hocuspocus/server";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as Y from "yjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const defaultStorageDir = "./data";
const defaultDeepSeekBaseUrl = "https://api.deepseek.com";
const envFilePath = path.resolve(appRoot, ".env");

const loadEnvFileFallback = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key] != null) {
        continue;
      }

      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        value.length >= 2 &&
        ((value.startsWith("\"") && value.endsWith("\"")) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch (_error) {
    // Ignore missing env files and rely on process env.
  }
};

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envFilePath);
  } catch (_error) {
    // Ignore missing env files and rely on process env.
  }
}

await loadEnvFileFallback(envFilePath);

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveStorageDir = () => {
  const input = String(process.env.COLLAB_STORAGE_DIR || defaultStorageDir).trim() || defaultStorageDir;
  return path.isAbsolute(input) ? input : path.resolve(appRoot, input);
};

const serverName = String(process.env.HOCUSPOCUS_NAME || "lumenpage-collab");
const port = parseInteger(process.env.PORT, 1234);
const quiet = String(process.env.HOCUSPOCUS_QUIET || "true") !== "false";
const debounce = parseInteger(process.env.HOCUSPOCUS_DEBOUNCE, 2000);
const maxDebounce = parseInteger(process.env.HOCUSPOCUS_MAX_DEBOUNCE, 10000);
const authToken = String(process.env.COLLAB_AUTH_TOKEN || "").trim();
const storageDir = resolveStorageDir();
const deepSeekApiKey = String(process.env.DEEPSEEK_API_KEY || "").trim();
const deepSeekBaseUrl =
  String(process.env.DEEPSEEK_BASE_URL || defaultDeepSeekBaseUrl)
    .trim()
    .replace(/\/+$/, "") || defaultDeepSeekBaseUrl;
const deepSeekDefaultModel = String(process.env.DEEPSEEK_MODEL || "").trim();

const log = (scope, message, extra = null) => {
  const parts = ["[collab-server]", `[${scope}]`, message];
  if (extra != null) {
    parts.push(typeof extra === "string" ? extra : JSON.stringify(extra));
  }
  console.log(parts.join(" "));
};

const encodeDocumentName = (documentName) => Buffer.from(documentName, "utf8").toString("base64url");

const resolveDocumentFile = (documentName) =>
  path.join(storageDir, `${encodeDocumentName(documentName)}.bin`);

const trimText = (value) => String(value || "").trim();

const limitText = (value, size) => {
  const normalized = trimText(value);
  if (!normalized || normalized.length <= size) {
    return normalized;
  }
  return `${normalized.slice(0, size)}...`;
};

const ensureStorageDir = async () => {
  await fs.mkdir(storageDir, { recursive: true });
};

const loadDocument = async (documentName) => {
  const filePath = resolveDocumentFile(documentName);

  try {
    const persisted = await fs.readFile(filePath);
    const document = new Y.Doc();
    Y.applyUpdate(document, persisted);
    log("load", `loaded \"${documentName}\" from disk`, filePath);
    return document;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      log("load", `created empty document \"${documentName}\"`);
      return new Y.Doc();
    }
    throw error;
  }
};

const storeDocument = async (documentName, document) => {
  const filePath = resolveDocumentFile(documentName);
  const update = Y.encodeStateAsUpdate(document);

  await ensureStorageDir();
  await fs.writeFile(filePath, Buffer.from(update));
  log("store", `persisted \"${documentName}\"`, { filePath, bytes: update.byteLength });
};

const applyCorsHeaders = (response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

const respondJson = (response, statusCode, body) => {
  applyCorsHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
};

const readRequestBody = (request) =>
  new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => resolve(raw));
    request.on("error", reject);
  });

const parseJsonBody = async (request) => {
  const raw = await readRequestBody(request);
  if (!trimText(raw)) {
    return {};
  }
  return JSON.parse(raw);
};

const buildDefaultSystemPrompt = () =>
  "You are the writing assistant inside Lumen. Apply the user's instruction to the provided primary content and return only the final text that should be inserted into the document. Do not add explanations, labels, or markdown fences unless the user explicitly asks for them. Unless the user explicitly asks to copy or quote the source, do not return the primary content unchanged.";

const buildIntentPrompt = (intent) => {
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

const buildUserPrompt = ({ intent, instruction, text, source }) => {
  const sections = [
    buildIntentPrompt(intent),
    "Required behavior:\n- Use the primary content as the input.\n- Follow the extra instruction exactly.\n- If the request is a transformation, return the transformed result instead of repeating the input.\n- Keep the original language unless the instruction asks to change it.",
    trimText(source) ? `Context source:\n${trimText(source)}` : "",
    trimText(instruction) ? `Extra instruction:\n${trimText(instruction)}` : "",
    `Primary content:\n${limitText(text, 6000)}`,
  ];

  return sections.filter(Boolean).join("\n\n");
};

const extractMessageText = (value) => {
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
          if (typeof item.text === "string") {
            return item.text;
          }
          if (typeof item.content === "string") {
            return item.content;
          }
          if (item.type === "text" && typeof item.text === "string") {
            return item.text;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (value && typeof value === "object") {
    if (typeof value.text === "string") {
      return trimText(value.text);
    }
    if (typeof value.content === "string") {
      return trimText(value.content);
    }
  }

  return "";
};

const requestDeepSeekChatCompletion = async (payload) => {
  if (!deepSeekApiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured on the server.");
  }

  const model = trimText(payload.model) || deepSeekDefaultModel;
  if (!model) {
    throw new Error("Model is required.");
  }

  const response = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deepSeekApiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: trimText(payload.systemPrompt) || buildDefaultSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt({
            intent: trimText(payload.intent) || "custom",
            instruction: trimText(payload.instruction),
            text: trimText(payload.text),
            source: trimText(payload.source) || "auto",
          }),
        },
      ],
    }),
  });

  const raw = await response.text();
  let data = null;
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
};

const server = new Server({
  name: serverName,
  port,
  quiet,
  debounce,
  maxDebounce,
  async onAuthenticate({ token, documentName, requestParameters }) {
    if (!authToken) {
      return;
    }

    if (token !== authToken) {
      log("auth", `rejected \"${documentName}\"`, {
        tokenPresent: String(token || "").length > 0,
        user: requestParameters.get("user") || null,
      });
      throw new Error("Not authorized");
    }

    log("auth", `accepted \"${documentName}\"`, {
      user: requestParameters.get("user") || null,
    });
  },
  async onLoadDocument({ documentName }) {
    return loadDocument(documentName);
  },
  async onStoreDocument({ documentName, document }) {
    await storeDocument(documentName, document);
  },
  async onConnect({ documentName, socketId, requestParameters }) {
    log("connect", `socket ${socketId} -> \"${documentName}\"`, {
      user: requestParameters.get("user") || null,
    });
  },
  async onDisconnect({ documentName, socketId }) {
    log("disconnect", `socket ${socketId} left \"${documentName}\"`);
  },
  async onChange({ documentName, clientsCount }) {
    log("change", `document \"${documentName}\" updated`, { clientsCount });
  },
  onRequest({ request, response }) {
    return new Promise((resolve, reject) => {
      const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

      if (request.method === "OPTIONS") {
        applyCorsHeaders(response);
        response.writeHead(204);
        response.end();
        reject();
        return;
      }

      if (requestUrl.pathname === "/" || requestUrl.pathname === "/health") {
        respondJson(response, 200, {
          status: "ok",
          name: serverName,
          port,
          storageDir,
          authRequired: authToken.length > 0,
          timestamp: new Date().toISOString(),
        });
        reject();
        return;
      }

      if (requestUrl.pathname === "/ai/deepseek/chat/completions" && request.method === "POST") {
        void (async () => {
          try {
            log("ai", "deepseek request received");
            const payload = await parseJsonBody(request);
            const result = await requestDeepSeekChatCompletion(payload);
            log("ai", "deepseek completion created", {
              model: result.model,
              completionId: result.completionId,
            });
            respondJson(response, 200, {
              ok: true,
              outputText: result.outputText,
              completionId: result.completionId,
              model: result.model,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "AI request failed.";
            log("ai", "deepseek completion failed", { message });
            respondJson(response, 500, {
              ok: false,
              error: message,
            });
          }
        })();
        reject();
        return;
      }

      resolve();
    });
  },
  async onListen() {
    await ensureStorageDir();
    log("listen", `ready on ws://127.0.0.1:${port}`, {
      storageDir,
      authRequired: authToken.length > 0,
    });
  },
});

const shutdown = async (signal) => {
  log("shutdown", `received ${signal}`);
  await server.destroy();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await ensureStorageDir();
server.listen();




