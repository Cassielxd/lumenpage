#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "governance", "package-catalog.json");
const BUDGET_PATH = path.join(ROOT, "governance", "perf-budget.json");

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(sanitized);
};

const collectWorkspacePackageJsonPaths = () => {
  const found = [];
  const appRoot = path.join(ROOT, "apps");
  const packageRoot = path.join(ROOT, "packages");

  if (fs.existsSync(appRoot)) {
    for (const entry of fs.readdirSync(appRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = path.join(appRoot, entry.name, "package.json");
      if (fs.existsSync(manifest)) found.push(manifest);
    }
  }

  if (fs.existsSync(packageRoot)) {
    for (const layerEntry of fs.readdirSync(packageRoot, { withFileTypes: true })) {
      if (!layerEntry.isDirectory()) continue;
      const layerDir = path.join(packageRoot, layerEntry.name);

      const directManifest = path.join(layerDir, "package.json");
      if (fs.existsSync(directManifest)) found.push(directManifest);

      for (const pkgEntry of fs.readdirSync(layerDir, { withFileTypes: true })) {
        if (!pkgEntry.isDirectory()) continue;
        const nestedManifest = path.join(layerDir, pkgEntry.name, "package.json");
        if (fs.existsSync(nestedManifest)) found.push(nestedManifest);
      }
    }
  }

  return found;
};

const extractInternalDeps = (manifest) => {
  const names = new Set();
  const collect = (deps) => {
    if (!deps || typeof deps !== "object") return;
    for (const depName of Object.keys(deps)) {
      if (depName.startsWith("lumenpage-")) names.add(depName);
    }
  };
  collect(manifest.dependencies);
  collect(manifest.peerDependencies);
  collect(manifest.optionalDependencies);
  return [...names];
};

const normalizeEntryPath = (manifestDir, entryPath) => {
  if (typeof entryPath !== "string" || entryPath.length === 0) return null;
  if (!entryPath.startsWith("./")) return null;

  const rel = entryPath.replace(/^\.\//, "");
  const absolute = path.join(manifestDir, rel);
  if (fs.existsSync(absolute)) return absolute;

  const candidates = [];
  candidates.push(
    absolute
      .replace(`${path.sep}dist${path.sep}`, `${path.sep}src${path.sep}`)
      .replace(/\.d\.ts$/, ".ts")
      .replace(/\.js$/, ".ts"),
  );
  candidates.push(
    absolute
      .replace(`${path.sep}dist${path.sep}`, `${path.sep}src${path.sep}`)
      .replace(/\.d\.ts$/, ".tsx")
      .replace(/\.js$/, ".tsx"),
  );
  candidates.push(absolute.replace(/\.d\.ts$/, ".ts"));
  candidates.push(absolute.replace(/\.d\.ts$/, ".tsx"));
  candidates.push(absolute.replace(/\.js$/, ".ts"));
  candidates.push(absolute.replace(/\.js$/, ".tsx"));

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const pickExportTarget = (exportEntry) => {
  if (!exportEntry) return null;
  if (typeof exportEntry === "string") return exportEntry;
  if (Array.isArray(exportEntry)) {
    for (const item of exportEntry) {
      const picked = pickExportTarget(item);
      if (picked) return picked;
    }
    return null;
  }
  if (typeof exportEntry !== "object") return null;

  const priority = ["development", "types", "import", "default", "require"];
  for (const key of priority) {
    const picked = pickExportTarget(exportEntry[key]);
    if (picked) return picked;
  }

  for (const key of Object.keys(exportEntry)) {
    const picked = pickExportTarget(exportEntry[key]);
    if (picked) return picked;
  }
  return null;
};

const collectPublicEntryFiles = (manifestPath, manifest) => {
  const manifestDir = path.dirname(manifestPath);
  const files = new Set();
  let subpathCount = 0;

  const exportsField = manifest.exports;
  if (typeof exportsField === "string") {
    const entry = normalizeEntryPath(manifestDir, exportsField);
    if (entry) files.add(entry);
    subpathCount = 1;
  } else if (exportsField && typeof exportsField === "object") {
    const keys = Object.keys(exportsField);
    const subpathKeys = keys.filter((key) => key.startsWith("."));

    if (subpathKeys.length > 0) {
      subpathCount = subpathKeys.length;
      for (const key of subpathKeys) {
        const target = pickExportTarget(exportsField[key]);
        const entry = normalizeEntryPath(manifestDir, target);
        if (entry) files.add(entry);
      }
    } else {
      const target = pickExportTarget(exportsField);
      const entry = normalizeEntryPath(manifestDir, target);
      if (entry) files.add(entry);
      subpathCount = 1;
    }
  }

  if (files.size === 0) {
    const fallback = path.join(manifestDir, "src", "index.ts");
    if (fs.existsSync(fallback)) files.add(fallback);
  }

  return { files: [...files], subpathCount };
};

const countExportedSymbols = (source) => {
  const cleaned = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n\r]*/g, "");
  let total = 0;

  const namedBraced = cleaned.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g);
  for (const match of namedBraced) {
    const names = match[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    total += names.length;
  }

  total += [...cleaned.matchAll(/export\s+\*\s+from\s+["'][^"']+["']/g)].length;
  total += [
    ...cleaned.matchAll(
      /export\s+(?:declare\s+)?(?:const|let|var|function|class|interface|type|enum)\s+[A-Za-z_$][\w$]*/g,
    ),
  ].length;
  total += [...cleaned.matchAll(/export\s+default\s+/g)].length;

  return total;
};

const computeMaxDependencyDepth = (graph, errors) => {
  const memo = new Map();
  const active = new Set();

  const dfs = (name, stack) => {
    if (memo.has(name)) return memo.get(name);
    if (active.has(name)) {
      const cycleStart = stack.indexOf(name);
      const cycle = [...stack.slice(cycleStart), name].join(" -> ");
      errors.push(`dependency cycle detected: ${cycle}`);
      return 0;
    }

    active.add(name);
    let best = 0;
    for (const dep of graph.get(name) || []) {
      if (!graph.has(dep)) continue;
      const depth = dfs(dep, [...stack, name]) + 1;
      if (depth > best) best = depth;
    }
    active.delete(name);
    memo.set(name, best);
    return best;
  };

  let maxDepth = 0;
  for (const name of graph.keys()) {
    const depth = dfs(name, []);
    if (depth > maxDepth) maxDepth = depth;
  }
  return maxDepth;
};

const main = () => {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(CATALOG_PATH)) {
    console.error("[governance-budget] missing catalog: governance/package-catalog.json");
    process.exit(1);
  }
  if (!fs.existsSync(BUDGET_PATH)) {
    console.error("[governance-budget] missing budget config: governance/perf-budget.json");
    process.exit(1);
  }

  const catalog = readJson(CATALOG_PATH);
  const budget = readJson(BUDGET_PATH);
  const packageCatalog = catalog.packages || {};
  const includeVisibility = new Set(budget?.publicApi?.includeVisibility || ["public"]);

  const manifests = collectWorkspacePackageJsonPaths();
  const discovered = new Map();

  for (const manifestPath of manifests) {
    const manifest = readJson(manifestPath);
    const name = manifest?.name;
    if (!name || !name.startsWith("lumenpage-")) continue;
    discovered.set(name, {
      manifestPath,
      manifest,
      deps: extractInternalDeps(manifest),
    });
  }

  const graph = new Map();
  for (const [name, meta] of discovered.entries()) {
    graph.set(name, meta.deps.filter((dep) => discovered.has(dep)));
  }

  const maxDepth = computeMaxDependencyDepth(graph, errors);
  const depthBudget = Number(budget?.dependencyDepth?.maxDepth ?? 0);
  if (Number.isFinite(depthBudget) && depthBudget > 0 && maxDepth > depthBudget) {
    errors.push(`dependency depth exceeded: max=${maxDepth} budget=${depthBudget}`);
  }

  const maxSymbolsPerPackage = Number(budget?.publicApi?.maxSymbolsPerPackage ?? 0);
  const maxSubpathExportsPerPackage = Number(budget?.publicApi?.maxSubpathExportsPerPackage ?? 0);
  const publicApiStats = [];

  for (const [name, meta] of discovered.entries()) {
    const catalogRecord = packageCatalog[name];
    if (!catalogRecord) continue;
    if (!includeVisibility.has(catalogRecord.visibility)) continue;
    if (catalogRecord.layer === "apps") continue;

    const { files, subpathCount } = collectPublicEntryFiles(meta.manifestPath, meta.manifest);
    let symbolCount = 0;
    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      symbolCount += countExportedSymbols(fs.readFileSync(file, "utf8"));
    }

    publicApiStats.push({ name, symbolCount, subpathCount });

    if (maxSymbolsPerPackage > 0 && symbolCount > maxSymbolsPerPackage) {
      errors.push(
        `public api symbols exceeded: ${name} symbols=${symbolCount} budget=${maxSymbolsPerPackage}`,
      );
    }
    if (maxSubpathExportsPerPackage > 0 && subpathCount > maxSubpathExportsPerPackage) {
      errors.push(
        `public api subpath exports exceeded: ${name} subpaths=${subpathCount} budget=${maxSubpathExportsPerPackage}`,
      );
    }
  }

  const buildBudget = budget?.buildTimeMs || {};
  const snapshotPath = path.join(
    ROOT,
    typeof buildBudget.snapshotPath === "string"
      ? buildBudget.snapshotPath
      : "governance/build-budget-snapshot.json",
  );
  const enforceBuildBudget = Boolean(buildBudget.enforce);
  let buildSnapshot = null;
  if (fs.existsSync(snapshotPath)) {
    buildSnapshot = readJson(snapshotPath);
    const coldMax = Number(buildBudget.coldMax ?? 0);
    const incrementalMax = Number(buildBudget.incrementalMax ?? 0);
    const coldValue = Number(buildSnapshot?.coldBuildMs ?? NaN);
    const incrementalValue = Number(buildSnapshot?.incrementalBuildMs ?? NaN);

    if (enforceBuildBudget) {
      if (!Number.isFinite(coldValue)) {
        errors.push("build budget snapshot missing coldBuildMs");
      } else if (coldMax > 0 && coldValue > coldMax) {
        errors.push(`cold build budget exceeded: ${coldValue}ms > ${coldMax}ms`);
      }

      if (!Number.isFinite(incrementalValue)) {
        errors.push("build budget snapshot missing incrementalBuildMs");
      } else if (incrementalMax > 0 && incrementalValue > incrementalMax) {
        errors.push(`incremental build budget exceeded: ${incrementalValue}ms > ${incrementalMax}ms`);
      }
    }
  } else if (enforceBuildBudget) {
    errors.push(`build budget snapshot missing: ${path.relative(ROOT, snapshotPath)}`);
  } else {
    warnings.push(`build budget snapshot missing (enforce=false): ${path.relative(ROOT, snapshotPath)}`);
  }

  const maxApi = publicApiStats.sort((a, b) => b.symbolCount - a.symbolCount)[0];
  if (errors.length > 0) {
    console.error("[governance-budget] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  for (const warning of warnings) {
    console.warn(`[governance-budget] WARN ${warning}`);
  }
  console.log(
    `[governance-budget] PASS depth=${maxDepth} publicPackages=${publicApiStats.length} maxApi=${maxApi?.name ?? "n/a"}:${maxApi?.symbolCount ?? 0}`,
  );
};

main();
