#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const EXPECTED_FILES = [
  {
    source: "packages/extensions/node-paragraph/src/index.ts",
    expected: 'export { paragraphNodeSpec, paragraphRenderer } from "lumenpage-node-basic";',
  },
  {
    source: "packages/extensions/node-heading/src/index.ts",
    expected: 'export { headingNodeSpec, headingRenderer } from "lumenpage-node-basic";',
  },
  {
    source: "packages/extensions/node-blockquote/src/index.ts",
    expected: 'export { blockquoteNodeSpec, blockquoteRenderer } from "lumenpage-node-basic";',
  },
  {
    source: "packages/extensions/node-code-block/src/index.ts",
    expected: 'export { codeBlockNodeSpec, codeBlockRenderer } from "lumenpage-node-basic";',
  },
  {
    source: "packages/extensions/node-hard-break/src/index.ts",
    expected: 'export { hardBreakNodeSpec } from "lumenpage-node-basic";',
  },
  {
    source: "packages/extensions/node-horizontal-rule/src/index.ts",
    expected:
      'export { horizontalRuleNodeSpec, horizontalRuleRenderer } from "lumenpage-node-basic";',
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
    console.error("[node-basic-wrapper-redirects] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[node-basic-wrapper-redirects] PASS files=${EXPECTED_FILES.length}`);
};

main();
