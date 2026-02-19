import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const useSrc = mode !== "production";
  const entry = (pkg: string) =>
    path.resolve(workspaceRoot, `packages/${pkg}/${useSrc ? "src/index.ts" : "dist/index.js"}`);

  return {
    plugins: [vue()],
    worker: { format: "es" },
    resolve: {
      alias: {
        "lumenpage-view-canvas": entry("view-canvas"),
        "lumenpage-state": entry("state"),
        "lumenpage-commands": entry("commands"),
        "lumenpage-history": entry("history"),
        "lumenpage-keymap": entry("keymap"),
        "lumenpage-model": entry("model"),
        "lumenpage-transform": entry("transform"),
        "lumenpage-view-types": entry("view-types"),
        "lumenpage-kit-basic": entry("kit-basic"),
        "lumenpage-inputrules": entry("inputrules"),
        "lumenpage-gapcursor": entry("gapcursor"),
        "lumenpage-collab": entry("collab"),
        "lumenpage-node-paragraph": entry("node-paragraph"),
        "lumenpage-node-heading": entry("node-heading"),
        "lumenpage-node-table": entry("node-table"),
        "lumenpage-node-list": entry("node-list"),
        "lumenpage-node-image": entry("node-image"),
        "lumenpage-node-video": entry("node-video"),
        "lumenpage-node-hard-break": entry("node-hard-break"),
        "lumenpage-node-horizontal-rule": entry("node-horizontal-rule"),
        "lumenpage-node-code-block": entry("node-code-block"),
        "lumenpage-node-blockquote": entry("node-blockquote"),
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
        "lumenpage-keymap",
        "lumenpage-model",
        "lumenpage-transform",
        "lumenpage-view-types",
        "lumenpage-kit-basic",
        "lumenpage-inputrules",
        "lumenpage-gapcursor",
        "lumenpage-collab",
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
  };
});
