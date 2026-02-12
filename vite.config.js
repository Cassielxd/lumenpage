/*
 * 文件说明：Vite 构建配置。
 * 主要职责：区分应用构建与库构建，外部化 ProseMirror 依赖。
 */

import { defineConfig } from "vite";
import path from "node:path";

const prosemirrorDeps = [
  "prosemirror-model",
  "prosemirror-state",
  "prosemirror-transform",
  "prosemirror-commands",
  "prosemirror-history",
  "prosemirror-keymap",
  "prosemirror-inputrules",
];

export default defineConfig(({ mode }) => {
  if (mode === "lib") {
    return {
      build: {
        lib: {
          entry: path.resolve("src/index.js"),
          name: "LumenPageCore",
          formats: ["es"],
          fileName: "lumenpage-core",
        },
        outDir: "dist-lib",
        sourcemap: true,
        rollupOptions: {
          external: prosemirrorDeps,
        },
      },
    };
  }

  return {
    build: {
      sourcemap: true,
    },
  };
});
