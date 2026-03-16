import { attachExtensionPaginationDocWorker } from "lumenpage-core";

import { playgroundDocumentExtensions } from "./documentExtensions";

attachExtensionPaginationDocWorker({
  workerScope: self as any,
  extensions: playgroundDocumentExtensions,
});
