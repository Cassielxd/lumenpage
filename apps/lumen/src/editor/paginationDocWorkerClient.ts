import { PaginationDocWorkerClient as CorePaginationDocWorkerClient } from "lumenpage-core";

export class PaginationDocWorkerClient extends CorePaginationDocWorkerClient {
  constructor() {
    super(new URL("./paginationDoc.worker.ts", import.meta.url));
  }
}
