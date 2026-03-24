import { createNodeRegistry } from "lumenpage-layout-engine";
import {
  attachPaginationDocWorker,
  type PaginationDocWorkerRequest,
  type PaginationDocWorkerResponse,
} from "lumenpage-view-canvas/core";
import { docPosToTextOffset } from "lumenpage-view-canvas/mapping";

import { createSchema } from "./createSchema";
import { ExtensionManager } from "./ExtensionManager";
import type { AnyExtensionInput } from "./types";

type WorkerScopeLike = {
  onmessage: ((event: MessageEvent<PaginationDocWorkerRequest>) => void) | null;
  postMessage: (message: PaginationDocWorkerResponse) => void;
};

type AttachExtensionPaginationDocWorkerArgs = {
  workerScope: WorkerScopeLike;
  extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput;
};

export const attachExtensionPaginationDocWorker = ({
  workerScope,
  extensions,
}: AttachExtensionPaginationDocWorkerArgs) => {
  const extensionManager = new ExtensionManager(extensions);
  const resolvedStructure = extensionManager.resolveStructure();
  const schema = createSchema(resolvedStructure);

  return attachPaginationDocWorker({
    workerScope,
    schema,
    createNodeRendererRegistry: () => createNodeRegistry(resolvedStructure),
    docPosToTextOffset,
  });
};

export type { PaginationDocWorkerRequest, PaginationDocWorkerResponse };
