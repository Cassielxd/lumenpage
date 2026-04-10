type CreateRenderSyncPerfLogArgs = {
  layoutPipeline: any;
};

export const createRenderSyncPerfLog = ({ layoutPipeline }: CreateRenderSyncPerfLogArgs) => {
  const emitPerfLog = (type: string, summary: Record<string, unknown>) => {
    if (layoutPipeline?.settings?.debugPerf !== true) {
      return;
    }
    const totalPassMs =
      type === "layout-pass" && Number.isFinite(summary?.totalPassMs)
        ? Number(summary.totalPassMs)
        : 0;
    const totalApplyMs =
      type === "layout-apply" && Number.isFinite(summary?.totalApplyMs)
        ? Number(summary.totalApplyMs)
        : 0;
    const shouldConsoleLog =
      (type === "layout-pass" && totalPassMs >= 50) ||
      (type === "layout-apply" && totalApplyMs >= 8);
    if (shouldConsoleLog) {
      console.info(`[perf][${type}]`, summary);
    }
    if (typeof window !== "undefined") {
      const globalWindow = window as typeof window & {
        __lumenPerfLogs?: Array<Record<string, unknown>>;
        __copyLumenPerfLogs?: () => string;
      };
      const logs = Array.isArray(globalWindow.__lumenPerfLogs) ? globalWindow.__lumenPerfLogs : [];
      logs.push({
        type,
        timestamp: new Date().toISOString(),
        ...summary,
      });
      if (logs.length > 400) {
        logs.splice(0, logs.length - 400);
      }
      globalWindow.__lumenPerfLogs = logs;
      globalWindow.__copyLumenPerfLogs = () => JSON.stringify(logs, null, 2);
    }
  };

  return {
    emitPerfLog,
  };
};
