#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "apps", "lumen", "src", "editor", "toolbarCatalog.ts");
const OUTPUT_PATH = path.join(ROOT, "docs", "lumen-menu-feature-checklist.md");

const readText = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
};

const loadToolbarCatalogModule = () => {
  const source = readText(CATALOG_PATH);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
    fileName: CATALOG_PATH,
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (specifier) => {
      throw new Error(`unsupported runtime dependency while loading toolbar catalog: ${specifier}`);
    },
    __dirname: path.dirname(CATALOG_PATH),
    __filename: CATALOG_PATH,
    console,
    process,
  });

  vm.runInContext(transpiled, context, { filename: CATALOG_PATH });
  return module.exports;
};

const normalizeLineEndings = (text) => text.replace(/\r\n/g, "\n");

const getToday = () => new Date().toISOString().slice(0, 10);

const buildChecklist = () => {
  const runtime = loadToolbarCatalogModule();
  const groups = runtime.TOOLBAR_MENU_GROUPS;
  const tabs = runtime.TOOLBAR_MENU_TABS;

  if (!groups || typeof groups !== "object") {
    throw new Error("TOOLBAR_MENU_GROUPS not found in toolbar catalog");
  }
  if (!Array.isArray(tabs) || tabs.length === 0) {
    throw new Error("TOOLBAR_MENU_TABS not found in toolbar catalog");
  }

  const menuOrder = tabs.map((tab) => String(tab?.value || "")).filter(Boolean);
  const total = menuOrder.reduce((sum, key) => {
    const sectionGroups = Array.isArray(groups[key]) ? groups[key] : [];
    return (
      sum +
      sectionGroups.reduce(
        (sectionSum, group) => sectionSum + (Array.isArray(group?.items) ? group.items.length : 0),
        0,
      )
    );
  }, 0);
  const done = menuOrder.reduce((sum, key) => {
    const sectionGroups = Array.isArray(groups[key]) ? groups[key] : [];
    return (
      sum +
      sectionGroups.reduce(
        (sectionSum, group) =>
          sectionSum +
          (Array.isArray(group?.items)
            ? group.items.filter((item) => item?.implemented === true).length
            : 0),
        0,
      )
    );
  }, 0);
  const pending = total - done;

  const lines = [
    "# Lumen Menu Feature Checklist (Auto Synced)",
    "",
    "- Source: `apps/lumen/src/editor/toolbarCatalog.ts`",
    "- Rule: `implemented=true` means checked.",
    `- Stats: total \`${total}\`, done \`${done}\`, pending \`${pending}\`.`,
    "- Product completeness baseline: see `docs/lumen-product-completion-plan.md` (该文档为产品态口径，不等于 `implemented=true`)。",
    `- Updated: ${getToday()}`,
    "",
  ];

  for (const key of menuOrder) {
    const sectionGroups = Array.isArray(groups[key]) ? groups[key] : [];
    const items = sectionGroups.flatMap((group) => (Array.isArray(group?.items) ? group.items : []));
    const sectionDone = items.filter((item) => item?.implemented === true).length;
    lines.push(`## ${key} (${sectionDone}/${items.length})`, "");

    for (const item of items) {
      const checked = item?.implemented === true ? "x" : " ";
      const label =
        item?.label?.["en-US"] || item?.label?.["zh-CN"] || item?.action || item?.id || "Unknown";
      const commandText = item?.command ? `, command: \`${item.command}\`` : "";
      lines.push(
        `- [${checked}] \`${item.id}\` (${label}), action: \`${item.action}\`${commandText}`,
      );
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
};

const main = () => {
  const nextContent = buildChecklist();
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    const currentContent = fs.existsSync(OUTPUT_PATH) ? readText(OUTPUT_PATH) : "";
    if (normalizeLineEndings(currentContent) !== normalizeLineEndings(nextContent)) {
      console.error("[lumen-menu-checklist] FAIL docs/lumen-menu-feature-checklist.md is out of sync");
      process.exit(1);
    }
    console.log("[lumen-menu-checklist] PASS");
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, nextContent, "utf8");
  console.log(
    `[lumen-menu-checklist] SYNCED ${path.relative(ROOT, OUTPUT_PATH).replace(/\\/g, "/")}`,
  );
};

main();
