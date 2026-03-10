#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "governance", "package-catalog.json");
const VALID_VISIBILITY = new Set(["public", "internal", "app-only"]);

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(sanitized);
};

const layerFromRelativePath = (relativePath) => {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("packages/lp/")) return "lp";
  if (!normalized.startsWith("packages/")) {
    if (normalized.startsWith("apps/")) return "apps";
    return "unknown";
  }

  const segments = normalized.split("/");
  const pkgDir = segments[1];
  if (pkgDir === "core" || pkgDir === "link") return "core";
  if (pkgDir === "layout-engine" || pkgDir === "view-canvas" || pkgDir === "view-runtime") return "engine";
  if (pkgDir === "dev-tools") return "tooling";
  if (pkgDir) return "extensions";
  return "unknown";
};

const collectWorkspacePackageJsonPaths = () => {
  const found = [];

  const appsDir = path.join(ROOT, "apps");
  if (fs.existsSync(appsDir)) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = path.join(appsDir, entry.name, "package.json");
      if (fs.existsSync(manifest)) {
        found.push(manifest);
      }
    }
  }

  const packagesDir = path.join(ROOT, "packages");
  if (fs.existsSync(packagesDir)) {
    for (const level1 of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (!level1.isDirectory()) continue;
      const level1Dir = path.join(packagesDir, level1.name);

      const directManifest = path.join(level1Dir, "package.json");
      if (fs.existsSync(directManifest)) {
        found.push(directManifest);
      }

      for (const level2 of fs.readdirSync(level1Dir, { withFileTypes: true })) {
        if (!level2.isDirectory()) continue;
        const nestedManifest = path.join(level1Dir, level2.name, "package.json");
        if (fs.existsSync(nestedManifest)) {
          found.push(nestedManifest);
        }
      }
    }
  }

  return found;
};

const extractInternalDeps = (manifest) => {
  const names = new Set();
  const addDeps = (source) => {
    if (!source || typeof source !== "object") return;
    for (const name of Object.keys(source)) {
      if (name.startsWith("lumenpage-")) {
        names.add(name);
      }
    }
  };
  addDeps(manifest.dependencies);
  addDeps(manifest.peerDependencies);
  addDeps(manifest.optionalDependencies);
  return [...names];
};

const main = () => {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`[governance-check] missing catalog: ${path.relative(ROOT, CATALOG_PATH)}`);
    process.exit(1);
  }

  const catalog = readJson(CATALOG_PATH);
  const allowedByLayer = catalog.allowedDependencyLayers || {};
  const packageCatalog = catalog.packages || {};

  const manifests = collectWorkspacePackageJsonPaths();
  const discovered = new Map();
  const errors = [];

  for (const manifestPath of manifests) {
    const manifest = readJson(manifestPath);
    const name = manifest?.name;
    if (!name || !name.startsWith("lumenpage-")) {
      continue;
    }
    const rel = path.relative(ROOT, manifestPath);
    const layer = layerFromRelativePath(rel);
    const deps = extractInternalDeps(manifest);
    discovered.set(name, { layer, rel, deps });
  }

  for (const [name, meta] of discovered.entries()) {
    const record = packageCatalog[name];
    if (!record) {
      errors.push(`missing catalog entry: ${name} (${meta.rel})`);
      continue;
    }
    if (record.layer !== meta.layer) {
      errors.push(
        `layer mismatch: ${name} catalog=${record.layer} actual=${meta.layer} (${meta.rel})`,
      );
    }
    if (!VALID_VISIBILITY.has(record.visibility)) {
      errors.push(`invalid visibility: ${name} -> ${String(record.visibility)}`);
    }
    const allowed = allowedByLayer[meta.layer];
    if (!Array.isArray(allowed) || allowed.length === 0) {
      errors.push(`no allowedDependencyLayers rule for layer=${meta.layer}`);
      continue;
    }
    for (const dep of meta.deps) {
      const target = discovered.get(dep);
      if (!target) {
        errors.push(`unknown internal dependency: ${name} -> ${dep}`);
        continue;
      }
      if (!allowed.includes(target.layer)) {
        errors.push(
          `reverse dependency violation: ${name}(${meta.layer}) -> ${dep}(${target.layer})`,
        );
      }
    }
  }

  for (const name of Object.keys(packageCatalog)) {
    if (!discovered.has(name)) {
      errors.push(`stale catalog entry (not found in workspace): ${name}`);
    }
  }

  if (errors.length > 0) {
    console.error("[governance-check] FAIL");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[governance-check] PASS packages=${discovered.size}`);
};

main();

