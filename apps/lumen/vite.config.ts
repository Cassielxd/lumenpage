import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const useSrc = true;
  const packageScopes = ["core", "engine", "extensions", "tooling"] as const;
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
        { find: /^lumenpage-view-canvas$/, replacement: entry("view-canvas") },
        { find: /^lumenpage-state$/, replacement: entry("state") },
        { find: /^lumenpage-commands$/, replacement: entry("commands") },
        { find: /^lumenpage-history$/, replacement: entry("history") },
        { find: /^lumenpage-keymap$/, replacement: entry("keymap") },
        { find: /^lumenpage-layout-engine$/, replacement: entry("layout-engine") },
        { find: /^lumenpage-model$/, replacement: entry("model") },
        { find: /^lumenpage-transform$/, replacement: entry("transform") },
        { find: /^lumenpage-view-types$/, replacement: entry("view-types") },
        { find: /^lumenpage-kit-basic$/, replacement: entry("kit-basic") },
        { find: /^lumenpage-inputrules$/, replacement: entry("inputrules") },
        { find: /^lumenpage-gapcursor$/, replacement: entry("gapcursor") },
        { find: /^lumenpage-collab$/, replacement: entry("collab") },
        { find: /^lumenpage-schema-basic$/, replacement: entry("schema-basic") },
        { find: /^lumenpage-drag-handle$/, replacement: entry("drag-handle") },
        { find: /^lumenpage-editor-plugins$/, replacement: entry("editor-plugins") },
        { find: /^lumenpage-link$/, replacement: entry("link") },
        { find: /^lumenpage-view-runtime$/, replacement: entry("view-runtime") },
        { find: /^lumenpage-markdown$/, replacement: entry("markdown") },
        { find: /^lumenpage-plugin-active-block$/, replacement: entry("plugin-active-block") },
        { find: /^lumenpage-node-paragraph$/, replacement: entry("node-paragraph") },
        { find: /^lumenpage-node-heading$/, replacement: entry("node-heading") },
        { find: /^lumenpage-node-table$/, replacement: entry("node-table") },
        { find: /^lumenpage-node-list$/, replacement: entry("node-list") },
        { find: /^lumenpage-node-image$/, replacement: entry("node-image") },
        { find: /^lumenpage-node-media$/, replacement: entry("node-media") },
        { find: /^lumenpage-node-video$/, replacement: entry("node-video") },
        { find: /^lumenpage-node-basic$/, replacement: entry("node-basic") },
        { find: /^lumenpage-node-hard-break$/, replacement: entry("node-hard-break") },
        { find: /^lumenpage-node-horizontal-rule$/, replacement: entry("node-horizontal-rule") },
        { find: /^lumenpage-node-code-block$/, replacement: entry("node-code-block") },
        { find: /^lumenpage-node-blockquote$/, replacement: entry("node-blockquote") },
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
        "lumenpage-view-canvas",
        "lumenpage-state",
        "lumenpage-commands",
        "lumenpage-history",
        "lumenpage-keymap",
        "lumenpage-layout-engine",
        "lumenpage-model",
        "lumenpage-transform",
        "lumenpage-view-types",
        "lumenpage-kit-basic",
        "lumenpage-inputrules",
        "lumenpage-gapcursor",
        "lumenpage-collab",
        "lumenpage-schema-basic",
        "lumenpage-drag-handle",
        "lumenpage-editor-plugins",
        "lumenpage-link",
        "lumenpage-view-runtime",
        "lumenpage-markdown",
        "lumenpage-plugin-active-block",
        "lumenpage-node-paragraph",
        "lumenpage-node-heading",
        "lumenpage-node-table",
        "lumenpage-node-list",
        "lumenpage-node-image",
        "lumenpage-node-media",
        "lumenpage-node-video",
        "lumenpage-node-basic",
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
