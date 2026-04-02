import fs from "node:fs/promises";
import path from "node:path";
import { createId, createOpaqueToken } from "./security.js";
import type {
  BackendDatabase,
  BackendDocument,
  BackendDocumentRecord,
  BackendMembershipRecord,
  BackendSessionRecord,
  BackendShareLink,
  BackendShareLinkRecord,
  BackendUser,
  BackendUserRecord,
  DocumentAccess,
  PermissionMode,
  UserRole,
} from "./types.js";

const DEFAULT_DB: BackendDatabase = {
  version: 1,
  users: [],
  sessions: [],
  documents: [],
  memberships: [],
  shareLinks: [],
};

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  owner: 4,
};

const trimText = (value: unknown) => String(value ?? "").trim();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const nowIso = () => new Date().toISOString();

const normalizeEmail = (email: unknown) => trimText(email).toLowerCase();

const normalizeRole = (role: unknown, fallback: UserRole = "viewer"): UserRole => {
  const value = trimText(role).toLowerCase();
  if (value === "owner" || value === "editor" || value === "commenter" || value === "viewer") {
    return value;
  }
  return fallback;
};

const slugify = (value: unknown) => {
  const normalized = trimText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "document";
};

const sanitizeUser = (user: BackendUserRecord): BackendUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sanitizeDocument = (document: BackendDocumentRecord, role: UserRole | null = null): BackendDocument => ({
  id: document.id,
  name: document.name,
  title: document.title,
  field: document.field,
  ownerId: document.ownerId,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
  role,
});

const sanitizeShareLink = (shareLink: BackendShareLinkRecord): BackendShareLink => ({
  id: shareLink.id,
  documentId: shareLink.documentId,
  token: shareLink.token,
  role: shareLink.role,
  allowAnonymous: shareLink.allowAnonymous,
  createdAt: shareLink.createdAt,
  updatedAt: shareLink.updatedAt,
  expiresAt: shareLink.expiresAt,
  revokedAt: shareLink.revokedAt,
});

const isRoleAtLeast = (role: UserRole, minimumRole: UserRole) =>
  (ROLE_RANK[normalizeRole(role)] || 0) >= (ROLE_RANK[normalizeRole(minimumRole)] || 0);

type JsonStore = {
  read: () => Promise<BackendDatabase>;
  transact: <T>(mutator: (data: BackendDatabase) => Promise<T> | T) => Promise<T>;
};

const buildStore = ({ filePath }: { filePath: string }): JsonStore => {
  let state: BackendDatabase | null = null;
  let writeQueue = Promise.resolve();

  const ensureLoaded = async (): Promise<BackendDatabase> => {
    if (state) {
      return state;
    }

    try {
      const raw = await fs.readFile(filePath, "utf8");
      state = {
        ...clone(DEFAULT_DB),
        ...(JSON.parse(raw) as Partial<BackendDatabase>),
      };
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        throw error;
      }

      state = clone(DEFAULT_DB);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(state, null, 2));
      return state;
    }
  };

  const persist = async (nextState: BackendDatabase) => {
    state = nextState;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2));
  };

  return {
    async read() {
      return clone(await ensureLoaded());
    },
    async transact<T>(mutator: (data: BackendDatabase) => Promise<T> | T) {
      const operation = writeQueue.then(async () => {
        const current = clone(await ensureLoaded());
        const result = await mutator(current);
        await persist(current);
        return result;
      });

      writeQueue = operation.then(
        () => undefined,
        () => undefined,
      );

      return operation;
    },
  };
};

export const roleToPermissionMode = (role: UserRole): PermissionMode => {
  const normalized = normalizeRole(role);
  if (normalized === "owner" || normalized === "editor") {
    return "full";
  }
  if (normalized === "commenter") {
    return "comment";
  }
  return "readonly";
};

export interface BackendDataService {
  isRoleAtLeast: (role: UserRole, minimumRole: UserRole) => boolean;
  ensureReady: () => Promise<void>;
  getUserById: (userId: string) => Promise<BackendUserRecord | null>;
  getUserByEmail: (email: string) => Promise<BackendUserRecord | null>;
  createUser: (input: {
    email: string;
    displayName: string;
    passwordHash: string;
    passwordSalt: string;
  }) => Promise<BackendUser>;
  createSession: (input: { userId: string; ttlMs: number }) => Promise<BackendSessionRecord>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  getUserBySession: (sessionId: string) => Promise<{
    session: BackendSessionRecord;
    user: BackendUser;
    userRecord: BackendUserRecord;
  } | null>;
  listDocumentsForUser: (userId: string) => Promise<BackendDocument[]>;
  ensureCollaborationDocument: (input: {
    ownerId: string;
    name: string;
    title?: string;
    field?: string;
  }) => Promise<BackendDocument>;
  createDocument: (input: {
    ownerId: string;
    title?: string;
    name?: string;
    field?: string;
  }) => Promise<BackendDocument>;
  getDocumentById: (documentId: string) => Promise<BackendDocument | null>;
  getDocumentByName: (name: string) => Promise<BackendDocument | null>;
  updateDocument: (input: { documentId: string; title?: string; field?: string }) => Promise<BackendDocument>;
  touchDocumentByName: (documentName: string) => Promise<BackendDocument | null>;
  resolveDocumentAccess: (input: {
    documentId: string;
    userId: string | null;
    shareToken: string;
  }) => Promise<DocumentAccess | null>;
  listMembers: (documentId: string) => Promise<Array<{ role: UserRole; user: BackendUser }>>;
  setMemberRole: (input: {
    documentId: string;
    userId: string;
    role: UserRole;
  }) => Promise<{ role: UserRole; user: BackendUser }>;
  removeMember: (input: { documentId: string; userId: string }) => Promise<boolean>;
  listShareLinks: (documentId: string) => Promise<BackendShareLink[]>;
  createShareLink: (input: {
    documentId: string;
    role: UserRole;
    allowAnonymous?: boolean;
    expiresAt?: string | null;
    createdByUserId: string;
  }) => Promise<BackendShareLink>;
  getShareLinkByToken: (token: string) => Promise<{
    shareLink: BackendShareLink;
    document: BackendDocument;
  } | null>;
  getShareLinkById: (shareId: string) => Promise<BackendShareLink | null>;
  revokeShareLink: (shareId: string) => Promise<BackendShareLink>;
}

export const createBackendDataService = ({ filePath }: { filePath: string }): BackendDataService => {
  const store = buildStore({ filePath });

  const pruneInPlace = (data: BackendDatabase) => {
    const currentTime = Date.now();
    data.sessions = data.sessions.filter((session) => Date.parse(session.expiresAt) > currentTime);
    data.shareLinks = data.shareLinks.filter((shareLink) => {
      if (shareLink.revokedAt) {
        return true;
      }
      if (!shareLink.expiresAt) {
        return true;
      }
      return Date.parse(shareLink.expiresAt) > currentTime;
    });
  };

  const findDocumentById = (data: BackendDatabase, documentId: string) =>
    data.documents.find((document) => document.id === documentId) || null;

  const findDocumentByName = (data: BackendDatabase, name: string) =>
    data.documents.find((document) => document.name === name) || null;

  const getMembershipRole = (data: BackendDatabase, documentId: string, userId: string) => {
    const membership = data.memberships.find(
      (item) => item.documentId === documentId && item.userId === userId,
    );
    return membership ? normalizeRole(membership.role) : null;
  };

  const getShareAccess = (
    data: BackendDatabase,
    documentId: string,
    shareToken: string,
    userId: string | null,
  ) => {
    const normalizedToken = trimText(shareToken);
    if (!normalizedToken) {
      return null;
    }

    const shareLink =
      data.shareLinks.find((item) => item.token === normalizedToken && item.documentId === documentId) ||
      null;
    if (!shareLink || shareLink.revokedAt) {
      return null;
    }
    if (shareLink.expiresAt && Date.parse(shareLink.expiresAt) <= Date.now()) {
      return null;
    }
    if (!shareLink.allowAnonymous && !userId) {
      return null;
    }

    return shareLink;
  };

  return {
    isRoleAtLeast,
    async ensureReady() {
      await store.read();
    },
    async getUserById(userId) {
      const data = await store.read();
      pruneInPlace(data);
      return data.users.find((user) => user.id === userId) || null;
    },
    async getUserByEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return null;
      }
      const data = await store.read();
      pruneInPlace(data);
      return data.users.find((user) => user.email === normalizedEmail) || null;
    },
    async createUser({ email, displayName, passwordHash, passwordSalt }) {
      const normalizedEmail = normalizeEmail(email);
      const normalizedDisplayName = trimText(displayName) || normalizedEmail.split("@")[0] || "User";

      return store.transact(async (data) => {
        pruneInPlace(data);
        if (data.users.some((user) => user.email === normalizedEmail)) {
          throw Object.assign(new Error("Email is already registered."), { statusCode: 409 });
        }

        const timestamp = nowIso();
        const user: BackendUserRecord = {
          id: createId("user"),
          email: normalizedEmail,
          displayName: normalizedDisplayName,
          passwordHash,
          passwordSalt,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        data.users.push(user);
        return sanitizeUser(user);
      });
    },
    async createSession({ userId, ttlMs }) {
      return store.transact(async (data) => {
        pruneInPlace(data);
        const user = data.users.find((item) => item.id === userId);
        if (!user) {
          throw Object.assign(new Error("User does not exist."), { statusCode: 404 });
        }

        const timestamp = Date.now();
        const session: BackendSessionRecord = {
          id: createOpaqueToken(18),
          userId,
          createdAt: new Date(timestamp).toISOString(),
          updatedAt: new Date(timestamp).toISOString(),
          expiresAt: new Date(timestamp + ttlMs).toISOString(),
        };

        data.sessions = data.sessions.filter((item) => item.userId !== userId);
        data.sessions.push(session);
        return session;
      });
    },
    async deleteSession(sessionId) {
      const normalizedId = trimText(sessionId);
      if (!normalizedId) {
        return false;
      }

      return store.transact(async (data) => {
        const before = data.sessions.length;
        data.sessions = data.sessions.filter((session) => session.id !== normalizedId);
        return data.sessions.length !== before;
      });
    },
    async getUserBySession(sessionId) {
      const normalizedId = trimText(sessionId);
      if (!normalizedId) {
        return null;
      }

      const data = await store.read();
      pruneInPlace(data);
      const session = data.sessions.find((item) => item.id === normalizedId) || null;
      if (!session) {
        return null;
      }

      const user = data.users.find((item) => item.id === session.userId) || null;
      if (!user) {
        return null;
      }

      return {
        session,
        user: sanitizeUser(user),
        userRecord: user,
      };
    },
    async listDocumentsForUser(userId) {
      const data = await store.read();
      pruneInPlace(data);

      const documents: BackendDocument[] = [];
      for (const document of data.documents) {
        let role: UserRole | null = null;
        if (document.ownerId === userId) {
          role = "owner";
        } else {
          role = getMembershipRole(data, document.id, userId);
        }

        if (!role) {
          continue;
        }

        documents.push(sanitizeDocument(document, role));
      }

      return documents.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async ensureCollaborationDocument({ ownerId, name, title, field }) {
      const documentName = trimText(name);
      if (!documentName) {
        throw Object.assign(new Error("Document name is required."), { statusCode: 400 });
      }

      return store.transact(async (data) => {
        pruneInPlace(data);
        const owner = data.users.find((user) => user.id === ownerId);
        if (!owner) {
          throw Object.assign(new Error("Owner does not exist."), { statusCode: 404 });
        }

        const existing = findDocumentByName(data, documentName);
        if (existing) {
          let role: UserRole | null = null;
          if (existing.ownerId === ownerId) {
            role = "owner";
            if (trimText(title)) {
              existing.title = trimText(title);
            }
            if (trimText(field)) {
              existing.field = trimText(field);
            }
            existing.updatedAt = nowIso();
          } else {
            role = getMembershipRole(data, existing.id, ownerId);
          }

          if (!role) {
            throw Object.assign(new Error("Document already exists and is not accessible."), {
              statusCode: 403,
            });
          }

          return sanitizeDocument(existing, role);
        }

        const timestamp = nowIso();
        const document: BackendDocumentRecord = {
          id: createId("doc"),
          name: documentName,
          title: trimText(title) || documentName,
          field: trimText(field) || "default",
          ownerId,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        data.documents.push(document);
        return sanitizeDocument(document, "owner");
      });
    },
    async createDocument({ ownerId, title, name, field }) {
      return store.transact(async (data) => {
        pruneInPlace(data);
        const owner = data.users.find((user) => user.id === ownerId);
        if (!owner) {
          throw Object.assign(new Error("Owner does not exist."), { statusCode: 404 });
        }

        const titleText = trimText(title) || "Untitled document";
        const baseName = slugify(name || titleText);
        let resolvedName = baseName;
        let suffix = 2;
        while (data.documents.some((document) => document.name === resolvedName)) {
          resolvedName = `${baseName}-${suffix}`;
          suffix += 1;
        }

        const timestamp = nowIso();
        const document: BackendDocumentRecord = {
          id: createId("doc"),
          name: resolvedName,
          title: titleText,
          field: trimText(field) || "default",
          ownerId,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        data.documents.push(document);
        return sanitizeDocument(document, "owner");
      });
    },
    async getDocumentById(documentId) {
      const data = await store.read();
      pruneInPlace(data);
      const document = findDocumentById(data, trimText(documentId));
      return document ? sanitizeDocument(document, null) : null;
    },
    async getDocumentByName(name) {
      const data = await store.read();
      pruneInPlace(data);
      const document = findDocumentByName(data, trimText(name));
      return document ? sanitizeDocument(document, null) : null;
    },
    async updateDocument({ documentId, title, field }) {
      return store.transact(async (data) => {
        pruneInPlace(data);
        const document = findDocumentById(data, trimText(documentId));
        if (!document) {
          throw Object.assign(new Error("Document not found."), { statusCode: 404 });
        }

        if (trimText(title)) {
          document.title = trimText(title);
        }
        if (trimText(field)) {
          document.field = trimText(field);
        }
        document.updatedAt = nowIso();
        return sanitizeDocument(document, null);
      });
    },
    async touchDocumentByName(documentName) {
      const normalizedName = trimText(documentName);
      if (!normalizedName) {
        return null;
      }

      return store.transact(async (data) => {
        const document = findDocumentByName(data, normalizedName);
        if (!document) {
          return null;
        }
        document.updatedAt = nowIso();
        return sanitizeDocument(document, null);
      });
    },
    async resolveDocumentAccess({ documentId, userId, shareToken }) {
      const data = await store.read();
      pruneInPlace(data);
      const document = findDocumentById(data, trimText(documentId));
      if (!document) {
        return null;
      }

      let role: UserRole | null = null;
      let source: DocumentAccess["source"] | null = null;
      let shareLink: BackendShareLinkRecord | null = null;

      if (document.ownerId === userId) {
        role = "owner";
        source = "owner";
      }

      if (!role && userId) {
        const membershipRole = getMembershipRole(data, document.id, userId);
        if (membershipRole) {
          role = membershipRole;
          source = "member";
        }
      }

      if (!role) {
        const matchedShareLink = getShareAccess(data, document.id, shareToken, userId);
        if (matchedShareLink) {
          role = normalizeRole(matchedShareLink.role);
          source = "share-link";
          shareLink = matchedShareLink;
        }
      }

      if (!role || !source) {
        return null;
      }

      return {
        document: sanitizeDocument(document, role),
        role,
        source,
        shareLink: shareLink ? sanitizeShareLink(shareLink) : null,
      };
    },
    async listMembers(documentId) {
      const data = await store.read();
      pruneInPlace(data);
      const document = findDocumentById(data, trimText(documentId));
      if (!document) {
        throw Object.assign(new Error("Document not found."), { statusCode: 404 });
      }

      const owner = data.users.find((user) => user.id === document.ownerId) || null;
      const members: Array<{ role: UserRole; user: BackendUser }> = [];

      if (owner) {
        members.push({
          role: "owner",
          user: sanitizeUser(owner),
        });
      }

      for (const membership of data.memberships.filter((item) => item.documentId === document.id)) {
        const user = data.users.find((item) => item.id === membership.userId);
        if (!user) {
          continue;
        }

        members.push({
          role: normalizeRole(membership.role),
          user: sanitizeUser(user),
        });
      }

      return members;
    },
    async setMemberRole({ documentId, userId, role }) {
      const normalizedRole = normalizeRole(role);
      if (normalizedRole === "owner") {
        throw Object.assign(new Error("Owner role cannot be reassigned."), { statusCode: 400 });
      }

      return store.transact(async (data) => {
        pruneInPlace(data);
        const document = findDocumentById(data, trimText(documentId));
        if (!document) {
          throw Object.assign(new Error("Document not found."), { statusCode: 404 });
        }

        if (document.ownerId === userId) {
          throw Object.assign(new Error("Owner permissions are fixed on the document."), {
            statusCode: 400,
          });
        }

        const user = data.users.find((item) => item.id === trimText(userId));
        if (!user) {
          throw Object.assign(new Error("User not found."), { statusCode: 404 });
        }

        const timestamp = nowIso();
        const membership =
          data.memberships.find(
            (item) => item.documentId === document.id && item.userId === trimText(userId),
          ) || null;

        if (membership) {
          membership.role = normalizedRole as BackendMembershipRecord["role"];
          membership.updatedAt = timestamp;
        } else {
          data.memberships.push({
            id: createId("member"),
            documentId: document.id,
            userId: trimText(userId),
            role: normalizedRole as BackendMembershipRecord["role"],
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }

        document.updatedAt = timestamp;
        return {
          role: normalizedRole,
          user: sanitizeUser(user),
        };
      });
    },
    async removeMember({ documentId, userId }) {
      return store.transact(async (data) => {
        pruneInPlace(data);
        const document = findDocumentById(data, trimText(documentId));
        if (!document) {
          throw Object.assign(new Error("Document not found."), { statusCode: 404 });
        }

        if (document.ownerId === trimText(userId)) {
          throw Object.assign(new Error("Owner cannot be removed from the document."), {
            statusCode: 400,
          });
        }

        const before = data.memberships.length;
        data.memberships = data.memberships.filter(
          (item) => !(item.documentId === document.id && item.userId === trimText(userId)),
        );
        document.updatedAt = nowIso();
        return data.memberships.length !== before;
      });
    },
    async listShareLinks(documentId) {
      const data = await store.read();
      pruneInPlace(data);
      const document = findDocumentById(data, trimText(documentId));
      if (!document) {
        throw Object.assign(new Error("Document not found."), { statusCode: 404 });
      }

      return data.shareLinks
        .filter((shareLink) => shareLink.documentId === document.id)
        .map((shareLink) => sanitizeShareLink(shareLink));
    },
    async createShareLink({ documentId, role, allowAnonymous, expiresAt, createdByUserId }) {
      const normalizedRole = normalizeRole(role);
      if (normalizedRole === "owner") {
        throw Object.assign(new Error("Share links cannot grant owner access."), {
          statusCode: 400,
        });
      }

      return store.transact(async (data) => {
        pruneInPlace(data);
        const document = findDocumentById(data, trimText(documentId));
        if (!document) {
          throw Object.assign(new Error("Document not found."), { statusCode: 404 });
        }

        const timestamp = nowIso();
        const shareLink: BackendShareLinkRecord = {
          id: createId("share"),
          documentId: document.id,
          token: createOpaqueToken(24),
          role: normalizedRole as BackendShareLinkRecord["role"],
          allowAnonymous: allowAnonymous !== false,
          createdByUserId,
          createdAt: timestamp,
          updatedAt: timestamp,
          expiresAt: trimText(expiresAt) || null,
          revokedAt: null,
        };

        data.shareLinks.push(shareLink);
        document.updatedAt = timestamp;
        return sanitizeShareLink(shareLink);
      });
    },
    async getShareLinkByToken(token) {
      const data = await store.read();
      pruneInPlace(data);
      const shareLink = data.shareLinks.find((item) => item.token === trimText(token)) || null;
      if (!shareLink || shareLink.revokedAt) {
        return null;
      }
      const document = findDocumentById(data, shareLink.documentId);
      if (!document) {
        return null;
      }
      return {
        shareLink: sanitizeShareLink(shareLink),
        document: sanitizeDocument(document, shareLink.role),
      };
    },
    async getShareLinkById(shareId) {
      const data = await store.read();
      pruneInPlace(data);
      const shareLink = data.shareLinks.find((item) => item.id === trimText(shareId)) || null;
      return shareLink ? sanitizeShareLink(shareLink) : null;
    },
    async revokeShareLink(shareId) {
      return store.transact(async (data) => {
        pruneInPlace(data);
        const shareLink = data.shareLinks.find((item) => item.id === trimText(shareId)) || null;
        if (!shareLink) {
          throw Object.assign(new Error("Share link not found."), { statusCode: 404 });
        }
        if (!shareLink.revokedAt) {
          shareLink.revokedAt = nowIso();
          shareLink.updatedAt = shareLink.revokedAt;
        }
        return sanitizeShareLink(shareLink);
      });
    },
  };
};
