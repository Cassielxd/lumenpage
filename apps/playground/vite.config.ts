import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "lumenpage-core": path.resolve(workspaceRoot, "packages/core/src/index.ts"),
      "lumenpage-view-canvas": path.resolve(workspaceRoot, "packages/view-canvas/src/index.ts"),
      "lumenpage-kit-basic": path.resolve(workspaceRoot, "packages/kit-basic/src/index.ts"),
      "lumenpage-node-paragraph": path.resolve(
        workspaceRoot,
        "packages/node-paragraph/src/index.ts"
      ),
      "lumenpage-node-heading": path.resolve(workspaceRoot, "packages/node-heading/src/index.ts"),
      "lumenpage-node-table": path.resolve(workspaceRoot, "packages/node-table/src/index.ts"),
    },
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
  optimizeDeps: {
    exclude: [
      "lumenpage-core",
      "lumenpage-view-canvas",
      "lumenpage-kit-basic",
      "lumenpage-node-paragraph",
      "lumenpage-node-heading",
      "lumenpage-node-table",
    ],
  },
  build: {
    sourcemap: true,
  },
});
