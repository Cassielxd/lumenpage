#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APPS = ["playground", "lumen"];

const readText = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
};

const readJson = (filePath) => JSON.parse(readText(filePath));

const asSorted = (iterable) => [...new Set(iterable)].sort();

const parseLumenpageAliasesFromVite = (viteText) => {
  const names = [];
  for (const match of viteText.matchAll(/find:\s*\/\^(lumenpage-[a-z0-9-]+)\$/g)) {
    names.push(match[1]);
  }
  return asSorted(names);
};

const parseLumenpageOptimizeExclude = (viteText) => {
  const blockMatch = viteText.match(/optimizeDeps:\s*\{[\s\S]*?exclude:\s*\[([\s\S]*?)\][\s\S]*?\}/);
  if (!blockMatch) return [];

  const names = [];
  for (const match of blockMatch[1].matchAll(/"(lumenpage-[a-z0-9-]+)"/g)) {
    names.push(match[1]);
  }
  return asSorted(names);
};

const parseLumenpageTsconfigPaths = (tsconfigJson) => {
  const paths = tsconfigJson?.compilerOptions?.paths;
  if (!paths || typeof paths !== "object") return [];
  return asSorted(Object.keys(paths).filter((name) => name.startsWith("lumenpage-")));
};

const compareSets = (name, left, right, errors) => {
  const l = asSorted(left);
  const r = asSorted(right);
  if (l.length !== r.length) {
    errors.push(`${name} size mismatch: ${l.length} vs ${r.length}`);
  }
  const leftOnly = l.filter((item) => !r.includes(item));
  const rightOnly = r.filter((item) => !l.includes(item));
  if (leftOnly.length > 0) {
    errors.push(`${name} only in playground: ${leftOnly.join(", ")}`);
  }
  if (rightOnly.length > 0) {
    errors.push(`${name} only in lumen: ${rightOnly.join(", ")}`);
  }
};

const main = () => {
  const errors = [];
  const appData = {};

  for (const app of APPS) {
    const appRoot = path.join(ROOT, "apps", app);
    const vitePath = path.join(appRoot, "vite.config.ts");
    const tsconfigPath = path.join(appRoot, "tsconfig.json");

    if (!fs.existsSync(vitePath)) {
      errors.push(`missing vite config: apps/${app}/vite.config.ts`);
      continue;
    }
    if (!fs.existsSync(tsconfigPath)) {
      errors.push(`missing tsconfig: apps/${app}/tsconfig.json`);
      continue;
    }

    const viteText = readText(vitePath);
    const tsconfig = readJson(tsconfigPath);
    appData[app] = {
      aliasNames: parseLumenpageAliasesFromVite(viteText),
      optimizeExcludeNames: parseLumenpageOptimizeExclude(viteText),
      tsconfigPathNames: parseLumenpageTsconfigPaths(tsconfig),
    };
  }

  if (errors.length > 0) {
    console.error("[app-config-consistency] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const playground = appData.playground;
  const lumen = appData.lumen;

  compareSets("vite alias", playground.aliasNames, lumen.aliasNames, errors);
  compareSets(
    "vite optimizeDeps.exclude",
    playground.optimizeExcludeNames,
    lumen.optimizeExcludeNames,
    errors,
  );
  compareSets("tsconfig paths", playground.tsconfigPathNames, lumen.tsconfigPathNames, errors);

  compareSets(
    "playground alias vs tsconfig",
    playground.aliasNames,
    playground.tsconfigPathNames,
    errors,
  );
  compareSets(
    "lumen alias vs tsconfig",
    lumen.aliasNames,
    lumen.tsconfigPathNames,
    errors,
  );

  if (errors.length > 0) {
    console.error("[app-config-consistency] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[app-config-consistency] PASS aliases=${playground.aliasNames.length} excludes=${playground.optimizeExcludeNames.length} tsconfigPaths=${playground.tsconfigPathNames.length}`,
  );
};

main();
