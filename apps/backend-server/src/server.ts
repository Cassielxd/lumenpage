import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { WebSocketServer } from "ws";
import process from "node:process";
import { createAiService, type DeepSeekChatRequest } from "./aiService.js";
import { createRuntimeConfig, toPublicHttpUrl, toPublicWsUrl } from "./config.js";
import { createCollaborationService } from "./collaborationService.js";
import { createBackendDataService, roleToPermissionMode } from "./dataService.js";
import { createBackendMetadataStore } from "./metadataStore.js";
import {
  clearCookie,
  hashPassword,
  parseCookies,
  serializeCookie,
  verifyPassword,
} from "./security.js";
import type { BackendShareLink, BackendUser, DocumentAccess, RequestActor, UserRole } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    actor?: RequestActor;
  }
}

const config = createRuntimeConfig();
const metadataStore = createBackendMetadataStore(config);

const log = (scope: string, message: string, extra: unknown = null) => {
  const parts = ["[backend-server]", `[${scope}]`, message];
  if (extra != null) {
    parts.push(typeof extra === "string" ? extra : JSON.stringify(extra));
  }
  console.log(parts.join(" "));
};

const createHttpError = (statusCode: number, message: string, code = "request_failed") =>
  Object.assign(new Error(message), { statusCode, code });

const trimText = (value: unknown) => String(value ?? "").trim();

const getBody = (request: FastifyRequest) => (request.body ?? {}) as Record<string, unknown>;
const getQuery = (request: FastifyRequest) => (request.query ?? {}) as Record<string, unknown>;
const getParams = <T extends Record<string, string>>(request: FastifyRequest) => request.params as T;

const headerValueToText = (value: string | string[] | undefined) =>
  Array.isArray(value) ? trimText(value[0]) : trimText(value);

const dataService = createBackendDataService({
  store: metadataStore,
});
const aiService = createAiService({ config });
const collaborationService = createCollaborationService({
  config,
  dataService,
  log,
});

const fastify = Fastify({
  logger: false,
});

const webSocketServer = new WebSocketServer({
  noServer: true,
});

const resolveResponseOrigin = (request: FastifyRequest) => {
  const requestOrigin = trimText(request.headers.origin);
  if (!requestOrigin) {
    return "*";
  }
  if (config.allowedOrigins.includes("*")) {
    return requestOrigin;
  }
  return config.allowedOrigins.includes(requestOrigin) ? requestOrigin : config.allowedOrigins[0] || requestOrigin;
};

const applyCorsHeaders = (request: FastifyRequest, reply: FastifyReply) => {
  const origin = resolveResponseOrigin(request);
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Share-Token");
  reply.header("Cache-Control", "no-store");
};

const resolveRequestActor = async (request: FastifyRequest): Promise<RequestActor> => {
  const cookies = parseCookies(request.headers.cookie);
  const sessionId = trimText(cookies[config.sessionCookieName]);
  const sessionRecord = sessionId ? await dataService.getUserBySession(sessionId) : null;
  const query = getQuery(request);
  const body = getBody(request);

  return {
    sessionId: sessionRecord?.session?.id || sessionId || null,
    user: sessionRecord?.user || null,
    shareToken:
      headerValueToText(request.headers["x-share-token"]) ||
      trimText(query.shareToken) ||
      trimText(body.shareToken) ||
      "",
  };
};

const requireUser = (request: FastifyRequest) => {
  if (!request.actor?.user) {
    throw createHttpError(401, "Authentication required.", "authentication_required");
  }
  return request.actor.user;
};

const requireDocumentAccess = async (
  request: FastifyRequest,
  documentId: string,
  minimumRole: UserRole = "viewer",
): Promise<DocumentAccess> => {
  const access = await dataService.resolveDocumentAccess({
    documentId,
    userId: request.actor?.user?.id || null,
    shareToken: request.actor?.shareToken || "",
  });

  if (!access) {
    throw createHttpError(404, "Document not found or access denied.", "document_not_found");
  }
  if (!dataService.isRoleAtLeast(access.role, minimumRole)) {
    throw createHttpError(403, "Insufficient permissions.", "insufficient_permissions");
  }
  return access;
};

const decorateRequest = async (request: FastifyRequest) => {
  request.actor = await resolveRequestActor(request);
};

const serializeSessionCookie = (sessionId: string) =>
  serializeCookie(config.sessionCookieName, sessionId, {
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  });

const serializeUser = (user: BackendUser | null) =>
  user
    ? {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    : null;

const buildCapabilities = (role: UserRole) => ({
  canView: true,
  canComment: role === "owner" || role === "editor" || role === "commenter",
  canEdit: role === "owner" || role === "editor",
  canManage: role === "owner",
  permissionMode: roleToPermissionMode(role),
});

const serviceInfo = () => ({
  ok: true,
  status: "ok",
  name: config.backendName,
  httpUrl: toPublicHttpUrl(config),
  wsUrl: toPublicWsUrl(config),
  storageDir: config.storageDir,
  metadataFilePath: config.metadataFilePath,
  collabTicketRequired: config.enforceCollabTickets || config.legacyCollabAuthToken.length > 0,
  authRoutesEnabled: true,
  shareRoutesEnabled: true,
  aiProxyEnabled: true,
  timestamp: new Date().toISOString(),
});

fastify.addHook("onRequest", async (request, reply) => {
  applyCorsHeaders(request, reply);
  if (request.method === "OPTIONS") {
    reply.code(204).send();
    return reply;
  }
});

fastify.addHook("preHandler", async (request) => {
  await decorateRequest(request);
});

fastify.setErrorHandler((error, request, reply) => {
  const statusCode = Number((error as { statusCode?: number })?.statusCode) || 500;
  const message = error instanceof Error ? error.message : "Request failed.";

  log("http", `${request.method} ${request.url} failed`, {
    statusCode,
    message,
  });

  if (reply.sent) {
    return;
  }

  reply.code(statusCode).send({
    ok: false,
    error: message,
    code: (error as { code?: string })?.code || "request_failed",
  });
});

fastify.get("/", async () => serviceInfo());
fastify.get("/health", async () => serviceInfo());
fastify.get("/api/health", async () => serviceInfo());

fastify.post("/api/auth/register", async (request, reply) => {
  const body = getBody(request);
  const email = trimText(body.email).toLowerCase();
  const password = String(body.password ?? "");
  const displayName = trimText(body.displayName) || email.split("@")[0] || "User";

  if (!email || !email.includes("@")) {
    throw createHttpError(400, "A valid email is required.", "invalid_email");
  }

  const { hash, salt } = hashPassword(password);
  const user = await dataService.createUser({
    email,
    displayName,
    passwordHash: hash,
    passwordSalt: salt,
  });
  const session = await dataService.createSession({
    userId: user.id,
    ttlMs: config.sessionTtlMs,
  });

  reply.header("Set-Cookie", serializeSessionCookie(session.id));
  return {
    ok: true,
    user,
    session: {
      expiresAt: session.expiresAt,
    },
  };
});

fastify.post("/api/auth/login", async (request, reply) => {
  const body = getBody(request);
  const email = trimText(body.email).toLowerCase();
  const password = String(body.password ?? "");
  const record = await dataService.getUserByEmail(email);

  if (!record || !verifyPassword(password, record.passwordSalt, record.passwordHash)) {
    throw createHttpError(401, "Invalid email or password.", "invalid_credentials");
  }

  const session = await dataService.createSession({
    userId: record.id,
    ttlMs: config.sessionTtlMs,
  });

  reply.header("Set-Cookie", serializeSessionCookie(session.id));
  return {
    ok: true,
    user: serializeUser(record),
    session: {
      expiresAt: session.expiresAt,
    },
  };
});

fastify.post("/api/auth/logout", async (request, reply) => {
  if (request.actor?.sessionId) {
    await dataService.deleteSession(request.actor.sessionId);
  }

  reply.header("Set-Cookie", clearCookie(config.sessionCookieName));
  return { ok: true };
});

fastify.get("/api/me", async (request) => ({
  ok: true,
  user: request.actor?.user || null,
}));

fastify.get("/api/documents", async (request) => {
  const user = requireUser(request);
  const documents = await dataService.listDocumentsForUser(user.id);
  return {
    ok: true,
    documents,
  };
});

fastify.post("/api/documents", async (request) => {
  const user = requireUser(request);
  const body = getBody(request);
  const document = await dataService.createDocument({
    ownerId: user.id,
    title: body.title as string | undefined,
    name: body.name as string | undefined,
    field: body.field as string | undefined,
  });

  return {
    ok: true,
    document,
  };
});

fastify.post("/api/documents/ensure-collaboration", async (request) => {
  const user = requireUser(request);
  const body = getBody(request);
  const document = await dataService.ensureCollaborationDocument({
    ownerId: user.id,
    name: String(body.name || ""),
    title: (body.title as string | undefined) || undefined,
    field: (body.field as string | undefined) || undefined,
  });

  return {
    ok: true,
    document,
    access: {
      role: document.role,
      permissionMode: roleToPermissionMode((document.role || "viewer") as UserRole),
      capabilities: buildCapabilities((document.role || "viewer") as UserRole),
    },
  };
});

fastify.get("/api/documents/:documentId", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  const access = await requireDocumentAccess(request, params.documentId, "viewer");
  return {
    ok: true,
    document: access.document,
    access: {
      role: access.role,
      source: access.source,
      permissionMode: roleToPermissionMode(access.role),
      capabilities: buildCapabilities(access.role),
      shareLink: access.shareLink,
    },
  };
});

fastify.get("/api/documents/:documentId/collab-snapshot", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  const access = await requireDocumentAccess(request, params.documentId, "viewer");
  const snapshot = await collaborationService.readDocumentSnapshot(access.document.name);

  return {
    ok: true,
    document: access.document,
    field: access.document.field,
    snapshot: Buffer.from(snapshot).toString("base64"),
  };
});

fastify.put("/api/documents/:documentId/collab-snapshot", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  const body = getBody(request);
  const access = await requireDocumentAccess(request, params.documentId, "commenter");
  const snapshotBase64 = trimText(body.snapshot);
  if (!snapshotBase64 && snapshotBase64 !== "") {
    throw createHttpError(400, "A collaboration snapshot is required.", "invalid_snapshot");
  }
  let snapshot: Uint8Array;
  try {
    snapshot = new Uint8Array(Buffer.from(snapshotBase64, "base64"));
  } catch (_error) {
    throw createHttpError(400, "The collaboration snapshot is invalid.", "invalid_snapshot");
  }

  await collaborationService.writeDocumentSnapshot(access.document.name, snapshot);

  return {
    ok: true,
    document: access.document,
    field: access.document.field,
  };
});

fastify.patch("/api/documents/:documentId", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  const body = getBody(request);
  await requireDocumentAccess(request, params.documentId, "editor");
  const document = await dataService.updateDocument({
    documentId: params.documentId,
    title: body.title as string | undefined,
    field: body.field as string | undefined,
  });

  return {
    ok: true,
    document,
  };
});

fastify.get("/api/documents/:documentId/members", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  await requireDocumentAccess(request, params.documentId, "owner");
  const members = await dataService.listMembers(params.documentId);
  return {
    ok: true,
    members,
  };
});

fastify.post("/api/documents/:documentId/members", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  const body = getBody(request);
  await requireDocumentAccess(request, params.documentId, "owner");

  const email = trimText(body.email).toLowerCase();
  if (!email || !email.includes("@")) {
    throw createHttpError(400, "A valid email is required.", "invalid_email");
  }

  const user = await dataService.getUserByEmail(email);
  if (!user) {
    throw createHttpError(404, "The invited user does not exist yet.", "user_not_found");
  }

  const member = await dataService.setMemberRole({
    documentId: params.documentId,
    userId: user.id,
    role: (trimText(body.role) || "viewer") as UserRole,
  });

  return {
    ok: true,
    member,
  };
});

fastify.put("/api/documents/:documentId/members/:userId", async (request) => {
  const params = getParams<{ documentId: string; userId: string }>(request);
  const body = getBody(request);
  await requireDocumentAccess(request, params.documentId, "owner");
  const member = await dataService.setMemberRole({
    documentId: params.documentId,
    userId: params.userId,
    role: (trimText(body.role) || "viewer") as UserRole,
  });

  return {
    ok: true,
    member,
  };
});

fastify.delete("/api/documents/:documentId/members/:userId", async (request) => {
  const params = getParams<{ documentId: string; userId: string }>(request);
  await requireDocumentAccess(request, params.documentId, "owner");
  const removed = await dataService.removeMember({
    documentId: params.documentId,
    userId: params.userId,
  });

  return {
    ok: true,
    removed,
  };
});

fastify.get("/api/documents/:documentId/share-links", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  await requireDocumentAccess(request, params.documentId, "owner");
  const shareLinks = await dataService.listShareLinks(params.documentId);
  return {
    ok: true,
    shareLinks,
  };
});

fastify.post("/api/documents/:documentId/share-links", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  const body = getBody(request);
  const access = await requireDocumentAccess(request, params.documentId, "owner");
  const shareLink = await dataService.createShareLink({
    documentId: params.documentId,
    role: (trimText(body.role) || "viewer") as UserRole,
    allowAnonymous: body.allowAnonymous as boolean | undefined,
    expiresAt: (body.expiresAt as string | undefined) || undefined,
    createdByUserId: access.document.ownerId,
  });

  return {
    ok: true,
    shareLink: {
      ...shareLink,
      url: `${toPublicHttpUrl(config)}/share/${shareLink.token}`,
    },
  };
});

fastify.get("/api/share-links/:token", async (request) => {
  const params = getParams<{ token: string }>(request);
  const shareLinkRecord = await dataService.getShareLinkByToken(params.token);
  if (!shareLinkRecord) {
    throw createHttpError(404, "Share link not found.", "share_link_not_found");
  }

  return {
    ok: true,
    shareLink: {
      ...shareLinkRecord.shareLink,
      url: `${toPublicHttpUrl(config)}/share/${shareLinkRecord.shareLink.token}`,
    },
    document: shareLinkRecord.document,
    permissionMode: roleToPermissionMode(shareLinkRecord.shareLink.role),
  };
});

fastify.delete("/api/share-links/:shareId", async (request) => {
  const params = getParams<{ shareId: string }>(request);
  const shareLink = await dataService.getShareLinkById(params.shareId);
  if (!shareLink) {
    throw createHttpError(404, "Share link not found.", "share_link_not_found");
  }

  await requireDocumentAccess(request, shareLink.documentId, "owner");
  const revoked = await dataService.revokeShareLink(params.shareId);
  return {
    ok: true,
    shareLink: revoked,
  };
});

fastify.post("/api/documents/:documentId/collab-ticket", async (request) => {
  const params = getParams<{ documentId: string }>(request);
  const body = getBody(request);
  const access = await requireDocumentAccess(request, params.documentId, "viewer");
  const requestedUserName =
    trimText(body.userName) ||
    trimText(request.actor?.user?.displayName) ||
    trimText(request.actor?.user?.email) ||
    "Guest";
  const requestedUserColor = trimText(body.userColor) || "#2563eb";
  const field = trimText(body.field) || access.document.field || "default";
  const ticket = collaborationService.createTicket({
    documentId: access.document.id,
    documentName: access.document.name,
    role: access.role,
    userId: request.actor?.user?.id || null,
    userName: requestedUserName,
    userColor: requestedUserColor,
    field,
  });

  return {
    ok: true,
    collab: {
      url: toPublicWsUrl(config),
      documentName: access.document.name,
      field,
      token: ticket.token,
      role: access.role,
      permissionMode: roleToPermissionMode(access.role),
      capabilities: buildCapabilities(access.role),
      userName: requestedUserName,
      userColor: requestedUserColor,
      expiresAt: ticket.expiresAt,
    },
  };
});

const handleAiRequest = async (request: FastifyRequest) => {
  log("ai", "deepseek request received");
  const result = await aiService.requestDeepSeekChatCompletion(getBody(request) as DeepSeekChatRequest);
  log("ai", "deepseek completion created", {
    model: result.model,
    completionId: result.completionId,
  });

  return {
    ok: true,
    outputText: result.outputText,
    completionId: result.completionId,
    model: result.model,
  };
};

fastify.post("/ai/deepseek/chat/completions", handleAiRequest);
fastify.post("/api/ai/deepseek/chat/completions", handleAiRequest);

webSocketServer.on("connection", (socket, request) => {
  socket.on("error", (error) => {
    log("ws", "socket error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
  collaborationService.hocuspocus.handleConnection(socket, request);
});

fastify.server.on("upgrade", (request, socket, head) => {
  try {
    const requestUrl = new URL(
      request.url || "/",
      `http://${request.headers.host || `${config.host}:${config.port}`}`,
    );

    if (!config.collaborationPaths.has(requestUrl.pathname)) {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (ws) => {
      webSocketServer.emit("connection", ws, request);
    });
  } catch (error) {
    log("ws", "upgrade failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    socket.destroy();
  }
});

const shutdown = async (signal: string) => {
  log("shutdown", `received ${signal}`);
  collaborationService.hocuspocus.closeConnections();
  await fastify.close();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await collaborationService.ensureStorageDir();
await dataService.ensureReady();

await fastify.listen({
  host: config.host,
  port: config.port,
});

log("listen", `ready on ${toPublicHttpUrl(config)}`, {
  wsUrl: toPublicWsUrl(config),
  storageDir: config.storageDir,
  metadataFilePath: config.metadataFilePath,
  collabTicketRequired: config.enforceCollabTickets || config.legacyCollabAuthToken.length > 0,
});
