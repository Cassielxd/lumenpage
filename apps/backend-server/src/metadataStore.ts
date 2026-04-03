import fs from "node:fs/promises";
import path from "node:path";
import type { BackendDatabase, BackendMetadataDriver, RuntimeConfig } from "./types.js";

const DEFAULT_DB: BackendDatabase = {
  version: 1,
  users: [],
  sessions: [],
  documents: [],
  memberships: [],
  shareLinks: [],
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface BackendMetadataStore {
  readonly driver: BackendMetadataDriver;
  read: () => Promise<BackendDatabase>;
  transact: <T>(mutator: (data: BackendDatabase) => Promise<T> | T) => Promise<T>;
}

const createJsonMetadataStore = ({ filePath }: { filePath: string }): BackendMetadataStore => {
  let state: BackendDatabase | null = null;
  let writeQueue = Promise.resolve();

  const ensureLoaded = async (): Promise<BackendDatabase> => {
    if (state) {
      return state;
    }

    try {
      const raw = await fs.readFile(filePath, "utf8");
      state = {
        ...clone(DEFAULT_DB),
        ...(JSON.parse(raw) as Partial<BackendDatabase>),
      };
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        throw error;
      }

      state = clone(DEFAULT_DB);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(state, null, 2));
      return state;
    }
  };

  const persist = async (nextState: BackendDatabase) => {
    state = nextState;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2));
  };

  return {
    driver: "json",
    async read() {
      return clone(await ensureLoaded());
    },
    async transact<T>(mutator: (data: BackendDatabase) => Promise<T> | T) {
      const operation = writeQueue.then(async () => {
        const current = clone(await ensureLoaded());
        const result = await mutator(current);
        await persist(current);
        return result;
      });

      writeQueue = operation.then(
        () => undefined,
        () => undefined,
      );

      return operation;
    },
  };
};

export const createBackendMetadataStore = (config: RuntimeConfig): BackendMetadataStore => {
  if (config.metadataDriver === "json") {
    return createJsonMetadataStore({
      filePath: config.metadataFilePath,
    });
  }

  throw new Error(
    `Unsupported metadata driver "${config.metadataDriver}". ` +
      "Use BACKEND_METADATA_DRIVER=json for now, or implement a database-backed adapter.",
  );
};
