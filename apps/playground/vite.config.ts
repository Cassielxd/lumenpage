import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const useSrc = true;
  const packageScopes = ["lp"] as const;
  const resolvePackageDir = (pkg: string) => {
    for (const scope of packageScopes) {
      const scoped = path.resolve(workspaceRoot, `packages/${scope}/${pkg}`);
      if (fs.existsSync(scoped)) {
        return scoped;
      }
    }
    return path.resolve(workspaceRoot, `packages/${pkg}`);
  };
  const entry = (pkg: string) =>
    path.resolve(resolvePackageDir(pkg), useSrc ? "src/index.ts" : "dist/index.js");

  return {
    plugins: [vue()],
    resolve: {
      alias: [
        { find: /^lumenpage-core$/, replacement: entry("core") },
        { find: /^lumenpage-view-canvas$/, replacement: entry("view-canvas") },
        { find: /^lumenpage-state$/, replacement: entry("state") },
        { find: /^lumenpage-commands$/, replacement: entry("commands") },
        { find: /^lumenpage-history$/, replacement: entry("history") },
        { find: /^lumenpage-keymap$/, replacement: entry("keymap") },
        { find: /^lumenpage-layout-engine$/, replacement: entry("layout-engine") },
        { find: /^lumenpage-render-engine$/, replacement: entry("render-engine") },
        { find: /^lumenpage-suggestion$/, replacement: entry("suggestion") },
        { find: /^lumenpage-model$/, replacement: entry("model") },
        { find: /^lumenpage-transform$/, replacement: entry("transform") },
        { find: /^lumenpage-view-types$/, replacement: entry("view-types") },
        { find: /^lumenpage-starter-kit$/, replacement: entry("starter-kit") },
        { find: /^lumenpage-inputrules$/, replacement: entry("inputrules") },
        { find: /^lumenpage-collab$/, replacement: entry("collab") },
        {
          find: /^lumenpage-extension-(.+)$/,
          replacement: path.resolve(workspaceRoot, "packages/extension-$1/src/index.ts"),
        },
        { find: /^lumenpage-extension-active-block$/, replacement: entry("extension-active-block") },
        { find: /^lumenpage-extension-block-id$/, replacement: entry("extension-block-id") },
        { find: /^lumenpage-extension-drag-handle$/, replacement: entry("extension-drag-handle") },
        { find: /^lumenpage-link$/, replacement: entry("link") },
        { find: /^lumenpage-view-runtime$/, replacement: entry("view-runtime") },
        { find: /^lumenpage-markdown$/, replacement: entry("markdown") },
        // markdown-it depends on `punycode.js`; some local pnpm states miss its runtime files.
        // Alias to the equivalent `punycode` package to keep build/dev stable.
        { find: /^punycode\.js$/, replacement: "punycode" },
      ],
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
        "lumenpage-state",
        "lumenpage-commands",
        "lumenpage-history",
        "lumenpage-keymap",
        "lumenpage-layout-engine",
        "lumenpage-render-engine",
        "lumenpage-suggestion",
        "lumenpage-model",
        "lumenpage-transform",
        "lumenpage-view-types",
        "lumenpage-starter-kit",
        "lumenpage-inputrules",
        "lumenpage-collab",
        "lumenpage-extension-active-block",
        "lumenpage-extension-block-id",
        "lumenpage-extension-drag-handle",
        "lumenpage-link",
        "lumenpage-view-runtime",
        "lumenpage-markdown",
      ],
    },
    build: {
      sourcemap: true,
    },
  };
});

