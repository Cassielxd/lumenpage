#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const MIRRORED_FILE_PAIRS = [];

const REDIRECTED_FILES = [
  {
    source: "packages/engine/view-canvas/src/view/segmenter.ts",
    expected:
      'export type { SegmenterOptions } from "lumenpage-view-runtime";\nexport { createLinebreakSegmentText, createSegmentText } from "lumenpage-view-runtime";',
  },
  {
    source: "packages/engine/view-canvas/src/view/virtualization.ts",
    expected: 'export { getVisiblePages } from "lumenpage-view-runtime";',
  },
  {
    source: "packages/engine/view-canvas/src/view/pageAlign.ts",
    expected: 'export { getPageX } from "lumenpage-view-runtime";',
  },
  {
    source: "packages/engine/view-canvas/src/view/measure.ts",
    expected: 'export { getFontSize, measureTextWidth } from "lumenpage-view-runtime";',
  },
  {
    source: "packages/engine/view-canvas/src/view/posIndex.ts",
    expected: 'export { coordsAtPos, posAtCoords } from "lumenpage-view-runtime";',
  },
  {
    source: "packages/engine/view-canvas/src/view/caret.ts",
    expected:
      'export {\n  findLineForOffset,\n  getCaretFromPoint,\n  getCaretRect,\n  offsetAtX,\n} from "lumenpage-view-runtime";',
  },
  {
    source: "packages/engine/view-canvas/src/view/layoutIndex.ts",
    expected:
      'export {\n  buildLayoutIndex,\n  findLineForOffsetIndexed,\n  getFirstLineForBlockId,\n  getLineAtOffset,\n  offsetAtXIndexed,\n  posAtCoordsIndexed,\n} from "lumenpage-view-runtime";',
  },
  {
    source: "packages/engine/view-canvas/src/view/selectionMovement.ts",
    expected: 'export { createSelectionMovement } from "lumenpage-view-runtime";',
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

  for (const [sourceRel, targetRel] of MIRRORED_FILE_PAIRS) {
    const source = readNormalized(sourceRel);
    const target = readNormalized(targetRel);
    if (source == null) {
      errors.push(`missing source: ${sourceRel}`);
      continue;
    }
    if (target == null) {
      errors.push(`missing target: ${targetRel}`);
      continue;
    }
    if (source !== target) {
      errors.push(`out-of-sync: ${sourceRel} -> ${targetRel}`);
    }
  }

  for (const item of REDIRECTED_FILES) {
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
    console.error("[view-runtime-sync] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const total = MIRRORED_FILE_PAIRS.length + REDIRECTED_FILES.length;
  console.log(`[view-runtime-sync] PASS files=${total}`);
};

main();
