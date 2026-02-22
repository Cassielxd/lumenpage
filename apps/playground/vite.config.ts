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
  const entryPath = (pkg: string, file: string) =>
    path.resolve(workspaceRoot, `packages/${pkg}/${useSrc ? `src/${file}` : `dist/${file}`}`);

  return {
    plugins: [vue()],
    resolve: {
      alias: [
        { find: /^lumenpage-view-canvas$/, replacement: entry("view-canvas") },
        { find: /^lumenpage-state$/, replacement: entry("state") },
        { find: /^lumenpage-commands$/, replacement: entry("commands") },
        { find: /^lumenpage-history$/, replacement: entry("history") },
        { find: /^lumenpage-keymap$/, replacement: entry("keymap") },
        { find: /^lumenpage-model$/, replacement: entry("model") },
        { find: /^lumenpage-transform$/, replacement: entry("transform") },
        { find: /^lumenpage-view-types$/, replacement: entry("view-types") },
        { find: /^lumenpage-kit-basic$/, replacement: entry("kit-basic") },
        { find: /^lumenpage-inputrules$/, replacement: entry("inputrules") },
        { find: /^lumenpage-gapcursor$/, replacement: entry("gapcursor") },
        { find: /^lumenpage-collab$/, replacement: entry("collab") },
        { find: /^lumenpage-drag-handle$/, replacement: entry("drag-handle") },
        { find: /^lumenpage-plugin-active-block$/, replacement: entry("plugin-active-block") },
        { find: /^lumenpage-node-paragraph$/, replacement: entry("node-paragraph") },
        { find: /^lumenpage-node-heading$/, replacement: entry("node-heading") },
        { find: /^lumenpage-node-table$/, replacement: entry("node-table") },
        { find: /^lumenpage-node-list$/, replacement: entry("node-list") },
        { find: /^lumenpage-node-image$/, replacement: entry("node-image") },
        { find: /^lumenpage-node-video$/, replacement: entry("node-video") },
        { find: /^lumenpage-node-hard-break$/, replacement: entry("node-hard-break") },
        { find: /^lumenpage-node-horizontal-rule$/, replacement: entry("node-horizontal-rule") },
        { find: /^lumenpage-node-code-block$/, replacement: entry("node-code-block") },
        { find: /^lumenpage-node-blockquote$/, replacement: entry("node-blockquote") },
        {
          find: /^lumenpage-dev-tools$/,
          replacement: path.resolve(workspaceRoot, "packages/dev-tools/dist/esm/index.js"),
        },
        {
          find: /^@compiled\/react$/,
          replacement: path.resolve(__dirname, "src/shims/compiled-react.ts"),
        },
      ],
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
        "lumenpage-drag-handle",
        "lumenpage-plugin-active-block",
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
        "lumenpage-dev-tools",
      ],
    },
    build: {
      sourcemap: true,
    },
  };
});
