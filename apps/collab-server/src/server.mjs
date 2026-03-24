import { Server } from "@hocuspocus/server";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as Y from "yjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const defaultStorageDir = "./data";

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

const log = (scope, message, extra = null) => {
  const parts = [`[collab-server]`, `[${scope}]`, message];
  if (extra != null) {
    parts.push(typeof extra === "string" ? extra : JSON.stringify(extra));
  }
  console.log(parts.join(" "));
};

const encodeDocumentName = (documentName) => Buffer.from(documentName, "utf8").toString("base64url");

const resolveDocumentFile = (documentName) =>
  path.join(storageDir, `${encodeDocumentName(documentName)}.bin`);

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

const respondJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
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
