#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LEGACY_PATH = path.join(ROOT, "governance", "legacy-wrapper-packages.json");
const CATALOG_PATH = path.join(ROOT, "governance", "package-catalog.json");
const NODE_BASELINE_PATH = path.join(ROOT, "governance", "node-test-baseline.json");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue"]);

const readText = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
};

const readJson = (filePath) => JSON.parse(readText(filePath));

const toPosixPath = (value) => String(value || "").replace(/\\/g, "/");

const collectWorkspacePackageJsonPaths = () => {
  const found = [];

  const appsDir = path.join(ROOT, "apps");
  if (fs.existsSync(appsDir)) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(appsDir, entry.name, "package.json");
      if (fs.existsSync(manifestPath)) {
        found.push(manifestPath);
      }
    }
  }

  const packagesDir = path.join(ROOT, "packages");
  if (fs.existsSync(packagesDir)) {
    for (const layerEntry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (!layerEntry.isDirectory()) continue;
      const layerDir = path.join(packagesDir, layerEntry.name);
      for (const pkgEntry of fs.readdirSync(layerDir, { withFileTypes: true })) {
        if (!pkgEntry.isDirectory()) continue;
        const manifestPath = path.join(layerDir, pkgEntry.name, "package.json");
        if (fs.existsSync(manifestPath)) {
          found.push(manifestPath);
        }
      }
    }
  }

  return found;
};

const walkFiles = (startDir, onFile) => {
  if (!fs.existsSync(startDir)) return;
  const stack = [startDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile()) {
        onFile(absolute);
      }
    }
  }
};

const collectSourceFiles = () => {
  const files = [];

  const appsRoot = path.join(ROOT, "apps");
  if (fs.existsSync(appsRoot)) {
    for (const appEntry of fs.readdirSync(appsRoot, { withFileTypes: true })) {
      if (!appEntry.isDirectory()) continue;
      const srcDir = path.join(appsRoot, appEntry.name, "src");
      walkFiles(srcDir, (absolute) => {
        if (SOURCE_EXTENSIONS.has(path.extname(absolute))) {
          files.push(absolute);
        }
      });
    }
  }

  const packagesRoot = path.join(ROOT, "packages");
  if (fs.existsSync(packagesRoot)) {
    for (const layerEntry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!layerEntry.isDirectory()) continue;
      const layerDir = path.join(packagesRoot, layerEntry.name);
      for (const pkgEntry of fs.readdirSync(layerDir, { withFileTypes: true })) {
        if (!pkgEntry.isDirectory()) continue;
        const srcDir = path.join(layerDir, pkgEntry.name, "src");
        walkFiles(srcDir, (absolute) => {
          if (SOURCE_EXTENSIONS.has(path.extname(absolute))) {
            files.push(absolute);
          }
        });
      }
    }
  }

  return files;
};

const collectAppConfigFiles = () => {
  const files = [];
  const appsRoot = path.join(ROOT, "apps");
  if (!fs.existsSync(appsRoot)) return files;

  for (const appEntry of fs.readdirSync(appsRoot, { withFileTypes: true })) {
    if (!appEntry.isDirectory()) continue;
    const appDir = path.join(appsRoot, appEntry.name);
    const viteConfig = path.join(appDir, "vite.config.ts");
    const tsconfig = path.join(appDir, "tsconfig.json");
    if (fs.existsSync(viteConfig)) files.push(viteConfig);
    if (fs.existsSync(tsconfig)) files.push(tsconfig);
  }

  return files;
};

const collectGlobalConfigFiles = () => {
  const files = [];
  const rootTsconfig = path.join(ROOT, "tsconfig.json");
  if (fs.existsSync(rootTsconfig)) {
    files.push(rootTsconfig);
  }
  return files;
};

const collectInternalDependencyNames = (manifest) => {
  const names = new Set();
  for (const key of ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"]) {
    const block = manifest?.[key];
    if (!block || typeof block !== "object") continue;
    for (const dep of Object.keys(block)) {
      if (dep.startsWith("lumenpage-")) names.add(dep);
    }
  }
  return [...names];
};

const main = () => {
  if (!fs.existsSync(LEGACY_PATH)) {
    console.error("[no-legacy-wrappers] missing file: governance/legacy-wrapper-packages.json");
    process.exit(1);
  }
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error("[no-legacy-wrappers] missing file: governance/package-catalog.json");
    process.exit(1);
  }
  if (!fs.existsSync(NODE_BASELINE_PATH)) {
    console.error("[no-legacy-wrappers] missing file: governance/node-test-baseline.json");
    process.exit(1);
  }

  const legacy = readJson(LEGACY_PATH);
  const catalog = readJson(CATALOG_PATH);
  const nodeBaseline = readJson(NODE_BASELINE_PATH);
  const errors = [];

  if (legacy?.version !== 1) {
    errors.push(`legacy wrapper baseline version must be 1, got ${String(legacy?.version)}`);
  }

  const list = Array.isArray(legacy?.packages) ? legacy.packages : [];
  if (list.length === 0) {
    errors.push("legacy wrapper package list must be non-empty");
  }

  const names = [];
  for (const item of list) {
    const name = String(item?.name || "");
    const dir = String(item?.dir || "");
    if (!name || !dir) {
      errors.push(`invalid legacy entry: ${JSON.stringify(item)}`);
      continue;
    }
    names.push(name);
    const absoluteDir = path.join(ROOT, dir);
    if (fs.existsSync(absoluteDir)) {
      errors.push(`legacy wrapper directory still exists: ${toPosixPath(dir)}`);
    }
  }

  const uniqueNames = [...new Set(names)];
  const catalogPackages = catalog?.packages || {};
  const baselinePackages = nodeBaseline?.packages || {};
  for (const name of uniqueNames) {
    if (Object.prototype.hasOwnProperty.call(catalogPackages, name)) {
      errors.push(`legacy wrapper still exists in catalog: ${name}`);
    }
    if (Object.prototype.hasOwnProperty.call(baselinePackages, name)) {
      errors.push(`legacy wrapper still exists in node baseline: ${name}`);
    }
  }

  const sourceFiles = collectSourceFiles();
  for (const file of sourceFiles) {
    const rel = toPosixPath(path.relative(ROOT, file));
    const text = readText(file);
    for (const name of uniqueNames) {
      if (text.includes(`"${name}"`) || text.includes(`'${name}'`)) {
        errors.push(`legacy wrapper import in source: ${rel} -> ${name}`);
      }
    }
  }

  const configFiles = [...collectAppConfigFiles(), ...collectGlobalConfigFiles()];
  for (const file of configFiles) {
    const rel = toPosixPath(path.relative(ROOT, file));
    const text = readText(file);
    for (const name of uniqueNames) {
      if (text.includes(name)) {
        errors.push(`legacy wrapper reference in app config: ${rel} -> ${name}`);
      }
    }
    for (const item of list) {
      const dir = String(item?.dir || "");
      if (dir && text.includes(dir)) {
        errors.push(`legacy wrapper path reference in config: ${rel} -> ${dir}`);
      }
    }
  }

  const manifests = collectWorkspacePackageJsonPaths();
  for (const manifestPath of manifests) {
    const rel = toPosixPath(path.relative(ROOT, manifestPath));
    const manifest = readJson(manifestPath);
    const pkgName = String(manifest?.name || "");
    const deps = collectInternalDependencyNames(manifest);
    for (const name of uniqueNames) {
      if (pkgName === name) {
        errors.push(`legacy wrapper package manifest still exists: ${rel}`);
      }
      if (deps.includes(name)) {
        errors.push(`legacy wrapper dependency in manifest: ${rel} -> ${name}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("[no-legacy-wrappers] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[no-legacy-wrappers] PASS packages=${uniqueNames.length} sourceFiles=${sourceFiles.length} manifests=${manifests.length} configs=${configFiles.length}`,
  );
};

main();
