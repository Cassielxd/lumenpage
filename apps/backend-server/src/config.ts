import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { RuntimeConfig } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(__dirname, "..");
const envFilePath = path.resolve(appRoot, ".env");
const defaultStorageDir = "./data";
const defaultDeepSeekBaseUrl = "https://api.deepseek.com";
const defaultAllowedOrigins = ["http://127.0.0.1:5173", "http://localhost:5173"];

const trimText = (value: unknown) => String(value ?? "").trim();

const parseInteger = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: unknown, fallback = false) => {
  const normalized = trimText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const splitCsv = (value: unknown, fallback: string[]) => {
  const items = trimText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : [...fallback];
};

const resolveAbsolutePath = (value: unknown, fallback: string) => {
  const input = trimText(value) || fallback;
  return path.isAbsolute(input) ? input : path.resolve(appRoot, input);
};

const loadEnvFileFallback = async (filePath: string) => {
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

export const createRuntimeConfig = (): RuntimeConfig => {
  const host = trimText(process.env.HOST || process.env.BACKEND_HOST || "127.0.0.1") || "127.0.0.1";
  const port = parseInteger(process.env.PORT, 1234);
  const storageDir = resolveAbsolutePath(
    process.env.BACKEND_STORAGE_DIR || process.env.COLLAB_STORAGE_DIR,
    defaultStorageDir,
  );
  const backendName =
    trimText(process.env.BACKEND_NAME || process.env.HOCUSPOCUS_NAME || "lumenpage-backend") ||
    "lumenpage-backend";
  const quiet = parseBoolean(process.env.BACKEND_QUIET || process.env.HOCUSPOCUS_QUIET, true);
  const debounce = parseInteger(process.env.HOCUSPOCUS_DEBOUNCE, 2000);
  const maxDebounce = parseInteger(process.env.HOCUSPOCUS_MAX_DEBOUNCE, 10000);
  const sessionTtlDays = Math.max(1, parseInteger(process.env.BACKEND_SESSION_TTL_DAYS, 30));
  const collabTicketTtlMinutes = Math.max(
    5,
    parseInteger(process.env.BACKEND_COLLAB_TICKET_TTL_MINUTES, 60),
  );
  const sessionSecret =
    trimText(process.env.BACKEND_SESSION_SECRET) || "lumenpage-backend-dev-session-secret";
  const collabTicketSecret = trimText(process.env.BACKEND_COLLAB_SECRET) || sessionSecret;
  const enforceCollabTickets = parseBoolean(process.env.BACKEND_ENFORCE_COLLAB_TICKETS, false);
  const legacyCollabAuthToken = trimText(process.env.COLLAB_AUTH_TOKEN);
  const sessionCookieName =
    trimText(process.env.BACKEND_SESSION_COOKIE || "lumenpage_session") || "lumenpage_session";
  const deepSeekApiKey = trimText(process.env.DEEPSEEK_API_KEY);
  const deepSeekBaseUrl =
    trimText(process.env.DEEPSEEK_BASE_URL || defaultDeepSeekBaseUrl).replace(/\/+$/, "") ||
    defaultDeepSeekBaseUrl;
  const deepSeekDefaultModel = trimText(process.env.DEEPSEEK_MODEL);
  const allowedOrigins = splitCsv(process.env.BACKEND_ALLOWED_ORIGINS, defaultAllowedOrigins);

  return {
    appRoot,
    envFilePath,
    host,
    port,
    backendName,
    quiet,
    debounce,
    maxDebounce,
    storageDir,
    metadataFilePath: path.join(storageDir, "backend-metadata.json"),
    sessionCookieName,
    sessionTtlMs: sessionTtlDays * 24 * 60 * 60 * 1000,
    collabTicketTtlMs: collabTicketTtlMinutes * 60 * 1000,
    sessionSecret,
    collabTicketSecret,
    enforceCollabTickets,
    legacyCollabAuthToken,
    deepSeekApiKey,
    deepSeekBaseUrl,
    deepSeekDefaultModel,
    allowedOrigins,
    collaborationPaths: new Set(["/", "/collaboration", "/ws"]),
  };
};

export const toPublicHttpUrl = (config: RuntimeConfig) => `http://127.0.0.1:${config.port}`;

export const toPublicWsUrl = (config: RuntimeConfig) => `ws://127.0.0.1:${config.port}`;
