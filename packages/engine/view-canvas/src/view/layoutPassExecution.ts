import { now } from "./debugTrace";
import {
  PaginationWorkerClient,
  createWorkerPaginationRunsPayload,
  getWorkerPaginationIneligibleReason,
  isWorkerPaginationEligibleDoc,
} from "./paginationWorkerClient";

type PaginationWorkerProviderLike = {
  requestLayout: (payload: any) => Promise<any> | any;
};

type ResolveLayoutExecutionStrategyArgs = {
  doc: any;
  prevLayout: any;
  changeSummary: any;
  layoutPipeline: any;
  workerConfig: any;
  paginationWorkerProvider: PaginationWorkerProviderLike | null;
  paginationWorker: PaginationWorkerClient | null;
  forceSyncLayoutOnce: boolean;
  useCascadePagination: boolean;
  runForceFullPass: boolean;
};

export type ResolvedLayoutExecutionStrategy = {
  workerIneligibleReason: string | null;
  canUseWorkerProvider: boolean;
  canUseWorker: boolean;
  preferSyncIncrementalPass: boolean;
};

type ExecuteLayoutPassArgs = {
  strategy: ResolvedLayoutExecutionStrategy;
  doc: any;
  prevLayout: any;
  changeSummary: any;
  layoutSettingsForPass: any;
  layoutPipeline: any;
  docPosToTextOffset: (doc: any, pos: number) => number;
  useCascadePagination: boolean;
  cascadeFromPageIndex: number | null;
  paginationWorkerProvider: PaginationWorkerProviderLike | null;
  paginationWorker: PaginationWorkerClient | null;
  workerTimeoutMs: number;
  onResolvedLayout: (layout: any, source: string, computeMs: number) => void;
  onAsyncSettled: () => void;
};

const buildLayoutFromDoc = ({
  doc,
  prevLayout,
  changeSummary,
  layoutSettingsForPass,
  layoutPipeline,
  docPosToTextOffset,
  useCascadePagination,
  cascadeFromPageIndex,
}: {
  doc: any;
  prevLayout: any;
  changeSummary: any;
  layoutSettingsForPass: any;
  layoutPipeline: any;
  docPosToTextOffset: (doc: any, pos: number) => number;
  useCascadePagination: boolean;
  cascadeFromPageIndex: number | null;
}) =>
  layoutPipeline.layoutFromDoc(doc, {
    previousLayout: prevLayout ?? null,
    changeSummary,
    docPosToTextOffset,
    layoutSettingsOverride: layoutSettingsForPass,
    cascadePagination: useCascadePagination,
    cascadeFromPageIndex,
    perf: {},
  });

export const resolveLayoutExecutionStrategy = ({
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
}: ResolveLayoutExecutionStrategyArgs): ResolvedLayoutExecutionStrategy => {
  const docChanged = changeSummary?.docChanged === true;
  const allowWorkerForDocChanged = workerConfig?.useForDocChanged === true;
  const allowWorkerForInitial = workerConfig?.useForInitial === true;
  const workerIneligibleReason = getWorkerPaginationIneligibleReason(doc, layoutPipeline?.registry);
  const isEligible = isWorkerPaginationEligibleDoc(doc, layoutPipeline?.registry);
  const isInitialLayoutPass = !prevLayout;
  const workerAllowedForPass = docChanged
    ? allowWorkerForDocChanged
    : !isInitialLayoutPass || allowWorkerForInitial;
  const preferSyncIncrementalPass =
    docChanged === true &&
    !!prevLayout &&
    useCascadePagination === true &&
    runForceFullPass !== true;

  return {
    workerIneligibleReason,
    preferSyncIncrementalPass,
    canUseWorkerProvider:
      !preferSyncIncrementalPass &&
      !forceSyncLayoutOnce &&
      !!paginationWorkerProvider &&
      workerAllowedForPass,
    canUseWorker:
      !preferSyncIncrementalPass &&
      !forceSyncLayoutOnce &&
      !!paginationWorker &&
      isEligible &&
      workerAllowedForPass,
  };
};

export const executeLayoutPass = ({
  strategy,
  doc,
  prevLayout,
  changeSummary,
  layoutSettingsForPass,
  layoutPipeline,
  docPosToTextOffset,
  useCascadePagination,
  cascadeFromPageIndex,
  paginationWorkerProvider,
  paginationWorker,
  workerTimeoutMs,
  onResolvedLayout,
  onAsyncSettled,
}: ExecuteLayoutPassArgs) => {
  if (strategy.canUseWorkerProvider && paginationWorkerProvider) {
    const workerStartedAt = now();
    const providerPayload = {
      doc,
      previousLayout: prevLayout ?? null,
      changeSummary,
      settings: layoutSettingsForPass,
      registry: layoutPipeline?.registry,
      cascadePagination: useCascadePagination,
      cascadeFromPageIndex,
    };
    Promise.resolve(paginationWorkerProvider.requestLayout(providerPayload))
      .then((layout) => {
        if (!layout) {
          throw new Error("provider-empty-layout");
        }
        onResolvedLayout(layout, "worker-provider", now() - workerStartedAt);
      })
      .catch(() => {
        const fallbackStartedAt = now();
        const fallbackLayout = buildLayoutFromDoc({
          doc,
          prevLayout,
          changeSummary,
          layoutSettingsForPass,
          layoutPipeline,
          docPosToTextOffset,
          useCascadePagination,
          cascadeFromPageIndex,
        });
        onResolvedLayout(
          fallbackLayout,
          "worker-provider-fallback",
          now() - fallbackStartedAt
        );
      })
      .finally(onAsyncSettled);
    return "async";
  }

  if (strategy.canUseWorker && paginationWorker) {
    const workerStartedAt = now();
    const payload = createWorkerPaginationRunsPayload(
      doc,
      layoutSettingsForPass,
      layoutPipeline?.registry
    );
    paginationWorker
      .requestLayout(payload, workerTimeoutMs)
      .then((layout) => {
        onResolvedLayout(layout, "worker", now() - workerStartedAt);
      })
      .catch(() => {
        const fallbackStartedAt = now();
        const fallbackLayout = buildLayoutFromDoc({
          doc,
          prevLayout,
          changeSummary,
          layoutSettingsForPass,
          layoutPipeline,
          docPosToTextOffset,
          useCascadePagination,
          cascadeFromPageIndex,
        });
        onResolvedLayout(fallbackLayout, "worker-fallback", now() - fallbackStartedAt);
      })
      .finally(onAsyncSettled);
    return "async";
  }

  const syncStartedAt = now();
  const layout = buildLayoutFromDoc({
    doc,
    prevLayout,
    changeSummary,
    layoutSettingsForPass,
    layoutPipeline,
    docPosToTextOffset,
    useCascadePagination,
    cascadeFromPageIndex,
  });
  onResolvedLayout(layout, "sync", now() - syncStartedAt);
  return "sync";
};
