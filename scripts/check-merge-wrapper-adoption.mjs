#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "governance", "package-catalog.json");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const readText = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
};

const readJson = (filePath) => JSON.parse(readText(filePath));

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
        if (SOURCE_EXTENSIONS.has(path.extname(absolute))) files.push(absolute);
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
          if (SOURCE_EXTENSIONS.has(path.extname(absolute))) files.push(absolute);
        });
      }
    }
  }

  return files;
};

const extractImports = (sourceText) => {
  const imports = [];
  for (const match of sourceText.matchAll(/from\s+["']([^"']+)["']/g)) {
    imports.push(match[1]);
  }
  for (const match of sourceText.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    imports.push(match[1]);
  }
  return imports;
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
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error("[merge-wrapper-adoption] missing catalog: governance/package-catalog.json");
    process.exit(1);
  }

  const catalog = readJson(CATALOG_PATH);
  const packageCatalog = catalog?.packages || {};
  const mergedPackageNames = new Set(
    Object.entries(packageCatalog)
      .filter(([, meta]) => meta?.action === "merge")
      .map(([name]) => name),
  );

  const errors = [];
  const sourceFiles = collectSourceFiles();
  for (const absoluteFile of sourceFiles) {
    const relFile = path.relative(ROOT, absoluteFile).replace(/\\/g, "/");
    const sourceText = readText(absoluteFile);
    const imports = extractImports(sourceText);
    for (const specifier of imports) {
      if (mergedPackageNames.has(specifier)) {
        errors.push(`source import uses merged package: ${relFile} -> ${specifier}`);
      }
    }
  }

  const manifests = collectWorkspacePackageJsonPaths();
  for (const manifestPath of manifests) {
    const relManifest = path.relative(ROOT, manifestPath).replace(/\\/g, "/");
    const manifest = readJson(manifestPath);
    const packageName = String(manifest?.name || "");
    const deps = collectInternalDependencyNames(manifest);
    for (const depName of deps) {
      if (!mergedPackageNames.has(depName)) continue;
      if (packageName === depName) continue;
      errors.push(`package dependency uses merged package: ${relManifest} -> ${depName}`);
    }
  }

  if (errors.length > 0) {
    console.error("[merge-wrapper-adoption] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[merge-wrapper-adoption] PASS mergedPackages=${mergedPackageNames.size} sourceFiles=${sourceFiles.length} manifests=${manifests.length}`,
  );
};

main();
