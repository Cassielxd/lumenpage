#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "governance", "package-catalog.json");
const BASELINE_PATH = path.join(ROOT, "governance", "node-test-baseline.json");

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(sanitized);
};

const isNonEmptyStringArray = (value) =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string");

const main = () => {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error("[node-test-baseline] missing catalog: governance/package-catalog.json");
    process.exit(1);
  }
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error("[node-test-baseline] missing baseline: governance/node-test-baseline.json");
    process.exit(1);
  }

  const catalog = readJson(CATALOG_PATH);
  const baseline = readJson(BASELINE_PATH);
  const errors = [];

  const packageCatalog = catalog?.packages || {};
  const nodePackageNames = Object.keys(packageCatalog).filter((name) =>
    String(name).startsWith("lumenpage-node-")
  );
  const baselinePackages = baseline?.packages || {};
  const baselineNames = Object.keys(baselinePackages);

  if (baseline?.version !== 1) {
    errors.push(`baseline version must be 1, got ${String(baseline?.version)}`);
  }

  for (const name of nodePackageNames) {
    if (!baselinePackages[name]) {
      errors.push(`missing baseline entry: ${name}`);
      continue;
    }

    const entry = baselinePackages[name];
    if (!isNonEmptyStringArray(entry?.baseline)) {
      errors.push(`${name} baseline must be a non-empty string array`);
    }

    const action = packageCatalog[name]?.action;
    const delegatesTo = entry?.delegatesTo;
    if (action === "merge") {
      if (typeof delegatesTo !== "string" || delegatesTo.length === 0) {
        errors.push(`${name} (action=merge) must define delegatesTo`);
      } else if (!nodePackageNames.includes(delegatesTo)) {
        errors.push(`${name} delegatesTo unknown node package: ${delegatesTo}`);
      }
    }

    if (action === "keep") {
      if (!isNonEmptyStringArray(entry?.smokeRefs)) {
        errors.push(`${name} (action=keep) must define non-empty smokeRefs`);
      }
    }
  }

  for (const name of baselineNames) {
    if (!nodePackageNames.includes(name)) {
      errors.push(`stale baseline entry (not in catalog node packages): ${name}`);
    }
  }

  if (errors.length > 0) {
    console.error("[node-test-baseline] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[node-test-baseline] PASS packages=${nodePackageNames.length}`);
};

main();
