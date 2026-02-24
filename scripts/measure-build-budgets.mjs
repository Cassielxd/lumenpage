#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUDGET_PATH = path.join(ROOT, "governance", "perf-budget.json");

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(sanitized);
};

const splitCommand = (command) => {
  if (!command) return [];
  if (Array.isArray(command)) return command.filter((item) => typeof item === "string" && item.length > 0);
  if (typeof command !== "string") return [];
  return command
    .trim()
    .split(/\s+/)
    .filter(Boolean);
};

const runWithTiming = (commandArgs, label) => {
  if (commandArgs.length === 0) {
    throw new Error("empty command");
  }
  const commandLine = commandArgs
    .map((token) => (/[^\w./:-]/.test(token) ? `"${token.replace(/"/g, '\\"')}"` : token))
    .join(" ");
  const start = process.hrtime.bigint();
  execSync(commandLine, { cwd: ROOT, stdio: "inherit", shell: true });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  const rounded = Math.round(elapsedMs * 10) / 10;
  console.log(`[build-budget] ${label}=${rounded}ms`);
  return rounded;
};

const main = () => {
  if (!fs.existsSync(BUDGET_PATH)) {
    console.error("[build-budget] missing config: governance/perf-budget.json");
    process.exit(1);
  }

  const budget = readJson(BUDGET_PATH);
  const fallbackCommand = ["pnpm", "build:app"];
  const configuredCommand = splitCommand(budget?.buildTimeMs?.command);
  const envCommand = splitCommand(process.env.BUILD_BUDGET_COMMAND);
  const command = envCommand.length > 0 ? envCommand : configuredCommand.length > 0 ? configuredCommand : fallbackCommand;

  const coldBuildMs = runWithTiming(command, "cold");
  const incrementalBuildMs = runWithTiming(command, "incremental");

  const snapshotPath = path.join(
    ROOT,
    typeof budget?.buildTimeMs?.snapshotPath === "string"
      ? budget.buildTimeMs.snapshotPath
      : "governance/build-budget-snapshot.json",
  );
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });

  const snapshot = {
    version: 1,
    measuredAt: new Date().toISOString(),
    command,
    coldBuildMs,
    incrementalBuildMs,
  };
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`[build-budget] wrote ${path.relative(ROOT, snapshotPath)}`);
};

main();
