#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const EXPECTED_FILES = [
  {
    source: "packages/extensions/drag-handle/src/index.ts",
    expected:
      'export { createBlockDragHandleNodeViews, createDragHandlePlugin } from "lumenpage-editor-plugins";',
  },
  {
    source: "packages/extensions/gapcursor/src/index.ts",
    expected: 'export { GapCursor, gapCursor } from "lumenpage-editor-plugins";',
  },
  {
    source: "packages/extensions/gapcursor/src/gapcursor.ts",
    expected: 'export { GapCursor } from "lumenpage-editor-plugins";',
  },
  {
    source: "packages/extensions/plugin-active-block/src/index.ts",
    expected: 'export { createActiveBlockSelectionPlugin } from "lumenpage-editor-plugins";',
  },
];

const readNormalized = (filePath) => {
  const absolute = path.join(ROOT, filePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  const raw = fs.readFileSync(absolute, "utf8");
  const noBom = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return noBom.replace(/\r\n/g, "\n").trimEnd();
};

const main = () => {
  const errors = [];

  for (const item of EXPECTED_FILES) {
    const source = readNormalized(item.source);
    if (source == null) {
      errors.push(`missing source: ${item.source}`);
      continue;
    }
    if (source !== String(item.expected).trim()) {
      errors.push(`unexpected wrapper source content: ${item.source}`);
    }
  }

  if (errors.length > 0) {
    console.error("[plugin-wrapper-redirects] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[plugin-wrapper-redirects] PASS files=${EXPECTED_FILES.length}`);
};

main();
