import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "lumenpage-view-canvas": path.resolve(
        workspaceRoot,
        "packages/view-canvas/dist/index.js"
      ),
      "lumenpage-state": path.resolve(workspaceRoot, "packages/state/dist/index.js"),
      "lumenpage-commands": path.resolve(workspaceRoot, "packages/commands/dist/index.js"),
      "lumenpage-history": path.resolve(workspaceRoot, "packages/history/dist/index.js"),
      "lumenpage-model": path.resolve(workspaceRoot, "packages/model/dist/index.js"),
      "lumenpage-transform": path.resolve(workspaceRoot, "packages/transform/dist/index.js"),
      "lumenpage-view-types": path.resolve(workspaceRoot, "packages/view-types/dist/index.js"),
      "lumenpage-kit-basic": path.resolve(workspaceRoot, "packages/kit-basic/dist/index.js"),
      "lumenpage-node-paragraph": path.resolve(
        workspaceRoot,
        "packages/node-paragraph/dist/index.js"
      ),
      "lumenpage-node-heading": path.resolve(workspaceRoot, "packages/node-heading/dist/index.js"),
      "lumenpage-node-table": path.resolve(workspaceRoot, "packages/node-table/dist/index.js"),
      "lumenpage-node-list": path.resolve(workspaceRoot, "packages/node-list/dist/index.js"),
      "lumenpage-node-image": path.resolve(workspaceRoot, "packages/node-image/dist/index.js"),
      "lumenpage-node-video": path.resolve(workspaceRoot, "packages/node-video/dist/index.js"),
      "lumenpage-node-hard-break": path.resolve(workspaceRoot, "packages/node-hard-break/dist/index.js"),
      "lumenpage-node-horizontal-rule": path.resolve(workspaceRoot, "packages/node-horizontal-rule/dist/index.js"),
      "lumenpage-node-code-block": path.resolve(workspaceRoot, "packages/node-code-block/dist/index.js"),
      "lumenpage-node-blockquote": path.resolve(workspaceRoot, "packages/node-blockquote/dist/index.js"),
    },
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
  optimizeDeps: {
    exclude: [
      "lumenpage-view-canvas",
      "lumenpage-state",
      "lumenpage-commands",
      "lumenpage-history",
      "lumenpage-model",
      "lumenpage-transform",
      "lumenpage-view-types",
      "lumenpage-kit-basic",
      "lumenpage-node-paragraph",
      "lumenpage-node-heading",
      "lumenpage-node-table",
      "lumenpage-node-list",
      "lumenpage-node-image",
      "lumenpage-node-video",
      "lumenpage-node-blockquote",
      "lumenpage-node-code-block",
      "lumenpage-node-horizontal-rule",
      "lumenpage-node-hard-break",
    ],
  },
  build: {
    sourcemap: true,
  },
});
