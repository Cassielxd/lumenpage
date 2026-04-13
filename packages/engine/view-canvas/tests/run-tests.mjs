import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = dirname(fileURLToPath(import.meta.url));

const testFiles = [
  "overlayGeometry.test.mjs",
  "overlaySyncPolicy.test.mjs",
  "overlayHitTesting.test.mjs",
  "overlayFrame.test.mjs",
  "overlayTracePayload.test.mjs",
  "overlaySyncApply.test.mjs",
  "overlayEntrySync.test.mjs",
  "overlayEntryTarget.test.mjs",
  "overlayVisibilityCommit.test.mjs",
  "decorationWidgetAlignment.test.mjs",
  "selection.test.mjs",
  "pageFragmentPass.test.mjs",
  "pageRenderFragments.test.mjs",
  "pageFragmentSignature.test.mjs",
  "pageCompatSignature.test.mjs",
  "pageCompatPassRuntime.test.mjs",
  "lineCompatAuxiliaryPass.test.mjs",
  "pageLineEntries.test.mjs",
  "lineCompatPrimaryPass.test.mjs",
  "lineCompatContainerPass.test.mjs",
  "lineCompatListMarkerPass.test.mjs",
  "lineRenderPlan.test.mjs",
  "pageDisplayList.test.mjs",
  "pageDisplayListMetadata.test.mjs",
  "pageLineEntrySignature.test.mjs",
];

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
