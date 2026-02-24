import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagesDir = path.join(root, "packages");

const ensureDot = (p) => {
  if (!p) return p;
  return p.startsWith("./") ? p : `./${p}`;
};

const toEntry = (value) => {
  if (typeof value === "string") {
    return { default: value };
  }
  return value && typeof value === "object" ? { ...value } : {};
};

const updateExports = (pkg) => {
  const typesPath = ensureDot(pkg.types || "dist/index.d.ts");
  const devPath = "./src/index.ts";

  const importPath = ensureDot(
    pkg.module || pkg.main || "dist/index.js"
  );
  const requirePath = ensureDot(pkg.main || "dist/index.cjs");

  let exportsField = pkg.exports;
  if (!exportsField || typeof exportsField !== "object") {
    exportsField = {};
  }

  if (exportsField["."]) {
    const entry = toEntry(exportsField["."]);
    if (!entry.development) entry.development = devPath;
    if (!entry.types) entry.types = typesPath;
    if (!entry.import) entry.import = importPath;
    if (!entry.require) entry.require = requirePath;
    if (!entry.default) entry.default = entry.import || importPath;
    exportsField["."] = entry;
  } else if (
    exportsField.import ||
    exportsField.require ||
    exportsField.default ||
    exportsField.types
  ) {
    const entry = toEntry(exportsField);
    if (!entry.development) entry.development = devPath;
    if (!entry.types) entry.types = typesPath;
    if (!entry.import) entry.import = importPath;
    if (!entry.require) entry.require = requirePath;
    if (!entry.default) entry.default = entry.import || importPath;
    exportsField = { ".": entry };
  } else {
    const entry = {
      development: devPath,
      types: typesPath,
      import: importPath,
      require: requirePath,
      default: importPath,
    };
    exportsField["."] = entry;
  }

  pkg.exports = exportsField;
  return pkg;
};

const collectPackageDirs = () => {
  const dirs = [];
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const level1 = path.join(packagesDir, entry.name);
    if (fs.existsSync(path.join(level1, "package.json"))) {
      dirs.push(level1);
      continue;
    }
    for (const nested of fs.readdirSync(level1, { withFileTypes: true })) {
      if (!nested.isDirectory()) {
        continue;
      }
      const level2 = path.join(level1, nested.name);
      if (fs.existsSync(path.join(level2, "package.json"))) {
        dirs.push(level2);
      }
    }
  }
  return dirs;
};

const packageDirs = collectPackageDirs();

for (const dir of packageDirs) {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) continue;
  const raw = fs.readFileSync(pkgPath, "utf8");
  const cleaned = raw.replace(/^\uFEFF/, "");
  const pkg = JSON.parse(cleaned);
  const next = updateExports(pkg);
  fs.writeFileSync(pkgPath, JSON.stringify(next, null, 2) + "\n", "utf8");
}

console.log("Updated exports for packages");
