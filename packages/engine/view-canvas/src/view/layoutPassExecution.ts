import { now } from "./debugTrace.js";
import {
  type PaginationAsyncRequester,
  type PaginationAsyncRequesterKind,
} from "./paginationRequester.js";

type ResolveLayoutExecutionStrategyArgs = {
  doc: any;
  prevLayout: any;
  changeSummary: any;
  layoutPipeline: any;
  workerConfig: any;
  paginationRequester: PaginationAsyncRequester | null;
  forceSyncLayoutOnce: boolean;
  useCascadePagination: boolean;
  runForceFullPass: boolean;
};

export type ResolvedLayoutExecutionStrategy = {
  workerIneligibleReason: string | null;
  asyncRequesterKind: PaginationAsyncRequesterKind | null;
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
  paginationRequester: PaginationAsyncRequester | null;
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
  paginationRequester,
  forceSyncLayoutOnce,
  useCascadePagination,
  runForceFullPass,
}: ResolveLayoutExecutionStrategyArgs): ResolvedLayoutExecutionStrategy => {
  const docChanged = changeSummary?.docChanged === true;
  const allowWorkerForDocChanged = workerConfig?.useForDocChanged === true;
  const allowWorkerForInitial = workerConfig?.useForInitial === true;
  const requesterEligibility = paginationRequester?.getEligibility(doc, layoutPipeline?.registry) ?? {
    eligible: false,
    reason: null,
  };
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
    workerIneligibleReason: requesterEligibility.reason,
    asyncRequesterKind:
      !preferSyncIncrementalPass &&
      !forceSyncLayoutOnce &&
      !!paginationRequester &&
      requesterEligibility.eligible &&
      workerAllowedForPass
        ? paginationRequester.kind
        : null,
    preferSyncIncrementalPass,
    canUseWorkerProvider:
      !preferSyncIncrementalPass &&
      !forceSyncLayoutOnce &&
      paginationRequester?.kind === "provider" &&
      workerAllowedForPass,
    canUseWorker:
      !preferSyncIncrementalPass &&
      !forceSyncLayoutOnce &&
      paginationRequester?.kind === "runs-worker" &&
      requesterEligibility.eligible &&
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
  paginationRequester,
  workerTimeoutMs,
  onResolvedLayout,
  onAsyncSettled,
}: ExecuteLayoutPassArgs) => {
  if (strategy.asyncRequesterKind && paginationRequester) {
    const workerStartedAt = now();
    const requesterPayload = {
      doc,
      previousLayout: prevLayout ?? null,
      changeSummary,
      settings: layoutSettingsForPass,
      registry: layoutPipeline?.registry,
      cascadePagination: useCascadePagination,
      cascadeFromPageIndex,
    };
    const source = strategy.asyncRequesterKind === "provider" ? "worker-provider" : "worker";
    const fallbackSource =
      strategy.asyncRequesterKind === "provider" ? "worker-provider-fallback" : "worker-fallback";
    Promise.resolve(paginationRequester.requestLayout(requesterPayload, workerTimeoutMs))
      .then((layout) => {
        if (!layout) {
          throw new Error("async-requester-empty-layout");
        }
        onResolvedLayout(layout, source, now() - workerStartedAt);
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
        onResolvedLayout(fallbackLayout, fallbackSource, now() - fallbackStartedAt);
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
