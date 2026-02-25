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

const parseImportedSmokeRunners = (mountText) => {
  const fromMarker = 'from "./smokeTests";';
  const fromIndex = mountText.indexOf(fromMarker);
  if (fromIndex < 0) {
    return null;
  }

  const importStart = mountText.lastIndexOf("import {", fromIndex);
  const importEnd = mountText.lastIndexOf("}", fromIndex);
  if (importStart < 0 || importEnd < 0 || importEnd <= importStart) {
    return null;
  }

  const names = [];
  const block = mountText.slice(importStart + "import {".length, importEnd);
  for (const item of block.split(",")) {
    const trimmed = item.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    if (!/^run[A-Za-z0-9]+Smoke$/.test(trimmed)) continue;
    names.push(trimmed);
  }
  return names;
};

const parseRunnerNamesFromBlock = (mountText, startMarker, endMarker) => {
  const startIndex = mountText.indexOf(startMarker);
  if (startIndex < 0) {
    return null;
  }
  const endIndex = mountText.indexOf(endMarker, startIndex);
  if (endIndex < 0) {
    return null;
  }
  const block = mountText.slice(startIndex, endIndex);
  const names = [];
  for (const match of block.matchAll(/\b(run[A-Za-z0-9]+Smoke)\b/g)) {
    names.push(match[1]);
  }
  return asSorted(names);
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
  const baselineAllRunners = Array.isArray(baseline?.requiredAllSmokeRunners)
    ? baseline.requiredAllSmokeRunners
    : [];
  const baselineP0Runners = Array.isArray(baseline?.requiredP0SmokeRunners)
    ? baseline.requiredP0SmokeRunners
    : [];
  if (baselineSummaryTags.length === 0) {
    errors.push("baseline summaryTags must be a non-empty array");
  }
  if (baselineP0.length === 0) {
    errors.push("baseline requiredP0Smokes must be a non-empty array");
  }
  if (baselineAllRunners.length === 0) {
    errors.push("baseline requiredAllSmokeRunners must be a non-empty array");
  }
  if (baselineP0Runners.length === 0) {
    errors.push("baseline requiredP0SmokeRunners must be a non-empty array");
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

  const importedRunners = parseImportedSmokeRunners(mountText);
  if (!importedRunners) {
    errors.push("cannot parse smoke runner imports from editorMount.ts");
  } else {
    const expectedUnion = asSorted([...baselineAllRunners, ...baselineP0Runners]);
    if (!sameSet(importedRunners, expectedUnion)) {
      errors.push(
        `smoke runner import mismatch baseline. imports=[${asSorted(importedRunners).join(", ")}] baseline=[${expectedUnion.join(", ")}]`,
      );
    }
  }

  const allSmokeRunners = parseRunnerNamesFromBlock(
    mountText,
    "if (flags.debugAllSmoke) {",
    "} else if (flags.debugP0Smoke) {",
  );
  if (!allSmokeRunners) {
    errors.push("cannot parse debugAllSmoke runner block from editorMount.ts");
  } else if (!sameSet(allSmokeRunners, baselineAllRunners)) {
    errors.push(
      `debugAllSmoke runner mismatch baseline. mount=[${asSorted(allSmokeRunners).join(", ")}] baseline=[${asSorted(baselineAllRunners).join(", ")}]`,
    );
  }

  const p0SmokeRunners = parseRunnerNamesFromBlock(
    mountText,
    "} else if (flags.debugP0Smoke) {",
    "} else {",
  );
  if (!p0SmokeRunners) {
    errors.push("cannot parse debugP0Smoke runner block from editorMount.ts");
  } else if (!sameSet(p0SmokeRunners, baselineP0Runners)) {
    errors.push(
      `debugP0Smoke runner mismatch baseline. mount=[${asSorted(p0SmokeRunners).join(", ")}] baseline=[${asSorted(baselineP0Runners).join(", ")}]`,
    );
  }

  if (errors.length > 0) {
    console.error("[playground-smoke-gate] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[playground-smoke-gate] PASS p0Tags=${baselineP0.length} allRunners=${baselineAllRunners.length} p0Runners=${baselineP0Runners.length} summaryTags=${baselineSummaryTags.length}`,
  );
};

main();
