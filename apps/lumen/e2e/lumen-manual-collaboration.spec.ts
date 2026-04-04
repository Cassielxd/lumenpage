import { expect, test } from "@playwright/test";

import {
  attachConsoleGuards,
  getDocumentSnapshot,
  setParagraphDocument,
  waitForLayoutIdle,
} from "./helpers";

const backendPort = process.env.PW_COLLAB_PORT || "15345";
const backendHost = process.env.PW_COLLAB_HOST || "localhost";
const backendBaseUrl = process.env.PW_BACKEND_BASE_URL || `http://${backendHost}:${backendPort}`;
const backendStorageKey = "lumenpage-lumen-backend-url";

const createSeed = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const waitForSyncedStatus = async (page: import("@playwright/test").Page) => {
  await expect
    .poll(
      async () => {
        const labels = await page.locator(".collab-status-label").allTextContents();
        return labels.some((label) => label.trim() === "Synced");
      },
      { timeout: 15000, message: "expected collaboration status to reach Synced" },
    )
    .toBeTruthy();
};

test("document workspace loads a local snapshot and starts collaboration in place", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);
  const api = page.context().request;
  const seed = createSeed();
  const email = `manual-collab-${seed}@example.com`;
  const seededParagraph = `Manual collaboration seed ${seed}`;

  const registerResponse = await api.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email,
      password: "password123",
      displayName: "Manual Collab Owner",
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

  const createResponse = await api.post(`${backendBaseUrl}/api/documents`, {
    data: {
      title: `Manual Collab ${seed}`,
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const createPayload = (await createResponse.json()) as {
    document?: {
      id?: string;
    };
  };
  const documentId = String(createPayload.document?.id || "");
  expect(documentId).not.toBe("");

  await page.addInitScript(
    ([storageKey, backendUrl]) => {
      window.localStorage.setItem(storageKey, backendUrl);
    },
    [backendStorageKey, backendBaseUrl] as const,
  );

  await page.goto(`/docs/${documentId}?locale=en-US&collab=1`, {
    waitUntil: "networkidle",
  });

  await waitForSyncedStatus(page);
  await setParagraphDocument(page, [seededParagraph]);
  await waitForLayoutIdle(page);
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(seededParagraph);

  await page.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
    waitUntil: "networkidle",
  });

  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(seededParagraph);
  await expect(page.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
  await expect(page.locator(".collab-status-label")).toHaveCount(0);

  await page.evaluate(() => {
    (window as typeof window & { __pwManualCollabMarker?: string }).__pwManualCollabMarker =
      "manual-collab-marker";
  });

  await page.locator('[data-floating-action="collaboration"]').click();
  await expect(page.locator(".doc-collaboration-panel-empty-title")).toContainText(
    "Collaboration is currently off",
  );
  await page.locator('[data-collaboration-action="apply"]').click();

  await waitForSyncedStatus(page);
  await expect(page.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as typeof window & { __pwManualCollabMarker?: string }).__pwManualCollabMarker ||
            null,
        ),
      { message: "collaboration should start without a full page reload" },
    )
    .toBe("manual-collab-marker");
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(seededParagraph);

  guards.assertClean();
});
