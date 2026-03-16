/**
 * 判断是否开启 ghost trace 调试，用于排查页复用与同步问题。
 */
export function isGhostTraceEnabled(settings: any) {
  return (
    settings?.debugGhostTrace === true ||
    (typeof globalThis !== "undefined" &&
      (globalThis as typeof globalThis & { __lumenGhostTraceEnabled?: boolean })
        .__lumenGhostTraceEnabled === true)
  );
}

/**
 * 追加一条 ghost trace 事件，并限制调试记录的最大长度。
 */
export function appendGhostTrace(trace: any[] | null, event: any) {
  if (!Array.isArray(trace)) {
    return;
  }
  trace.push(event);
  if (trace.length > 80) {
    trace.splice(0, trace.length - 80);
  }
}
