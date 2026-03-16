import { attachExtensionPaginationDocWorker } from "lumenpage-core";

import { lumenDocumentExtensions } from "./documentExtensions";

attachExtensionPaginationDocWorker({
  workerScope: self as any,
  extensions: lumenDocumentExtensions,
});
