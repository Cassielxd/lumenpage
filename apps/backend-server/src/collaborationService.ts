import fs from "node:fs/promises";
import path from "node:path";
import { Hocuspocus } from "@hocuspocus/server";
import * as Y from "yjs";
import { signPayload, verifySignedPayload } from "./security.js";
import type { BackendDataService } from "./dataService.js";
import type { CollabTicketPayload, RuntimeConfig, UserRole } from "./types.js";

const trimText = (value: unknown) => String(value ?? "").trim();

const encodeDocumentName = (documentName: string) => Buffer.from(documentName, "utf8").toString("base64url");

export interface CollaborationService {
  hocuspocus: Hocuspocus;
  ensureStorageDir: () => Promise<void>;
  createTicket: (input: {
    documentId: string;
    documentName: string;
    role: UserRole;
    userId: string | null;
    userName: string;
    userColor: string;
    field: string;
  }) => { token: string; expiresAt: string };
  verifyTicket: (token: string, documentName: string) => CollabTicketPayload | null;
}

export const createCollaborationService = ({
  config,
  dataService,
  log,
}: {
  config: RuntimeConfig;
  dataService: BackendDataService;
  log: (scope: string, message: string, extra?: unknown) => void;
}): CollaborationService => {
  const resolveDocumentFile = (documentName: string) =>
    path.join(config.storageDir, `${encodeDocumentName(documentName)}.bin`);

  const ensureStorageDir = async () => {
    await fs.mkdir(config.storageDir, { recursive: true });
  };

  const loadDocument = async (documentName: string) => {
    const filePath = resolveDocumentFile(documentName);

    try {
      const persisted = await fs.readFile(filePath);
      const document = new Y.Doc();
      Y.applyUpdate(document, persisted);
      log("load", `loaded "${documentName}" from disk`, filePath);
      return document;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        log("load", `created empty document "${documentName}"`);
        return new Y.Doc();
      }
      throw error;
    }
  };

  const storeDocument = async (documentName: string, document: Y.Doc) => {
    const filePath = resolveDocumentFile(documentName);
    const update = Y.encodeStateAsUpdate(document);

    await ensureStorageDir();
    await fs.writeFile(filePath, Buffer.from(update));
    log("store", `persisted "${documentName}"`, { filePath, bytes: update.byteLength });
    await dataService.touchDocumentByName(documentName);
  };

  const createTicket = ({
    documentId,
    documentName,
    role,
    userId,
    userName,
    userColor,
    field,
  }: {
    documentId: string;
    documentName: string;
    role: UserRole;
    userId: string | null;
    userName: string;
    userColor: string;
    field: string;
  }) => {
    const expiresAt = new Date(Date.now() + config.collabTicketTtlMs).toISOString();
    return {
      token: signPayload<CollabTicketPayload>(
        {
          documentId,
          documentName,
          role,
          userId: userId || null,
          userName: trimText(userName) || null,
          userColor: trimText(userColor) || null,
          field: trimText(field) || "default",
          expiresAt,
        },
        config.collabTicketSecret,
      ),
      expiresAt,
    };
  };

  const verifyTicket = (token: string, documentName: string) => {
    const payload = verifySignedPayload<CollabTicketPayload>(token, config.collabTicketSecret);
    if (!payload) {
      return null;
    }
    if (payload.documentName !== documentName) {
      return null;
    }
    return payload;
  };

  const hocuspocus = new Hocuspocus({
    name: config.backendName,
    quiet: config.quiet,
    debounce: config.debounce,
    maxDebounce: config.maxDebounce,
    async onAuthenticate({ token, documentName, requestParameters }) {
      const validTicket = verifyTicket(String(token ?? ""), documentName);
      if (validTicket) {
        return;
      }

      if (config.legacyCollabAuthToken) {
        if (token === config.legacyCollabAuthToken) {
          return;
        }

        log("auth", `rejected "${documentName}"`, {
          tokenPresent: trimText(token).length > 0,
          user: requestParameters.get("user") || null,
        });
        throw new Error("Not authorized");
      }

      if (config.enforceCollabTickets) {
        log("auth", `rejected "${documentName}"`, {
          tokenPresent: trimText(token).length > 0,
          user: requestParameters.get("user") || null,
        });
        throw new Error("Not authorized");
      }
    },
    async onLoadDocument({ documentName }) {
      return loadDocument(documentName);
    },
    async onStoreDocument({ documentName, document }) {
      await storeDocument(documentName, document);
    },
    async onConnect({ documentName, socketId, requestParameters }) {
      log("connect", `socket ${socketId} -> "${documentName}"`, {
        user: requestParameters.get("user") || null,
      });
    },
    async onDisconnect({ documentName, socketId }) {
      log("disconnect", `socket ${socketId} left "${documentName}"`);
    },
    async onChange({ documentName, clientsCount }) {
      log("change", `document "${documentName}" updated`, { clientsCount });
      await dataService.touchDocumentByName(documentName);
    },
  });

  return {
    hocuspocus,
    ensureStorageDir,
    createTicket,
    verifyTicket,
  };
};
