export const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export const isGhostTraceEnabled = (settings: any) =>
  settings?.debugGhostTrace === true ||
  (typeof globalThis !== "undefined" &&
    (globalThis as typeof globalThis & { __lumenGhostTraceEnabled?: boolean })
      .__lumenGhostTraceEnabled === true);

export const emitGhostTrace = (
  type: string,
  summary: Record<string, unknown>,
  settings: any
) => {
  if (!isGhostTraceEnabled(settings)) {
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
