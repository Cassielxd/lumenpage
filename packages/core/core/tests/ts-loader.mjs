import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const workspacePackageRoots = {
  "lumenpage-core": "packages/core/core/src",
  "lumenpage-commands": "packages/lp/commands/src",
  "lumenpage-inputrules": "packages/lp/inputrules/src",
  "lumenpage-keymap": "packages/lp/keymap/src",
  "lumenpage-layout-engine": "packages/engine/layout-engine/src",
  "lumenpage-link": "packages/core/link/src",
  "lumenpage-model": "packages/lp/model/src",
  "lumenpage-state": "packages/lp/state/src",
  "lumenpage-transform": "packages/lp/transform/src",
  "lumenpage-view-canvas": "packages/engine/view-canvas/src",
  "lumenpage-view-runtime": "packages/engine/view-runtime/src",
};

const resolveFileCandidate = (candidatePath) => {
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  return null;
};

const resolveDirectoryCandidate = (candidatePath) => {
  const indexTsPath = path.join(candidatePath, "index.ts");

  if (fs.existsSync(indexTsPath) && fs.statSync(indexTsPath).isFile()) {
    return indexTsPath;
  }

  return null;
};

const resolveRelativeTsSpecifier = (specifier, parentURL) => {
  const parentPath = parentURL ? fileURLToPath(parentURL) : process.cwd();
  const basePath = specifier.startsWith("/")
    ? specifier
    : path.resolve(path.dirname(parentPath), specifier);

  const directCandidate = resolveFileCandidate(basePath);

  if (directCandidate) {
    return directCandidate;
  }

  for (const extension of [".ts", ".js", ".mjs"]) {
    const candidate = resolveFileCandidate(`${basePath}${extension}`);

    if (candidate) {
      return candidate;
    }
  }

  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    const directoryCandidate = resolveDirectoryCandidate(basePath);

    if (directoryCandidate) {
      return directoryCandidate;
    }
  }

  return null;
};

const resolveWorkspaceSpecifier = (specifier) => {
  for (const [packageName, relativeRoot] of Object.entries(workspacePackageRoots)) {
    if (specifier !== packageName && !specifier.startsWith(`${packageName}/`)) {
      continue;
    }

    const rootPath = path.resolve(repoRoot, relativeRoot);
    const subpath = specifier === packageName ? "" : specifier.slice(packageName.length + 1);
    const targetPath = subpath ? path.resolve(rootPath, subpath) : rootPath;
    const directCandidate = resolveFileCandidate(targetPath);

    if (directCandidate) {
      return directCandidate;
    }

    for (const extension of [".ts", ".js", ".mjs"]) {
      const candidate = resolveFileCandidate(`${targetPath}${extension}`);

      if (candidate) {
        return candidate;
      }
    }

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      const directoryCandidate = resolveDirectoryCandidate(targetPath);

      if (directoryCandidate) {
        return directoryCandidate;
      }
    }
  }

  return null;
};

export async function resolve(specifier, context, defaultResolve) {
  const workspaceCandidate = resolveWorkspaceSpecifier(specifier);

  if (workspaceCandidate) {
    return {
      url: pathToFileURL(workspaceCandidate).href,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const candidatePath = resolveRelativeTsSpecifier(specifier, context.parentURL);

    if (candidatePath) {
      return {
        url: pathToFileURL(candidatePath).href,
        shortCircuit: true,
      };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.endsWith(".ts")) {
    const filename = fileURLToPath(url);
    const source = await readFile(filename, "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        esModuleInterop: true,
      },
    });

    return {
      format: "module",
      source: outputText,
      shortCircuit: true,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
