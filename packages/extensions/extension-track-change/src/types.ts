export type TrackChangeKind = "insert" | "delete";

export type TrackChangeAttrs = {
  changeId: string;
  kind: TrackChangeKind;
  userId?: string | null;
  userName?: string | null;
  createdAt?: string | null;
};

export type TrackChangeAttrsInput = {
  changeId?: unknown;
  kind?: unknown;
  userId?: unknown;
  userName?: unknown;
  createdAt?: unknown;
};

export type TrackChangeRange = TrackChangeAttrs & {
  from: number;
  to: number;
  text: string | null;
};

export type TrackChangeRecord = {
  changeId: string;
  from: number;
  to: number;
  userId: string | null;
  userName: string | null;
  createdAt: string | null;
  kinds: TrackChangeKind[];
  insertedText: string | null;
  deletedText: string | null;
};

export type TrackChangesOptions = {
  enabled: boolean;
  userId: string | null;
  userName: string | null;
  insertionBackgroundColor: string;
  deletionBackgroundColor: string;
  activeDecorationColor: string;
};

export type TrackChangePluginState = {
  enabled: boolean;
  activeChangeId: string | null;
  revision: number;
};

export type TrackChangeMeta = {
  enabled?: boolean;
  activeChangeId?: string | null;
  skipTracking?: boolean;
  refresh?: boolean;
};

export const TRACK_CHANGE_META = "trackChange:meta";

const normalizeString = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

export const normalizeTrackChangeId = normalizeString;

export const normalizeTrackChangeKind = (value: unknown): TrackChangeKind | null => {
  if (value === "insert" || value === "delete") {
    return value;
  }
  return null;
};

export const normalizeTrackChangeAttrs = (
  attrs: TrackChangeAttrsInput | null | undefined
): TrackChangeAttrs | null => {
  const changeId = normalizeTrackChangeId(attrs?.changeId);
  const kind = normalizeTrackChangeKind(attrs?.kind);
  if (!changeId || !kind) {
    return null;
  }
  return {
    changeId,
    kind,
    userId: normalizeString(attrs?.userId),
    userName: normalizeString(attrs?.userName),
    createdAt: normalizeString(attrs?.createdAt),
  };
};

export const markTrackChangeTransaction = (tr: any, meta: TrackChangeMeta = {}) => {
  if (tr?.setMeta) {
    tr.setMeta(TRACK_CHANGE_META, {
      skipTracking: true,
      ...meta,
    });
  }
  return tr;
};

export const createDefaultTrackChangesOptions = (): TrackChangesOptions => ({
  enabled: false,
  userId: "local-user",
  userName: "You",
  insertionBackgroundColor: "rgba(34, 197, 94, 0.18)",
  deletionBackgroundColor: "rgba(239, 68, 68, 0.14)",
  activeDecorationColor: "rgba(59, 130, 246, 0.18)",
});
