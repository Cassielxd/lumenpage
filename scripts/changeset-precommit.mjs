#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function runPnpm(args, options = {}) {
  const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return execFileSync(pnpmBin, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function hasPendingChangesets() {
  try {
    const entries = readdirSync(".changeset");
    return entries.some((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md");
  } catch {
    return false;
  }
}

function getPendingChangesetFiles() {
  try {
    return readdirSync(".changeset")
      .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
      .map((name) => path.join(".changeset", name));
  } catch {
    return [];
  }
}

function getStagedFiles() {
  const output = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMRD"]);
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getStagedPackageFiles(stagedFiles) {
  return stagedFiles.filter((file) => file.startsWith("packages/"));
}

function isReleaseArtifactFile(filePath) {
  return /^packages\/(?:[^/]+\/)?[^/]+\/(?:package\.json|CHANGELOG\.md)$/.test(filePath);
}

function hasNonReleasePackageChanges(packageFiles) {
  return packageFiles.some((file) => !isReleaseArtifactFile(file));
}

function getChangedPackageDirs(packageFiles) {
  const dirs = new Set();
  for (const file of packageFiles) {
    const parts = file.split("/");
    if (parts.length < 2 || parts[0] !== "packages") {
      continue;
    }
    if (parts.length >= 3) {
      const nestedDir = path.join("packages", parts[1], parts[2]);
      if (existsSync(path.join(nestedDir, "package.json"))) {
        dirs.add(nestedDir);
        continue;
      }
    }
    const flatDir = path.join("packages", parts[1]);
    if (existsSync(path.join(flatDir, "package.json"))) {
      dirs.add(flatDir);
    }
  }
  return [...dirs];
}

function getPackageNamesByDirs(packageDirs) {
  const names = [];
  for (const dir of packageDirs) {
    const pkgJsonPath = path.join(dir, "package.json");
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      if (typeof pkg.name === "string" && pkg.name.length > 0) {
        names.push(pkg.name);
      }
    } catch {
      // ignore invalid package folder
    }
  }
  return [...new Set(names)].sort();
}

function createAutoPatchChangeset(packageNames) {
  if (packageNames.length === 0) return null;
  mkdirSync(".changeset", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `.changeset/auto-${stamp}.md`;
  const frontMatter = packageNames.map((name) => `"${name}": patch`).join("\n");
  const content = `---\n${frontMatter}\n---\n\nAuto patch bump for this commit.\n`;
  writeFileSync(fileName, content, "utf8");
  return fileName;
}

function normalizeChangesetToPatch(filePath) {
  const original = readFileSync(filePath, "utf8");
  const match = original.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return false;

  const header = match[1];
  const normalizedHeader = header.replace(/(:\s*)(major|minor)(\s*)$/gm, "$1patch$3");
  if (normalizedHeader === header) return false;

  const [frontMatterBlock] = match;
  const newline = frontMatterBlock.includes("\r\n") ? "\r\n" : "\n";
  const nextFrontMatter = `---${newline}${normalizedHeader}${newline}---`;
  const updated = original.replace(frontMatterBlock, nextFrontMatter);
  writeFileSync(filePath, updated, "utf8");
  return true;
}

try {
  const stagedFiles = getStagedFiles();
  const stagedPackageFiles = getStagedPackageFiles(stagedFiles);
  if (stagedPackageFiles.length === 0) {
    process.exit(0);
  }

  let pendingFiles = getPendingChangesetFiles();
  if (!hasPendingChangesets()) {
    if (!hasNonReleasePackageChanges(stagedPackageFiles)) {
      // Avoid bump loops when commit already contains only package.json/CHANGELOG updates.
      process.exit(0);
    }
    const changedDirs = getChangedPackageDirs(stagedPackageFiles);
    const packageNames = getPackageNamesByDirs(changedDirs);
    const createdFile = createAutoPatchChangeset(packageNames);
    if (!createdFile) {
      process.exit(0);
    }
    pendingFiles = [createdFile];
    console.log(
      `[changeset-hook] Created auto patch changeset for: ${packageNames.join(", ") || "none"}`,
    );
  }

  const changedFiles = pendingFiles;
  let normalizedCount = 0;
  for (const file of changedFiles) {
    if (normalizeChangesetToPatch(file)) {
      normalizedCount += 1;
    }
  }
  if (normalizedCount > 0) {
    console.log(
      `[changeset-hook] Normalized ${normalizedCount} changeset file(s) to patch bump.`,
    );
  }

  console.log("[changeset-hook] Running changeset version...");
  runPnpm(["changeset:version"], { stdio: "inherit" });

  console.log("[changeset-hook] Staging version/changelog updates...");
  runGit(["add", "-A", ".changeset", "packages", "pnpm-lock.yaml"], { stdio: "inherit" });
} catch (error) {
  console.error("[changeset-hook] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
