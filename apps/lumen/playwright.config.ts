import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PW_PORT || "4173");
const HOST = process.env.PW_HOST || "localhost";
const baseURL = process.env.PW_BASE_URL || `http://${HOST}:${PORT}`;
const collabPort = Number(process.env.PW_COLLAB_PORT || "15345");
const collabHost = process.env.PW_COLLAB_HOST || HOST;
const collabHealthURL = process.env.PW_COLLAB_HEALTH_URL || `http://${collabHost}:${collabPort}/health`;
const appDir = path.dirname(fileURLToPath(import.meta.url));
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const backendServerCommand = `${pnpmCommand} -C ../backend-server build && node ../backend-server/dist/server.js`;

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
      reuseExistingServer: false,
      timeout: 120 * 1000,
    },
    {
      command: backendServerCommand,
      cwd: appDir,
      url: collabHealthURL,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        ...process.env,
        PORT: String(collabPort),
        BACKEND_QUIET: "true",
        BACKEND_STORAGE_DIR: "./data-playwright",
      },
    },
  ],
});
