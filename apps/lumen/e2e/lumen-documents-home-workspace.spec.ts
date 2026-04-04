import { expect, test } from "@playwright/test";

import { attachConsoleGuards, focusEditor, getDocumentSnapshot, waitForLayoutIdle } from "./helpers";

const backendPort = process.env.PW_COLLAB_PORT || "15345";
const backendHost = process.env.PW_COLLAB_HOST || "localhost";
const backendBaseUrl = process.env.PW_BACKEND_BASE_URL || `http://${backendHost}:${backendPort}`;
const backendStorageKey = "lumenpage-lumen-backend-url";

const createSeed = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("documents home creates a document and opens an editable local workspace", async ({ page }) => {
  const guards = attachConsoleGuards(page);
  const api = page.context().request;
  const seed = createSeed();
  const email = `documents-home-${seed}@example.com`;
  const title = `Home Flow ${seed}`;
  const typedText = `Editable workspace ${seed}`;

  const registerResponse = await api.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email,
      password: "password123",
      displayName: "Home Flow Owner",
    },
  });
  expect(registerResponse.ok()).toBeTruthy();

  const backendCookies = await page.context().cookies(backendBaseUrl);
  await page.context().addCookies(
    backendCookies.map((cookie) => ({
      ...cookie,
      domain: backendHost,
      url: undefined,
    })),
  );

  await page.addInitScript(
    ([storageKey, backendUrl]) => {
      window.localStorage.setItem(storageKey, backendUrl);
    },
    [backendStorageKey, backendBaseUrl] as const,
  );

  await page.goto("/", {
    waitUntil: "networkidle",
  });

  const createSection = page.locator(".doc-home-create");
  await expect(createSection.locator("button")).toBeEnabled();
  await createSection.locator(".t-input__inner").fill(title);
  await createSection.getByRole("button").click();

  await expect(page).toHaveURL(/\/docs\/[^/?#]+$/);
  await expect(page.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
  await expect(page.locator(".collab-status-label")).toHaveCount(0);

  await focusEditor(page);
  await page.keyboard.type(typedText);
  await waitForLayoutIdle(page);

  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(typedText);

  guards.assertClean();
});
