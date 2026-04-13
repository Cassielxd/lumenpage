export type DocumentLockOptions = {
  enabled: boolean;
  showMarkers: boolean;
  lockedBackgroundColor: string;
  markerColor: string;
  markerFillColor: string;
  markerSize: number;
};

export type DocumentLockPluginState = {
  enabled: boolean;
  showMarkers: boolean;
  revision: number;
};

export type DocumentLockRangeKind = "mark" | "node";

export type DocumentLockRange = {
  from: number;
  to: number;
  kind: DocumentLockRangeKind;
  nodeType?: string | null;
};

export type DocumentLockMeta = {
  enabled?: boolean;
  showMarkers?: boolean;
  refresh?: boolean;
  skipEnforcement?: boolean;
};

export const DOCUMENT_LOCK_META = "documentLock:meta";
export const DOCUMENT_LOCK_NODE_ATTR = "documentLock";
export const DOCUMENT_LOCK_NODE_TYPES = [
  "audio",
  "bookmark",
  "callout",
  "columns",
  "embedPanel",
  "file",
  "horizontalRule",
  "image",
  "math",
  "optionBox",
  "pageBreak",
  "seal",
  "signature",
  "template",
  "textBox",
  "video",
  "webPage",
] as const;

export const markDocumentLockTransaction = (tr: any, meta: DocumentLockMeta = {}) => {
  if (tr?.setMeta) {
    tr.setMeta(DOCUMENT_LOCK_META, {
      skipEnforcement: true,
      ...meta,
    });
  }
  return tr;
};

export const createDefaultDocumentLockOptions = (): DocumentLockOptions => ({
  enabled: true,
  showMarkers: true,
  lockedBackgroundColor: "rgba(148, 163, 184, 0.28)",
  markerColor: "#b45309",
  markerFillColor: "rgba(255, 247, 237, 0.98)",
  markerSize: 18,
});
