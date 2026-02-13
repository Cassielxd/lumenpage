const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(__dirname, "..", "src", "assets");
const destDir = path.resolve(__dirname, "..", "dist", "assets");

const copyDir = (from, to) => {
  if (!fs.existsSync(from)) {
    return;
  }
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

copyDir(srcDir, destDir);
