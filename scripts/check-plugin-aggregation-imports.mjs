#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const APP_SRC_DIRS = [
  path.join(ROOT, "apps/playground/src"),
  path.join(ROOT, "apps/lumen/src"),
];

const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue"]);

const DISALLOWED_IMPORTS = [
  "lumenpage-drag-handle",
  "lumenpage-gapcursor",
  "lumenpage-plugin-active-block",
];

const collectFiles = (dir) => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
};

const toWorkspacePath = (absolutePath) => path.relative(ROOT, absolutePath).replace(/\\/g, "/");

const findImportViolations = (filePath, sourceText) => {
  const violations = [];
  const lines = sourceText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const disallowed of DISALLOWED_IMPORTS) {
      if (line.includes(`"${disallowed}"`) || line.includes(`'${disallowed}'`)) {
        violations.push({
          line: i + 1,
          importPath: disallowed,
        });
      }
    }
  }
  return violations;
};

const main = () => {
  const allFiles = APP_SRC_DIRS.flatMap((dir) => collectFiles(dir));
  const errors = [];

  for (const filePath of allFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    const violations = findImportViolations(filePath, source);
    for (const violation of violations) {
      errors.push(
        `${toWorkspacePath(filePath)}:${violation.line} imports "${violation.importPath}" (use "lumenpage-editor-plugins")`
      );
    }
  }

  if (errors.length > 0) {
    console.error("[plugin-aggregation-check] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[plugin-aggregation-check] PASS files=${allFiles.length}`);
};

main();
