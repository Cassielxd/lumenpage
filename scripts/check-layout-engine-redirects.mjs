#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const EXPECTED_FILES = [
  {
    source: "packages/engine/view-canvas/src/layout-pagination/engine.ts",
    expected: 'export { LayoutPipeline } from "lumenpage-layout-engine";',
  },
  {
    source: "packages/engine/view-canvas/src/layout-pagination/lineBreaker.ts",
    expected: 'export { breakLines } from "lumenpage-layout-engine";',
  },
  {
    source: "packages/engine/view-canvas/src/layout-pagination/textRuns.ts",
    expected: 'export { docToRuns, textToRuns, textblockToRuns } from "lumenpage-layout-engine";',
  },
  {
    source: "packages/engine/view-canvas/src/layout-pagination/nodeRegistry.ts",
    expected:
      'export type { ContainerStyle, NodeLayoutResult, NodeRenderer } from "lumenpage-layout-engine";\nexport { NodeRendererRegistry } from "lumenpage-layout-engine";',
  },
  {
    source: "packages/engine/view-canvas/src/layout-pagination/index.ts",
    expected:
      'export {\n  LayoutPipeline,\n  NodeRendererRegistry,\n  breakLines,\n  docToRuns,\n  textToRuns,\n  textblockToRuns,\n} from "lumenpage-layout-engine";\nexport type { ContainerStyle, NodeLayoutResult, NodeRenderer } from "lumenpage-layout-engine";',
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
    const expected = String(item.expected).trim();
    if (source !== expected) {
      errors.push(`unexpected redirect source content: ${item.source}`);
    }
  }

  if (errors.length > 0) {
    console.error("[layout-engine-redirects] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[layout-engine-redirects] PASS files=${EXPECTED_FILES.length}`);
};

main();

