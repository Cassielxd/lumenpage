export type UserRole = "owner" | "editor" | "commenter" | "viewer";

export type PermissionMode = "full" | "comment" | "readonly";

export interface RuntimeConfig {
  appRoot: string;
  envFilePath: string;
  host: string;
  port: number;
  backendName: string;
  quiet: boolean;
  debounce: number;
  maxDebounce: number;
  storageDir: string;
  metadataFilePath: string;
  sessionCookieName: string;
  sessionTtlMs: number;
  collabTicketTtlMs: number;
  sessionSecret: string;
  collabTicketSecret: string;
  enforceCollabTickets: boolean;
  legacyCollabAuthToken: string;
  deepSeekApiKey: string;
  deepSeekBaseUrl: string;
  deepSeekDefaultModel: string;
  allowedOrigins: string[];
  collaborationPaths: Set<string>;
}

export interface BackendUserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendSessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface BackendDocumentRecord {
  id: string;
  name: string;
  title: string;
  field: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendDocument extends BackendDocumentRecord {
  role: UserRole | null;
}

export interface BackendMembershipRecord {
  id: string;
  documentId: string;
  userId: string;
  role: Exclude<UserRole, "owner">;
  createdAt: string;
  updatedAt: string;
}

export interface BackendShareLinkRecord {
  id: string;
  documentId: string;
  token: string;
  role: Exclude<UserRole, "owner">;
  allowAnonymous: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface BackendShareLink {
  id: string;
  documentId: string;
  token: string;
  role: Exclude<UserRole, "owner">;
  allowAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface BackendDatabase {
  version: number;
  users: BackendUserRecord[];
  sessions: BackendSessionRecord[];
  documents: BackendDocumentRecord[];
  memberships: BackendMembershipRecord[];
  shareLinks: BackendShareLinkRecord[];
}

export interface DocumentAccess {
  document: BackendDocument;
  role: UserRole;
  source: "owner" | "member" | "share-link";
  shareLink: BackendShareLink | null;
}

export interface RequestActor {
  sessionId: string | null;
  user: BackendUser | null;
  shareToken: string;
}

export interface CollabTicketPayload {
  documentId: string;
  documentName: string;
  role: UserRole;
  userId: string | null;
  userName: string | null;
  userColor: string | null;
  field: string;
  expiresAt: string;
}
