import {
  PaginationWorkerClient,
  createWorkerPaginationRunsPayload,
  getWorkerPaginationIneligibleReason,
  isWorkerPaginationEligibleDoc,
} from "./paginationWorkerClient.js";

export type PaginationAsyncRequesterKind = "provider" | "runs-worker";

export type PaginationAsyncRequesterPayload = {
  doc: any;
  previousLayout: any;
  changeSummary: any;
  settings: any;
  registry: any;
  cascadePagination: boolean;
  cascadeFromPageIndex: number | null;
};

export type PaginationAsyncRequesterEligibility = {
  eligible: boolean;
  reason: string | null;
};

export type PaginationAsyncRequester = {
  kind: PaginationAsyncRequesterKind;
  requestLayout: (payload: PaginationAsyncRequesterPayload, timeoutMs: number) => Promise<any>;
  getEligibility: (doc: any, registry: any) => PaginationAsyncRequesterEligibility;
  destroy?: () => void;
};

type PaginationWorkerProviderLike = {
  requestLayout: (payload: any) => Promise<any> | any;
  destroy?: () => void;
};

const createProviderRequester = (
  provider: PaginationWorkerProviderLike
): PaginationAsyncRequester => ({
  kind: "provider",
  requestLayout: (payload) => Promise.resolve(provider.requestLayout(payload)),
  getEligibility: () => ({
    eligible: true,
    reason: null,
  }),
  destroy: () => {
    provider.destroy?.();
  },
});

const createRunsWorkerRequester = (): PaginationAsyncRequester => {
  const workerClient = new PaginationWorkerClient();
  return {
    kind: "runs-worker",
    requestLayout: (payload, timeoutMs) =>
      workerClient.requestLayout(
        createWorkerPaginationRunsPayload(payload.doc, payload.settings, payload.registry),
        timeoutMs
      ),
    getEligibility: (doc, registry) => ({
      eligible: isWorkerPaginationEligibleDoc(doc, registry),
      reason: getWorkerPaginationIneligibleReason(doc, registry),
    }),
    destroy: () => {
      workerClient.destroy();
    },
  };
};

export const resolvePaginationAsyncRequester = (
  workerConfig: any
): PaginationAsyncRequester | null => {
  if (workerConfig?.enabled !== true) {
    return null;
  }

  if (typeof workerConfig?.provider?.requestLayout === "function") {
    return createProviderRequester(workerConfig.provider);
  }

  if (workerConfig?.mode === "experimental-runs" || workerConfig?.mode === undefined) {
    return createRunsWorkerRequester();
  }

  return null;
};
