import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = dirname(fileURLToPath(import.meta.url));

const testFiles = ["contextMenu.test.mjs"];

for (const testFile of testFiles) {
  const result = spawnSync(
    process.execPath,
    ["--experimental-specifier-resolution=node", join(testsDir, testFile)],
    {
      stdio: "inherit",
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.signal) {
    process.kill(process.pid, result.signal);
  }
}
