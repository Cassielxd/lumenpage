import { executeLayoutPass } from "./layoutPassExecution";
import { resolveLayoutPassPlan } from "./layoutPassPlan";
import { applyResolvedLayoutAndReport } from "./layoutPassReporting";
import { resolvePaginationAsyncRequester } from "./paginationRequester";
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
  const paginationRequester = resolvePaginationAsyncRequester(workerConfig);

  const hasPendingLayoutWork = () => layoutRafId !== 0 || asyncLayoutInFlight || asyncLayoutQueued;

  const progressiveLayoutController = createProgressiveLayoutController({
    getLayout,
    hasPendingLayoutWork,
    requestLayoutPass: () => scheduleLayout(),
  });

  const updateLayout = () => {
    const passStartedAt = now();
    const changeSummary = getPendingChangeSummary?.() ?? null;
    const runForceFullPass = progressiveLayoutController.consumeForceFullPass();
    const prevLayout = getLayout?.() ?? null;
    const prevLayoutIndex = getLayoutIndex?.() ?? null;
    const editorState = getEditorState();
    const nextPageWidth = resolvePageWidth?.();

    let forceSyncLayoutOnce = false;
    try {
      forceSyncLayoutOnce = (globalThis as any).__lumenForceSyncLayoutOnce === true;
      if (forceSyncLayoutOnce) {
        (globalThis as any).__lumenForceSyncLayoutOnce = false;
      }
    } catch (_error) {
      forceSyncLayoutOnce = false;
    }

    const plan = resolveLayoutPassPlan({
      editorState,
      prevLayout,
      prevLayoutIndex,
      changeSummary,
      runForceFullPass,
      forceSyncLayoutOnce,
      resolvedPageWidth: nextPageWidth,
      lastLayoutSettingsSignature,
      layoutPipeline,
      workerConfig,
      paginationRequester,
      docPosToTextOffset,
      clampOffset,
    });

    if (plan.kind === "skip") {
      clearPendingChangeSummary?.();
      clearPendingSteps?.();
      onSkipLayoutPass();
      return;
    }

    const layoutSettingsForPass = plan.layoutSettingsForPass;
    const layoutSettingsSignature = plan.layoutSettingsSignature;
    const settingsChanged = plan.settingsChanged;
    const doc = plan.doc;
    const docChanged = plan.docChanged;
    const incrementalEnabled = plan.incrementalEnabled;
    const settleDelayMs = plan.settleDelayMs;
    const cascadeFromPageIndex = plan.cascadeFromPageIndex;
    const useCascadePagination = plan.useCascadePagination;
    const isLayoutProgressive = plan.isLayoutProgressive;
    const executionStrategy = plan.executionStrategy;

    if (settingsChanged) {
      layoutPipeline.clearCache?.();
    }

    if (docChanged) {
      progressiveLayoutController.onDocChanged(passStartedAt);
    }
    const { workerIneligibleReason, canUseWorkerProvider, canUseWorker, preferSyncIncrementalPass } =
      executionStrategy;

    if ((canUseWorkerProvider || canUseWorker) && asyncLayoutInFlight) {
      asyncLayoutQueued = true;
      return;
    }

    const version = (layoutVersion += 1);
    clearPendingChangeSummary?.();
    clearPendingSteps?.();

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
        prevLayout,
        changeSummary,
        layoutSettingsForPass,
        layoutPipeline,
        docPosToTextOffset,
        useCascadePagination,
        cascadeFromPageIndex,
        paginationRequester,
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
      paginationRequester?.destroy?.();
    },
  };
};
