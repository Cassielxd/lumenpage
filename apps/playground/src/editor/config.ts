import { createLinebreakSegmentText } from "lumenpage-view-runtime";

import { resolvePlaygroundLocale, type PlaygroundLocale } from "./i18n";

export type PlaygroundDebugFlags = {
  locale: PlaygroundLocale;
  highContrast: boolean;
  enableDevTools: boolean;
  permissionMode: "full" | "comment" | "readonly";
  debugAllSmoke: boolean;
  debugP0Smoke: boolean;
  debugTablePagination: boolean;
  debugTableSmoke: boolean;
  debugTableBehaviorSmoke: boolean;
  debugListSmoke: boolean;
  debugListBehaviorSmoke: boolean;
  debugPaginationRegressionSmoke: boolean;
  debugBlockOutlineSmoke: boolean;
  debugDragSmoke: boolean;
  debugDragActionSmoke: boolean;
  debugSelectionImeSmoke: boolean;
  debugImeActionSmoke: boolean;
  debugSelectionBoundarySmoke: boolean;
  debugToolSmoke: boolean;
  debugPasteSmoke: boolean;
  debugHistorySmoke: boolean;
  debugMappingSmoke: boolean;
  debugCoordsSmoke: boolean;
  debugScrollSmoke: boolean;
  debugReadonlySmoke: boolean;
  debugA11ySmoke: boolean;
  debugI18nSmoke: boolean;
  debugSecuritySmoke: boolean;
  debugDocRoundtripSmoke: boolean;
  debugMarkdownIoSmoke: boolean;
  debugHtmlIoSmoke: boolean;
  debugLinkSmoke: boolean;
  debugPerfBudgetSmoke: boolean;
  usePerfDoc: boolean;
  debugTimingLogs: boolean;
  debugLegacyConfigSmoke: boolean;
  debugDuplicateDecorations: boolean;
  enableInputRules: boolean;
  debugPerf: boolean;
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
  collaborationUserName: "lumenpage-playground-collab-user-name",
  collaborationUserColor: "lumenpage-playground-collab-user-color",
} as const;

const DEFAULT_COLLABORATION_URL = "ws://127.0.0.1:1234";
const DEFAULT_COLLABORATION_DOCUMENT = "playground-demo";
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
  return value == null ? null : value.trim();
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
  const value = resolveQueryParam("permissionMode");
  const normalized = (value || "").toLowerCase();
  if (normalized === "comment") {
    return "comment";
  }
  if (normalized === "readonly" || normalized === "read-only" || normalized === "read_only") {
    return "readonly";
  }
  return "full";
};

export const resolveDebugFlag = (key: string) => {
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
  return resolveDebugFlag("highContrast");
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
    return resolveDebugFlag("paginationWorker") || resolveDebugFlag("workerUsed");
  }
  return true;
};

const resolveCollaborationEnabled = () => {
  const flag = resolveQueryParam("collab");
  if (flag != null) {
    return resolveDebugFlag("collab");
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
  enableDevTools: resolveDebugFlag("devTools"),
  permissionMode: resolvePermissionMode(),
  debugAllSmoke: resolveDebugFlag("allSmoke"),
  debugP0Smoke: resolveDebugFlag("p0Smoke"),
  debugTablePagination: resolveDebugFlag("debugTablePagination"),
  debugTableSmoke: resolveDebugFlag("tableSmoke"),
  debugTableBehaviorSmoke: resolveDebugFlag("tableBehaviorSmoke"),
  debugListSmoke: resolveDebugFlag("listSmoke"),
  debugListBehaviorSmoke: resolveDebugFlag("listBehaviorSmoke"),
  debugPaginationRegressionSmoke: resolveDebugFlag("paginationRegressionSmoke"),
  debugBlockOutlineSmoke: resolveDebugFlag("blockOutlineSmoke"),
  debugDragSmoke: resolveDebugFlag("dragSmoke"),
  debugDragActionSmoke: resolveDebugFlag("dragActionSmoke"),
  debugSelectionImeSmoke: resolveDebugFlag("selectionImeSmoke"),
  debugImeActionSmoke: resolveDebugFlag("imeActionSmoke"),
  debugSelectionBoundarySmoke: resolveDebugFlag("selectionBoundarySmoke"),
  debugToolSmoke: resolveDebugFlag("toolSmoke"),
  debugPasteSmoke: resolveDebugFlag("pasteSmoke"),
  debugHistorySmoke: resolveDebugFlag("historySmoke"),
  debugMappingSmoke: resolveDebugFlag("mappingSmoke"),
  debugCoordsSmoke: resolveDebugFlag("coordsSmoke"),
  debugScrollSmoke: resolveDebugFlag("scrollSmoke"),
  debugReadonlySmoke: resolveDebugFlag("readonlySmoke"),
  debugA11ySmoke: resolveDebugFlag("a11ySmoke"),
  debugI18nSmoke: resolveDebugFlag("i18nSmoke"),
  debugSecuritySmoke: resolveDebugFlag("securitySmoke"),
  debugDocRoundtripSmoke: resolveDebugFlag("docRoundtripSmoke"),
  debugMarkdownIoSmoke: resolveDebugFlag("markdownIoSmoke"),
  debugHtmlIoSmoke: resolveDebugFlag("htmlIoSmoke"),
  debugLinkSmoke: resolveDebugFlag("linkSmoke"),
  debugPerfBudgetSmoke: resolveDebugFlag("perfBudgetSmoke"),
  usePerfDoc: resolveDebugFlag("perfDoc"),
  debugTimingLogs: resolveDebugFlag("timingLogs"),
  debugLegacyConfigSmoke: resolveDebugFlag("legacyConfigSmoke"),
  debugDuplicateDecorations: resolveDebugFlag("dupDecor"),
  enableInputRules: resolveDebugFlag("inputRules"),
  debugPerf: resolveDebugFlag("debugPerf"),
  enablePaginationWorker: resolveWorkerEnabled(),
  forcePaginationWorker: resolveDebugFlag("paginationWorkerForce"),
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
  enablePaginationWorker = false,
  forcePaginationWorker = false,
  locale: PlaygroundLocale = "zh-CN",
  highContrast = false
) => {
  const incrementalEnabled = resolveDebugFlag("paginationIncremental")
    ? true
    : resolveDebugFlag("paginationIncrementalOff")
      ? false
      : true;
  const incrementalMaxPages = Math.max(4, Math.floor(resolveNumberParam("paginationMaxPages", 24)));
  const incrementalSettleDelayMs = Math.max(0, Math.floor(resolveNumberParam("paginationSettleMs", 120)));
  const pageReuseProbeRadius = Math.max(2, Math.floor(resolveNumberParam("pageReuseProbe", 8)));
  const pageReuseRootIndexProbeRadius = Math.max(
    0,
    Math.floor(resolveNumberParam("pageReuseRootProbe", 2))
  );

  return {
    pageWidth: 794,
    pageHeight: 1123,
    pageGap: 24,
    margin: {
      top: 72,
      right: 72,
      bottom: 72,
      left: 72,
    },
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
    pageReuseProbeRadius,
    pageReuseRootIndexProbeRadius,
    disablePageReuse: false,
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
