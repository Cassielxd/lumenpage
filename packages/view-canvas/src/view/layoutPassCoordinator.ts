import { executeLayoutPass, resolveLayoutExecutionStrategy } from "./layoutPassExecution";
import {
  getLayoutSettingsSignature,
  resolveCascadePaginationPlan,
  resolveLayoutSettingsForPass,
} from "./layoutPassPlanning";
import { applyResolvedLayoutAndReport } from "./layoutPassReporting";
import { PaginationWorkerClient } from "./paginationWorkerClient";
import { createProgressiveLayoutController } from "./progressiveLayoutController";
import { now } from "./debugTrace";

type CreateLayoutPassCoordinatorArgs = {
  getEditorState: () => any;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getPendingChangeSummary?: () => any;
  clearPendingChangeSummary?: () => void;
  clearPendingSteps?: () => void;
  resolvePageWidth?: () => number;
  layoutPipeline: any;
  docPosToTextOffset: (doc: any, pos: number) => number;
  clampOffset: (offset: number) => number;
  emitPerfLog: (type: string, summary: Record<string, unknown>) => void;
  onSkipLayoutPass: () => void;
  onApplyLayout: (args: {
    layout: any;
    version: number;
    changeSummary: any;
    isLayoutProgressive: boolean;
  }) => void;
  onAfterLayoutPass: () => void;
};

export const createLayoutPassCoordinator = ({
  getEditorState,
  getLayout,
  getLayoutIndex,
  getPendingChangeSummary,
  clearPendingChangeSummary,
  clearPendingSteps,
  resolvePageWidth,
  layoutPipeline,
  docPosToTextOffset,
  clampOffset,
  emitPerfLog,
  onSkipLayoutPass,
  onApplyLayout,
  onAfterLayoutPass,
}: CreateLayoutPassCoordinatorArgs) => {
  let layoutVersion = 0;
  let layoutRafId = 0;
  let asyncLayoutInFlight = false;
  let asyncLayoutQueued = false;
  let lastLayoutSettingsSignature: string | null = null;
  let scheduleLayout = () => {};

  const workerConfig = layoutPipeline?.settings?.paginationWorker ?? null;
  const useWorkerByDefault = workerConfig?.enabled !== false;
  const paginationWorkerProvider =
    workerConfig?.enabled === true && typeof workerConfig?.provider?.requestLayout === "function"
      ? workerConfig.provider
      : null;
  const paginationWorker =
    useWorkerByDefault &&
    (workerConfig?.mode === "experimental-runs" || workerConfig?.mode === undefined) &&
    !paginationWorkerProvider
      ? new PaginationWorkerClient()
      : null;

  const hasPendingLayoutWork = () => layoutRafId !== 0 || asyncLayoutInFlight || asyncLayoutQueued;

  const progressiveLayoutController = createProgressiveLayoutController({
    getLayout,
    hasPendingLayoutWork,
    requestLayoutPass: () => scheduleLayout(),
  });

  const updateLayout = () => {
    const passStartedAt = now();
    const changeSummary = getPendingChangeSummary?.() ?? null;
    const nextPageWidth = resolvePageWidth?.();
    const layoutSettingsForPass = resolveLayoutSettingsForPass(layoutPipeline?.settings, nextPageWidth);
    const layoutSettingsSignature = getLayoutSettingsSignature(layoutSettingsForPass);
    const settingsChanged = layoutSettingsSignature !== lastLayoutSettingsSignature;
    const prevLayout = getLayout?.() ?? null;

    if (prevLayout && !settingsChanged && changeSummary?.docChanged !== true) {
      clearPendingChangeSummary?.();
      clearPendingSteps?.();
      onSkipLayoutPass();
      return;
    }

    if (settingsChanged) {
      layoutPipeline.clearCache?.();
    }

    const doc = getEditorState().doc;
    const docChanged = changeSummary?.docChanged === true;
    let forceSyncLayoutOnce = false;
    try {
      forceSyncLayoutOnce = (globalThis as any).__lumenForceSyncLayoutOnce === true;
      if (forceSyncLayoutOnce) {
        (globalThis as any).__lumenForceSyncLayoutOnce = false;
      }
    } catch (_error) {
      forceSyncLayoutOnce = false;
    }

    const workerConfigIncremental = layoutPipeline?.settings?.paginationWorker?.incremental;
    const incrementalEnabled = workerConfigIncremental !== false;
    const runForceFullPass = progressiveLayoutController.consumeForceFullPass();
    const settleDelayMs = Number.isFinite(workerConfigIncremental?.settleDelayMs)
      ? Math.max(120, Number(workerConfigIncremental?.settleDelayMs))
      : 120;

    if (docChanged) {
      progressiveLayoutController.onDocChanged(passStartedAt);
    }

    const { cascadeFromPageIndex, useCascadePagination } = resolveCascadePaginationPlan({
      prevLayout,
      docChanged,
      incrementalEnabled,
      runForceFullPass,
      editorState: getEditorState(),
      doc,
      clampOffset,
      docPosToTextOffset,
      getLayoutIndex,
    });

    const executionStrategy = resolveLayoutExecutionStrategy({
      doc,
      prevLayout,
      changeSummary,
      layoutPipeline,
      workerConfig,
      paginationWorkerProvider,
      paginationWorker,
      forceSyncLayoutOnce,
      useCascadePagination,
      runForceFullPass,
    });
    const { workerIneligibleReason, canUseWorkerProvider, canUseWorker, preferSyncIncrementalPass } =
      executionStrategy;

    if ((canUseWorkerProvider || canUseWorker) && asyncLayoutInFlight) {
      asyncLayoutQueued = true;
      return;
    }

    const version = (layoutVersion += 1);
    clearPendingChangeSummary?.();
    clearPendingSteps?.();
    const isLayoutProgressive = useCascadePagination && prevLayout && prevLayout.pages.length > 1;

    const applyAndLogLayout = (layout: any, source = "sync", computeMs: number | null = null) =>
      applyResolvedLayoutAndReport({
        layout,
        source,
        computeMs,
        version,
        doc,
        passStartedAt,
        changeSummary,
        isLayoutProgressive,
        docChanged,
        settingsChanged,
        useCascadePagination,
        cascadeFromPageIndex,
        preferSyncIncrementalPass,
        canUseWorkerProvider,
        canUseWorker,
        workerIneligibleReason,
        prevLayout,
        getEditorState,
        emitPerfLog,
        onApplyLayout,
        layoutPipeline,
        progressiveLayoutController,
        incrementalEnabled,
        settleDelayMs,
        layoutSettingsSignature,
        setLastLayoutSettingsSignature: (value) => {
          lastLayoutSettingsSignature = value;
        },
      });

    const runPass = () =>
      executeLayoutPass({
        strategy: executionStrategy,
        doc,
        prevLayout: getLayout?.() ?? null,
        changeSummary,
        layoutSettingsForPass,
        layoutPipeline,
        docPosToTextOffset,
        useCascadePagination,
        cascadeFromPageIndex,
        paginationWorkerProvider,
        paginationWorker,
        workerTimeoutMs: Number(workerConfig?.timeoutMs) || 5000,
        onResolvedLayout: applyAndLogLayout,
        onAsyncSettled: () => {
          asyncLayoutInFlight = false;
          if (asyncLayoutQueued) {
            asyncLayoutQueued = false;
            scheduleLayout();
          }
          onAfterLayoutPass();
        },
      });

    if (canUseWorkerProvider || canUseWorker) {
      asyncLayoutInFlight = true;
      runPass();
      return;
    }

    runPass();
  };

  scheduleLayout = () => {
    if (layoutRafId) {
      return;
    }
    layoutRafId = requestAnimationFrame(() => {
      layoutRafId = 0;
      updateLayout();
      onAfterLayoutPass();
    });
  };

  return {
    updateLayout,
    scheduleLayout,
    isPending: hasPendingLayoutWork,
    getVersion: () => layoutVersion,
    destroy: () => {
      progressiveLayoutController.destroy();
      paginationWorker?.destroy?.();
      paginationWorkerProvider?.destroy?.();
    },
  };
};
