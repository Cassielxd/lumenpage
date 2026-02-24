#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const EXPECTED_FILES = [
  {
    source: "packages/extensions/node-image/src/index.ts",
    expected: 'export { imageNodeSpec, imageRenderer, serializeImageToText } from "lumenpage-node-media";',
  },
  {
    source: "packages/extensions/node-video/src/index.ts",
    expected: 'export { videoNodeSpec, videoRenderer, serializeVideoToText } from "lumenpage-node-media";',
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
    console.error("[node-media-wrapper-redirects] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[node-media-wrapper-redirects] PASS files=${EXPECTED_FILES.length}`);
};

main();
