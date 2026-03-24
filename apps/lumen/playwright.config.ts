import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PW_PORT || "4173");
const HOST = process.env.PW_HOST || "127.0.0.1";
const baseURL = process.env.PW_BASE_URL || `http://${HOST}:${PORT}`;
const collabPort = Number(process.env.PW_COLLAB_PORT || "15345");
const collabHost = process.env.PW_COLLAB_HOST || HOST;
const collabHealthURL = process.env.PW_COLLAB_HEALTH_URL || `http://${collabHost}:${collabPort}/health`;
const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html"]] : "line",
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1600, height: 1000 },
      },
    },
  ],
  webServer: [
    {
      command: `node ./e2e/preview-server.mjs ${HOST} ${PORT}`,
      cwd: appDir,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: "node ../collab-server/src/server.mjs",
      cwd: appDir,
      url: collabHealthURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        ...process.env,
        PORT: String(collabPort),
        HOCUSPOCUS_QUIET: "true",
        COLLAB_STORAGE_DIR: "./data-playwright",
      },
    },
  ],
});
