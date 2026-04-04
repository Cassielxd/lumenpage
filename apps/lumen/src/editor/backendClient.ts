export type BackendUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type BackendUserRole = "owner" | "editor" | "commenter" | "viewer";

export type BackendDocument = {
  id: string;
  name: string;
  title: string;
  field: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  role: BackendUserRole | null;
};

export type BackendCapabilities = {
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  canManage: boolean;
  permissionMode: "full" | "comment" | "readonly";
};

export type BackendAccess = {
  role: BackendUserRole;
  source?: "owner" | "member" | "share-link";
  permissionMode: "full" | "comment" | "readonly";
  capabilities: BackendCapabilities;
  shareLink?: BackendShareLink | null;
};

export type BackendMember = {
  role: BackendUserRole;
  user: BackendUser;
};

export type BackendShareLink = {
  id: string;
  documentId: string;
  token: string;
  role: Exclude<BackendUserRole, "owner">;
  allowAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  url?: string;
};

export type BackendCollabTicket = {
  url: string;
  documentName: string;
  field: string;
  token: string;
  role: BackendUserRole;
  permissionMode: "full" | "comment" | "readonly";
  capabilities: BackendCapabilities;
  userName: string;
  userColor: string;
  expiresAt: string;
};

export type BackendCollabSnapshot = {
  document: BackendDocument;
  field: string;
  snapshot: string;
};

const SHARE_ACCESS_TOKEN_PREFIX = "lumenpage-share-access-token";

const DEFAULT_BACKEND_URL = "http://localhost:1234";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

const trimText = (value: unknown) => String(value ?? "").trim();

export const LUMEN_BACKEND_URL_STORAGE_KEY = "lumenpage-lumen-backend-url";

const alignLoopbackHostForWindow = (value: string) => {
  if (typeof window === "undefined") {
    return value;
  }

  try {
    const url = new URL(value);
    const currentHost = String(window.location.hostname || "").trim().toLowerCase();
    const normalizedHost = url.hostname.toLowerCase();

    if (
      LOOPBACK_HOSTS.has(normalizedHost) &&
      LOOPBACK_HOSTS.has(currentHost) &&
      normalizedHost !== currentHost
    ) {
      url.hostname = currentHost;
      return url.toString().replace(/\/+$/, "");
    }
  } catch (_error) {
    // Ignore invalid URLs and keep the normalized fallback below.
  }

  return value;
};

export const normalizeBackendUrl = (value: string) => {
  const normalized = trimText(value) || DEFAULT_BACKEND_URL;
  if (normalized.startsWith("ws://")) {
    return alignLoopbackHostForWindow(`http://${normalized.slice(5)}`.replace(/\/+$/, ""));
  }
  if (normalized.startsWith("wss://")) {
    return alignLoopbackHostForWindow(`https://${normalized.slice(6)}`.replace(/\/+$/, ""));
  }
  if (/^https?:\/\//i.test(normalized)) {
    return alignLoopbackHostForWindow(normalized.replace(/\/+$/, ""));
  }
  return alignLoopbackHostForWindow(`http://${normalized}`.replace(/\/+$/, ""));
};

export const resolveBackendUrl = (collaborationUrl?: string | null) => {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(LUMEN_BACKEND_URL_STORAGE_KEY);
      if (stored?.trim()) {
        return normalizeBackendUrl(stored);
      }
    } catch (_error) {
      // ignore
    }
  }

  return normalizeBackendUrl(trimText(collaborationUrl) || DEFAULT_BACKEND_URL);
};

export const persistBackendUrl = (backendUrl: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LUMEN_BACKEND_URL_STORAGE_KEY, normalizeBackendUrl(backendUrl));
  } catch (_error) {
    // ignore
  }
};

const unwrapResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || data?.ok === false) {
    throw new Error(String(data?.error || response.statusText || "Request failed."));
  }

  return data as T;
};

type BackendRequestOptions = RequestInit & {
  shareToken?: string | null;
};

const backendFetch = async <T>(
  backendUrl: string,
  path: string,
  init?: BackendRequestOptions,
): Promise<T> => {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const shareToken = trimText(init?.shareToken);
  if (shareToken) {
    headers.set("X-Share-Token", shareToken);
  }

  const response = await fetch(`${normalizeBackendUrl(backendUrl)}${path}`, {
    credentials: "include",
    headers,
    ...init,
  });

  return unwrapResponse<T>(response);
};

export const getBackendSession = async (backendUrl: string) =>
  backendFetch<{ ok: true; user: BackendUser | null }>(backendUrl, "/api/me", {
    method: "GET",
  });

export const loginBackendUser = async (
  backendUrl: string,
  payload: { email: string; password: string },
) =>
  backendFetch<{ ok: true; user: BackendUser }>(backendUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const registerBackendUser = async (
  backendUrl: string,
  payload: { email: string; password: string; displayName: string },
) =>
  backendFetch<{ ok: true; user: BackendUser }>(backendUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const logoutBackendUser = async (backendUrl: string) =>
  backendFetch<{ ok: true }>(backendUrl, "/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const ensureCollaborationDocument = async (
  backendUrl: string,
  payload: { name: string; title?: string; field?: string },
) =>
  backendFetch<{
    ok: true;
    document: BackendDocument;
    access: BackendAccess;
  }>(backendUrl, "/api/documents/ensure-collaboration", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listBackendDocuments = async (backendUrl: string) =>
  backendFetch<{ ok: true; documents: BackendDocument[] }>(backendUrl, "/api/documents", {
    method: "GET",
  });

export const createBackendDocument = async (
  backendUrl: string,
  payload: { title?: string; name?: string; field?: string },
) =>
  backendFetch<{ ok: true; document: BackendDocument }>(backendUrl, "/api/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getBackendDocumentAccess = async (
  backendUrl: string,
  documentId: string,
  options?: { shareToken?: string | null },
) =>
  backendFetch<{
    ok: true;
    document: BackendDocument;
    access: BackendAccess;
  }>(backendUrl, `/api/documents/${documentId}`, {
    method: "GET",
    shareToken: options?.shareToken,
  });

export const getBackendShareLink = async (backendUrl: string, shareToken: string) =>
  backendFetch<{
    ok: true;
    shareLink: BackendShareLink;
    document: BackendDocument;
    permissionMode: "full" | "comment" | "readonly";
  }>(backendUrl, `/api/share-links/${encodeURIComponent(trimText(shareToken))}`, {
    method: "GET",
  });

export const createDocumentCollabTicket = async (
  backendUrl: string,
  documentId: string,
  payload: { userName?: string; userColor?: string; field?: string; shareToken?: string | null },
) =>
  backendFetch<{ ok: true; collab: BackendCollabTicket }>(
    backendUrl,
    `/api/documents/${documentId}/collab-ticket`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      shareToken: payload.shareToken,
    },
  );

export const getDocumentCollabSnapshot = async (
  backendUrl: string,
  documentId: string,
  options?: { shareToken?: string | null },
) =>
  backendFetch<{ ok: true } & BackendCollabSnapshot>(
    backendUrl,
    `/api/documents/${documentId}/collab-snapshot`,
    {
      method: "GET",
      shareToken: options?.shareToken,
    },
  );

export const saveDocumentCollabSnapshot = async (
  backendUrl: string,
  documentId: string,
  payload: { snapshot: string; shareToken?: string | null },
) =>
  backendFetch<{ ok: true; document: BackendDocument; field: string }>(
    backendUrl,
    `/api/documents/${documentId}/collab-snapshot`,
    {
      method: "PUT",
      body: JSON.stringify({
        snapshot: payload.snapshot,
      }),
      shareToken: payload.shareToken,
    },
  );

export const listDocumentMembers = async (backendUrl: string, documentId: string) =>
  backendFetch<{ ok: true; members: BackendMember[] }>(
    backendUrl,
    `/api/documents/${documentId}/members`,
    {
      method: "GET",
    },
  );

export const addDocumentMemberByEmail = async (
  backendUrl: string,
  documentId: string,
  payload: { email: string; role: Exclude<BackendUserRole, "owner"> },
) =>
  backendFetch<{ ok: true; member: BackendMember }>(
    backendUrl,
    `/api/documents/${documentId}/members`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

export const listDocumentShareLinks = async (backendUrl: string, documentId: string) =>
  backendFetch<{ ok: true; shareLinks: BackendShareLink[] }>(
    backendUrl,
    `/api/documents/${documentId}/share-links`,
    {
      method: "GET",
    },
  );

export const createDocumentShareLink = async (
  backendUrl: string,
  documentId: string,
  payload: { role: Exclude<BackendUserRole, "owner">; allowAnonymous: boolean },
) =>
  backendFetch<{ ok: true; shareLink: BackendShareLink }>(
    backendUrl,
    `/api/documents/${documentId}/share-links`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

export const revokeDocumentShareLink = async (
  backendUrl: string,
  shareId: string,
) =>
  backendFetch<{ ok: true; shareLink: BackendShareLink }>(
    backendUrl,
    `/api/share-links/${shareId}`,
    {
      method: "DELETE",
    },
  );

const resolveShareAccessStorageKey = (documentId: string) =>
  `${SHARE_ACCESS_TOKEN_PREFIX}:${encodeURIComponent(trimText(documentId))}`;

export const rememberShareAccessToken = (documentId: string, token: string) => {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedDocumentId = trimText(documentId);
  const normalizedToken = trimText(token);
  if (!normalizedDocumentId || !normalizedToken) {
    return;
  }
  try {
    window.sessionStorage.setItem(resolveShareAccessStorageKey(normalizedDocumentId), normalizedToken);
  } catch (_error) {
    // ignore
  }
};

export const resolveStoredShareAccessToken = (documentId: string) => {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return trimText(window.sessionStorage.getItem(resolveShareAccessStorageKey(documentId)));
  } catch (_error) {
    return "";
  }
};

export const clearStoredShareAccessToken = (documentId: string) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(resolveShareAccessStorageKey(documentId));
  } catch (_error) {
    // ignore
  }
};
