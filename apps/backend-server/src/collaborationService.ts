import fs from "node:fs/promises";
import path from "node:path";
import { Hocuspocus } from "@hocuspocus/server";
import * as Y from "yjs";
import { signPayload, verifySignedPayload } from "./security.js";
import { roleToPermissionMode, type BackendDataService } from "./dataService.js";
import type { CollabTicketPayload, RuntimeConfig, UserRole } from "./types.js";

const trimText = (value: unknown) => String(value ?? "").trim();
const accessChangedCloseReason = "Access changed";

const encodeDocumentName = (documentName: string) => Buffer.from(documentName, "utf8").toString("base64url");

export interface CollaborationService {
  hocuspocus: Hocuspocus;
  ensureStorageDir: () => Promise<void>;
  readDocumentSnapshot: (documentName: string) => Promise<Uint8Array>;
  writeDocumentSnapshot: (documentName: string, snapshot: Uint8Array) => Promise<void>;
  createTicket: (input: {
    documentId: string;
    documentName: string;
    role: UserRole;
    userId: string | null;
    shareToken?: string | null;
    userName: string;
    userColor: string;
    field: string;
  }) => { token: string; expiresAt: string };
  verifyTicket: (token: string, documentName: string) => CollabTicketPayload | null;
  disconnectDocumentClients: (input: {
    documentName: string;
    userId?: string | null;
    shareToken?: string | null;
    accessSource?: "owner" | "member" | "share-link";
  }) => number;
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
  const liveDocuments = new Map<string, Y.Doc>();
  const resolveDocumentFile = (documentName: string) =>
    path.join(config.storageDir, `${encodeDocumentName(documentName)}.bin`);

  const ensureStorageDir = async () => {
    await fs.mkdir(config.storageDir, { recursive: true });
  };

  const loadDocument = async (documentName: string) => {
    const liveDocument = liveDocuments.get(documentName);
    if (liveDocument) {
      return liveDocument;
    }
    const filePath = resolveDocumentFile(documentName);

    try {
      const persisted = await fs.readFile(filePath);
      const document = new Y.Doc();
      Y.applyUpdate(document, persisted);
      liveDocuments.set(documentName, document);
      log("load", `loaded "${documentName}" from disk`, filePath);
      return document;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        log("load", `created empty document "${documentName}"`);
        const document = new Y.Doc();
        liveDocuments.set(documentName, document);
        return document;
      }
      throw error;
    }
  };

  const storeDocument = async (documentName: string, document: Y.Doc) => {
    const filePath = resolveDocumentFile(documentName);
    const update = Y.encodeStateAsUpdate(document);

    liveDocuments.set(documentName, document);
    await ensureStorageDir();
    await fs.writeFile(filePath, Buffer.from(update));
    log("store", `persisted "${documentName}"`, { filePath, bytes: update.byteLength });
    await dataService.touchDocumentByName(documentName);
  };

  const readDocumentSnapshot = async (documentName: string) => {
    const document = liveDocuments.get(documentName) || (await loadDocument(documentName));
    return Y.encodeStateAsUpdate(document);
  };

  const writeDocumentSnapshot = async (documentName: string, snapshot: Uint8Array) => {
    const document = new Y.Doc();
    if (snapshot.byteLength > 0) {
      Y.applyUpdate(document, snapshot);
    }
    liveDocuments.set(documentName, document);
    await storeDocument(documentName, document);
  };

  const createTicket = ({
    documentId,
    documentName,
    role,
    userId,
    shareToken,
    userName,
    userColor,
    field,
  }: {
    documentId: string;
    documentName: string;
    role: UserRole;
    userId: string | null;
    shareToken?: string | null;
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
          shareToken: trimText(shareToken) || null,
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

  const disconnectDocumentClients = ({
    documentName,
    userId,
    shareToken,
    accessSource,
  }: {
    documentName: string;
    userId?: string | null;
    shareToken?: string | null;
    accessSource?: "owner" | "member" | "share-link";
  }) => {
    const document = hocuspocus.documents.get(documentName);
    if (!document) {
      return 0;
    }

    const normalizedUserId = trimText(userId);
    const normalizedShareToken = trimText(shareToken);
    let closedCount = 0;

    document.getConnections().forEach((connection) => {
      const context = (connection.context || {}) as {
        userId?: string | null;
        shareToken?: string | null;
        accessSource?: "owner" | "member" | "share-link";
      };

      if (normalizedUserId && trimText(context.userId) !== normalizedUserId) {
        return;
      }
      if (normalizedShareToken && trimText(context.shareToken) !== normalizedShareToken) {
        return;
      }
      if (accessSource && context.accessSource !== accessSource) {
        return;
      }

      connection.close({
        code: 1008,
        reason: accessChangedCloseReason,
      });
      closedCount += 1;
    });

    return closedCount;
  };

  const hocuspocus = new Hocuspocus({
    name: config.backendName,
    quiet: config.quiet,
    debounce: config.debounce,
    maxDebounce: config.maxDebounce,
    async onAuthenticate({ token, documentName, requestParameters, connectionConfig }) {
      const validTicket = verifyTicket(String(token ?? ""), documentName);
      if (validTicket) {
        const currentAccess = await dataService.resolveDocumentAccess({
          documentId: validTicket.documentId,
          userId: validTicket.userId,
          shareToken: validTicket.shareToken || "",
        });
        if (!currentAccess || currentAccess.document.name !== documentName) {
          log("auth", `rejected stale ticket for "${documentName}"`, {
            userId: validTicket.userId,
            shareToken: validTicket.shareToken || null,
          });
          throw new Error("Not authorized");
        }
        connectionConfig.readOnly = roleToPermissionMode(currentAccess.role) === "readonly";
        return {
          documentId: currentAccess.document.id,
          userId: validTicket.userId,
          shareToken: validTicket.shareToken || null,
          accessSource: currentAccess.source,
          role: currentAccess.role,
          permissionMode: roleToPermissionMode(currentAccess.role),
        };
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
    readDocumentSnapshot,
    writeDocumentSnapshot,
    createTicket,
    verifyTicket,
    disconnectDocumentClients,
  };
};
