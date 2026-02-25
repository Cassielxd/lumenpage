#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "governance", "smoke-gate-baseline.json");
const MOUNT_PATH = path.join(ROOT, "apps", "playground", "src", "editor", "editorMount.ts");
const SMOKE_TESTS_PATH = path.join(ROOT, "apps", "playground", "src", "editor", "smokeTests.ts");

const readText = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
};

const readJson = (filePath) => JSON.parse(readText(filePath));

const parseRequiredP0Smokes = (mountText) => {
  const match = mountText.match(/const\s+requiredP0Smokes\s*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    return null;
  }
  const names = [];
  const block = match[1];
  for (const item of block.matchAll(/"([^"]+)"/g)) {
    names.push(item[1]);
  }
  return names;
};

const parseSmokeNamesFromTests = (smokeText) => {
  const names = new Set();
  for (const match of smokeText.matchAll(/\[([a-z0-9-]+-smoke)\]/g)) {
    names.add(match[1]);
  }
  return names;
};

const asSorted = (value) => [...new Set(value)].sort();

const sameSet = (left, right) => {
  const a = asSorted(left);
  const b = asSorted(right);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const main = () => {
  const errors = [];

  if (!fs.existsSync(BASELINE_PATH)) {
    console.error("[playground-smoke-gate] missing baseline: governance/smoke-gate-baseline.json");
    process.exit(1);
  }
  if (!fs.existsSync(MOUNT_PATH)) {
    console.error("[playground-smoke-gate] missing file: apps/playground/src/editor/editorMount.ts");
    process.exit(1);
  }
  if (!fs.existsSync(SMOKE_TESTS_PATH)) {
    console.error("[playground-smoke-gate] missing file: apps/playground/src/editor/smokeTests.ts");
    process.exit(1);
  }

  const baseline = readJson(BASELINE_PATH);
  const mountText = readText(MOUNT_PATH);
  const smokeText = readText(SMOKE_TESTS_PATH);

  if (baseline?.version !== 1) {
    errors.push(`baseline version must be 1, got ${String(baseline?.version)}`);
  }

  const baselineSummaryTags = Array.isArray(baseline?.summaryTags) ? baseline.summaryTags : [];
  const baselineP0 = Array.isArray(baseline?.requiredP0Smokes) ? baseline.requiredP0Smokes : [];
  if (baselineSummaryTags.length === 0) {
    errors.push("baseline summaryTags must be a non-empty array");
  }
  if (baselineP0.length === 0) {
    errors.push("baseline requiredP0Smokes must be a non-empty array");
  }

  const p0NamesFromMount = parseRequiredP0Smokes(mountText);
  if (!p0NamesFromMount) {
    errors.push("cannot parse requiredP0Smokes from editorMount.ts");
  } else if (!sameSet(p0NamesFromMount, baselineP0)) {
    errors.push(
      `requiredP0Smokes mismatch baseline. mount=[${asSorted(p0NamesFromMount).join(", ")}] baseline=[${asSorted(baselineP0).join(", ")}]`,
    );
  }

  for (const tag of baselineSummaryTags) {
    if (!mountText.includes(`"${tag}"`) && !mountText.includes(`'${tag}'`)) {
      errors.push(`missing summary tag in editorMount.ts: ${tag}`);
    }
  }

  const smokeNamesFromTests = parseSmokeNamesFromTests(smokeText);
  for (const name of baselineP0) {
    if (!smokeNamesFromTests.has(name)) {
      errors.push(`missing smoke tag in smokeTests.ts: [${name}]`);
    }
  }

  if (errors.length > 0) {
    console.error("[playground-smoke-gate] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[playground-smoke-gate] PASS p0=${baselineP0.length} summaryTags=${baselineSummaryTags.length}`,
  );
};

main();
