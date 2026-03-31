import {
  DEFAULT_PAGE_GAP,
  DEFAULT_PAGE_HEIGHT,
  DEFAULT_PAGE_MARGIN,
  DEFAULT_PAGE_WIDTH,
} from "lumenpage-view-canvas";
import { createLinebreakSegmentText } from "lumenpage-view-runtime";
import { resolvePlaygroundLocale, type PlaygroundLocale } from "./i18n";

export type PlaygroundDebugFlags = {
  locale: PlaygroundLocale;
  highContrast: boolean;
  permissionMode: "full" | "comment" | "readonly";
  enableInputRules: boolean;
  debugPerf: boolean;
  debugGhostTrace: boolean;
  enablePaginationWorker: boolean;
  forcePaginationWorker: boolean;
  collaborationEnabled: boolean;
  collaborationUrl: string;
  collaborationDocument: string;
  collaborationField: string;
  collaborationToken: string;
  collaborationUserName: string;
  collaborationUserColor: string;
};

const STORAGE_KEYS = {
  collaborationUserName: "lumenpage-lumen-collab-user-name",
  collaborationUserColor: "lumenpage-lumen-collab-user-color",
} as const;

const DEFAULT_COLLABORATION_URL = "ws://127.0.0.1:1234";
const DEFAULT_COLLABORATION_DOCUMENT = "lumen-demo";
const DEFAULT_COLLABORATION_FIELD = "default";
const COLLABORATION_COLORS = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
] as const;

const resolveQueryParam = (key: string) => {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const value = params.get(key);
  if (value == null) {
    return null;
  }
  return value.trim();
};

const readLocalStorage = (key: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value == null ? null : value.trim() || null;
  } catch (_error) {
    return null;
  }
};

const writeLocalStorage = (key: string, value: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (_error) {
    // Ignore storage failures in private mode or restricted environments.
  }
};

const resolveStoredValue = (key: string, fallbackFactory: () => string) => {
  const stored = readLocalStorage(key);
  if (stored) {
    return stored;
  }

  const fallback = fallbackFactory();
  writeLocalStorage(key, fallback);
  return fallback;
};

const resolvePermissionMode = (): "full" | "comment" | "readonly" => {
  const value = (resolveQueryParam("permissionMode") || "").toLowerCase();
  if (value === "comment") {
    return "comment";
  }
  if (value === "readonly" || value === "read-only" || value === "read_only") {
    return "readonly";
  }
  return "full";
};

const resolveBooleanParam = (key: string) => {
  const value = resolveQueryParam(key);
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};
const resolveHighContrast = () => {
  const contrast = (resolveQueryParam("contrast") || "").toLowerCase();
  if (contrast === "high") {
    return true;
  }
  if (contrast === "normal" || contrast === "default") {
    return false;
  }
  return resolveBooleanParam("highContrast");
};

const resolveNumberParam = (key: string, fallback: number) => {
  const raw = resolveQueryParam(key);
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const resolveWorkerEnabled = () => {
  const paginationWorkerParam = resolveQueryParam("paginationWorker");
  const workerUsedParam = resolveQueryParam("workerUsed");
  if (paginationWorkerParam != null || workerUsedParam != null) {
    return resolveBooleanParam("paginationWorker") || resolveBooleanParam("workerUsed");
  }
  return true;
};

const resolveCollaborationEnabled = () => {
  const flag = resolveQueryParam("collab");
  if (flag != null) {
    return resolveBooleanParam("collab");
  }

  return ["collabUrl", "collabDoc", "collabField", "collabToken", "collabUser", "collabColor"].some(
    (key) => resolveQueryParam(key) != null
  );
};

const resolveCollaborationUserName = () => {
  const explicit = resolveQueryParam("collabUser");
  if (explicit) {
    writeLocalStorage(STORAGE_KEYS.collaborationUserName, explicit);
    return explicit;
  }

  return resolveStoredValue(STORAGE_KEYS.collaborationUserName, () => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `User-${suffix}`;
  });
};

const resolveCollaborationUserColor = () => {
  const explicit = resolveQueryParam("collabColor");
  if (explicit) {
    writeLocalStorage(STORAGE_KEYS.collaborationUserColor, explicit);
    return explicit;
  }

  return resolveStoredValue(STORAGE_KEYS.collaborationUserColor, () => {
    const index = Math.floor(Math.random() * COLLABORATION_COLORS.length);
    return COLLABORATION_COLORS[index];
  });
};

export const createPlaygroundDebugFlags = (): PlaygroundDebugFlags => ({
  locale: resolvePlaygroundLocale(),
  highContrast: resolveHighContrast(),
  permissionMode: resolvePermissionMode(),
  enableInputRules: resolveBooleanParam("inputRules"),
  debugPerf: resolveBooleanParam("debugPerf"),
  debugGhostTrace: resolveBooleanParam("debugGhostTrace"),
  enablePaginationWorker: resolveWorkerEnabled(),
  forcePaginationWorker: resolveBooleanParam("paginationWorkerForce"),
  collaborationEnabled: resolveCollaborationEnabled(),
  collaborationUrl: resolveQueryParam("collabUrl") || DEFAULT_COLLABORATION_URL,
  collaborationDocument: resolveQueryParam("collabDoc") || DEFAULT_COLLABORATION_DOCUMENT,
  collaborationField: resolveQueryParam("collabField") || DEFAULT_COLLABORATION_FIELD,
  collaborationToken: resolveQueryParam("collabToken") || "",
  collaborationUserName: resolveCollaborationUserName(),
  collaborationUserColor: resolveCollaborationUserColor(),
});

export const createCanvasSettings = (
  debugPerf: boolean,
  debugGhostTrace = false,
  enablePaginationWorker = false,
  forcePaginationWorker = false,
  locale: PlaygroundLocale = "zh-CN",
  highContrast = false
) => {
  const incrementalEnabled = resolveBooleanParam("paginationIncremental")
    ? true
    : resolveBooleanParam("paginationIncrementalOff")
      ? false
      : true;
  const incrementalMaxPages = Math.max(4, Math.floor(resolveNumberParam("paginationMaxPages", 24)));
  const incrementalSettleDelayMs = Math.max(
    0,
    Math.floor(resolveNumberParam("paginationSettleMs", 120))
  );
  const pageReuseProbeRadius = Math.max(2, Math.floor(resolveNumberParam("pageReuseProbe", 8)));
  const pageReuseRootIndexProbeRadius = Math.max(
    0,
    Math.floor(resolveNumberParam("pageReuseRootProbe", 2))
  );
  const pageWidth = Math.max(480, Math.floor(resolveNumberParam("pageWidth", DEFAULT_PAGE_WIDTH)));
  const pageHeight = Math.max(640, Math.floor(resolveNumberParam("pageHeight", DEFAULT_PAGE_HEIGHT)));

  return {
    pageWidth,
    pageHeight,
    pageGap: DEFAULT_PAGE_GAP,
    margin: { ...DEFAULT_PAGE_MARGIN },
    lineHeight: 26,
    blockSpacing: 8,
    paragraphSpacingBefore: 0,
    paragraphSpacingAfter: 8,
    font: "16px Arial",
    textLocale: locale,
    highContrast,
    segmentText: createLinebreakSegmentText({ locale }),
    wrapTolerance: 2,
    pageBuffer: 1,
    maxPageCache: 32,
    debugPerf,
    debugGhostTrace,
    pageReuseProbeRadius,
    pageReuseRootIndexProbeRadius,
    disablePageReuse: false,
    // Lumen shell prefers crisp text over sub-pixel scaling smoothness.
    pixelRatioStrategy: "integer",
    paginationWorker: (enablePaginationWorker
      ? {
          enabled: true,
          mode: "experimental-runs",
          timeoutMs: 5000,
          force: forcePaginationWorker,
          useForDocChanged: true,
          useForInitial: false,
          incremental: {
            enabled: incrementalEnabled,
            maxPages: incrementalMaxPages,
            settleDelayMs: incrementalSettleDelayMs,
          },
        }
      : {
          enabled: false,
        }) as any,
  };
};
