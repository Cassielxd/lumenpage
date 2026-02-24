#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const MODE = process.argv[2] || "list";
const TASK = process.argv[3] || "typecheck";

const ROOT_WIDE_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
]);

const toPosix = (value) => String(value || "").replace(/\\/g, "/");

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(sanitized);
};

const collectWorkspaceManifests = () => {
  const manifests = [];

  const appsDir = path.join(ROOT, "apps");
  if (fs.existsSync(appsDir)) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(appsDir, entry.name, "package.json");
      if (fs.existsSync(manifestPath)) {
        manifests.push(manifestPath);
      }
    }
  }

  const packagesDir = path.join(ROOT, "packages");
  if (fs.existsSync(packagesDir)) {
    for (const level1 of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (!level1.isDirectory()) continue;
      const level1Dir = path.join(packagesDir, level1.name);
      for (const level2 of fs.readdirSync(level1Dir, { withFileTypes: true })) {
        if (!level2.isDirectory()) continue;
        const manifestPath = path.join(level1Dir, level2.name, "package.json");
        if (fs.existsSync(manifestPath)) {
          manifests.push(manifestPath);
        }
      }
    }
  }

  return manifests;
};

const collectWorkspaces = () => {
  const manifests = collectWorkspaceManifests();
  const byName = new Map();

  for (const manifestPath of manifests) {
    const manifest = readJson(manifestPath);
    const name = String(manifest?.name || "");
    if (!name) continue;

    const dir = toPosix(path.relative(ROOT, path.dirname(manifestPath)));
    const deps = new Set();
    for (const depSource of [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies,
    ]) {
      if (!depSource || typeof depSource !== "object") continue;
      for (const depName of Object.keys(depSource)) {
        if (String(depName).startsWith("lumenpage-")) {
          deps.add(depName);
        }
      }
    }

    byName.set(name, { name, dir, deps: [...deps] });
  }

  // drop deps that are not workspace local
  for (const entry of byName.values()) {
    entry.deps = entry.deps.filter((dep) => byName.has(dep));
  }

  return byName;
};

const parseDiffOutput = (output) =>
  String(output || "")
    .split(/\r?\n/)
    .map((item) => toPosix(item.trim()))
    .filter(Boolean);

const runDiff = (args) => {
  const extraArgs = String(args || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const result = spawnSync("git", ["diff", "--name-only", ...extraArgs], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    shell: false,
  });
  if (result.error) {
    return [];
  }
  if (result.status !== 0 && result.status !== 1) {
    return [];
  }
  return parseDiffOutput(result.stdout);
};

const getChangedFiles = () => {
  const explicitFiles = process.env.AFFECTED_FILES;
  if (explicitFiles && explicitFiles.trim().length > 0) {
    return explicitFiles
      .split(/\r?\n|,/)
      .map((item) => toPosix(item.trim()))
      .filter(Boolean);
  }

  const preferredRange = process.env.AFFECTED_DIFF;
  if (preferredRange) {
    return runDiff(preferredRange);
  }

  const base = process.env.AFFECTED_BASE;
  if (base) {
    return runDiff(`${base}...HEAD`);
  }

  // local default: include staged + unstaged changes relative to HEAD
  const local = runDiff("HEAD");
  if (local.length > 0) {
    return local;
  }

  // fallback for repos without commits or detached situations
  return runDiff("");
};

const resolveDirectlyAffected = (workspaces, changedFiles) => {
  const affected = new Set();
  const files = changedFiles.map(toPosix);

  if (files.some((file) => ROOT_WIDE_FILES.has(file))) {
    for (const name of workspaces.keys()) {
      affected.add(name);
    }
    return affected;
  }

  for (const file of files) {
    for (const entry of workspaces.values()) {
      if (file === entry.dir || file.startsWith(`${entry.dir}/`)) {
        affected.add(entry.name);
      }
    }
  }

  return affected;
};

const expandDependents = (workspaces, initial) => {
  const reverseDeps = new Map();
  for (const name of workspaces.keys()) {
    reverseDeps.set(name, new Set());
  }
  for (const entry of workspaces.values()) {
    for (const dep of entry.deps) {
      if (!reverseDeps.has(dep)) reverseDeps.set(dep, new Set());
      reverseDeps.get(dep).add(entry.name);
    }
  }

  const queue = [...initial];
  const affected = new Set(initial);
  while (queue.length > 0) {
    const current = queue.shift();
    const dependents = reverseDeps.get(current);
    if (!dependents) continue;
    for (const dep of dependents) {
      if (affected.has(dep)) continue;
      affected.add(dep);
      queue.push(dep);
    }
  }
  return affected;
};

const listAffected = () => {
  const workspaces = collectWorkspaces();
  const changedFiles = getChangedFiles();
  const direct = resolveDirectlyAffected(workspaces, changedFiles);
  const expanded = expandDependents(workspaces, direct);
  return [...expanded].sort();
};

const runTask = (task) => {
  const affected = listAffected();
  if (affected.length === 0) {
    console.log("[affected] no workspace changes detected");
    return 0;
  }

  const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const args = ["-r"];
  for (const name of affected) {
    args.push("--filter", name);
  }
  args.push(task);

  console.log(`[affected] task=${task} packages=${affected.length}`);
  const result = spawnSync(pnpmBin, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });
  return result.status ?? 1;
};

const main = () => {
  if (MODE === "list") {
    const affected = listAffected();
    for (const name of affected) {
      console.log(name);
    }
    return;
  }

  if (MODE === "run") {
    const code = runTask(TASK);
    process.exit(code);
  }

  console.error('usage: node scripts/affected-packages.mjs <list|run> [task]');
  process.exit(1);
};

main();
