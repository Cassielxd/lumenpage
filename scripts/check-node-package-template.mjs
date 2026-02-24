#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NODE_PACKAGES_DIR = path.join(ROOT, "packages", "extensions");

const EXPECTED = {
  main: "dist/index.js",
  module: "dist/index.js",
  types: "dist/index.d.ts",
  exports: {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
    require: "./dist/index.js",
    default: "./dist/index.js",
    development: "./src/index.ts",
  },
  scripts: {
    build: "tsc -b",
    typecheck: "tsc -p tsconfig.typecheck.json --pretty false --noEmit",
  },
};

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(sanitized);
};

const getNodePackageDirs = () => {
  if (!fs.existsSync(NODE_PACKAGES_DIR)) return [];
  return fs
    .readdirSync(NODE_PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("node-"))
    .map((entry) => path.join(NODE_PACKAGES_DIR, entry.name));
};

const checkPackage = (pkgDir) => {
  const errors = [];
  const pkgPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return [`missing package.json: ${path.relative(ROOT, pkgDir)}`];
  }

  const rel = path.relative(ROOT, pkgPath).replace(/\\/g, "/");
  const manifest = readJson(pkgPath);
  const pkgName = manifest.name || rel;

  if (!String(pkgName).startsWith("lumenpage-node-")) {
    errors.push(`${rel} name must start with "lumenpage-node-"`);
  }

  if (manifest.main !== EXPECTED.main) {
    errors.push(`${pkgName} main mismatch: expected "${EXPECTED.main}" got "${String(manifest.main)}"`);
  }
  if (manifest.module !== EXPECTED.module) {
    errors.push(
      `${pkgName} module mismatch: expected "${EXPECTED.module}" got "${String(manifest.module)}"`,
    );
  }
  if (manifest.types !== EXPECTED.types) {
    errors.push(`${pkgName} types mismatch: expected "${EXPECTED.types}" got "${String(manifest.types)}"`);
  }

  const entry = manifest?.exports?.["."];
  if (!entry || typeof entry !== "object") {
    errors.push(`${pkgName} exports["."] must be an object`);
  } else {
    for (const [key, expected] of Object.entries(EXPECTED.exports)) {
      if (entry[key] !== expected) {
        errors.push(
          `${pkgName} exports["."].${key} mismatch: expected "${expected}" got "${String(entry[key])}"`,
        );
      }
    }
  }

  if (!Array.isArray(manifest.files) || !manifest.files.includes("dist")) {
    errors.push(`${pkgName} files must include "dist"`);
  }

  for (const [scriptName, expected] of Object.entries(EXPECTED.scripts)) {
    const actual = manifest?.scripts?.[scriptName];
    if (actual !== expected) {
      errors.push(
        `${pkgName} scripts.${scriptName} mismatch: expected "${expected}" got "${String(actual)}"`,
      );
    }
  }

  return errors;
};

const main = () => {
  const nodePkgDirs = getNodePackageDirs();
  const errors = [];

  for (const dir of nodePkgDirs) {
    errors.push(...checkPackage(dir));
  }

  if (errors.length > 0) {
    console.error("[node-template-check] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[node-template-check] PASS packages=${nodePkgDirs.length}`);
};

main();
