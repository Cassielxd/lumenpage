export const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export const isGhostTraceEnabled = (settings: any) =>
  settings?.debugGhostTrace === true ||
  (typeof globalThis !== "undefined" &&
    (globalThis as typeof globalThis & { __lumenGhostTraceEnabled?: boolean })
      .__lumenGhostTraceEnabled === true);

const shouldEmitGhostTrace = (type: string, summary: Record<string, unknown>) => {
  if (type === "page-redraw") {
    return (
      summary?.pageRedrawn === true ||
      summary?.layoutVersionChanged === true ||
      summary?.forceRedraw === true ||
      summary?.forceDisplayListForVisualReuse === true ||
      String(summary?.cacheDisposition || "") !== "hit"
    );
  }
  if (type === "render-frame") {
    const cacheClearReasons = Array.isArray(summary?.cacheClearReasons)
      ? summary.cacheClearReasons
      : [];
    return (
      summary?.layoutVersionChanged === true ||
      summary?.forceRedraw === true ||
      Number(summary?.displayListBuiltPages || 0) > 0 ||
      Number(summary?.redrawPages || 0) > 0 ||
      cacheClearReasons.length > 0
    );
  }
  if (type === "node-overlay-sync") {
    return summary?.phase === "layout" || summary?.layoutChanged === true;
  }
  return true;
};

export const emitGhostTrace = (
  type: string,
  summary: Record<string, unknown>,
  settings: any
) => {
  if (!isGhostTraceEnabled(settings)) {
    return;
  }
  if (!shouldEmitGhostTrace(type, summary)) {
    return;
  }
  if (typeof globalThis === "undefined") {
    return;
  }
  const globalState = globalThis as typeof globalThis & {
    __lumenGhostTrace?: Array<Record<string, unknown>>;
    __copyLumenGhostTrace?: () => string;
  };
  const logs = Array.isArray(globalState.__lumenGhostTrace) ? globalState.__lumenGhostTrace : [];
  logs.push({
    type,
    timestamp: new Date().toISOString(),
    ...summary,
  });
  if (logs.length > 400) {
    logs.splice(0, logs.length - 400);
  }
  globalState.__lumenGhostTrace = logs;
  globalState.__copyLumenGhostTrace = () => JSON.stringify(logs, null, 2);
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[ghost-trace][${type}]`, summary);
  }
};
