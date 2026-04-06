import { expect, test, type Page } from "@playwright/test";

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

const applyBackendBootstrap = async (page: Page) => {
  await page.addInitScript(
    ([storageKey, backendUrl]) => {
      window.localStorage.setItem(storageKey, backendUrl);
    },
    [backendStorageKey, backendBaseUrl] as const,
  );
};

const bootstrapOwnedDocument = async (page: Page) => {
  const api = page.context().request;
  const seed = createSeed();
  const email = `manual-collab-${seed}@example.com`;

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

  await applyBackendBootstrap(page);

  return {
    api,
    seed,
    documentId,
  };
};

const overrideCollabTicket = async (
  page: Page,
  documentId: string,
  mutate: (collab: Record<string, unknown>) => void,
) => {
  await page.route(`**/api/documents/${documentId}/collab-ticket`, async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      collab?: Record<string, unknown>;
    };
    expect(payload.collab).toBeTruthy();
    mutate(payload.collab!);
    await route.fulfill({
      status: response.status(),
      headers: {
        ...response.headers(),
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  });
};

const overrideCollabTicketAttempts = async (
  page: Page,
  documentId: string,
  mutate: (collab: Record<string, unknown>, attempt: number) => void,
) => {
  let attempt = 0;
  await page.route(`**/api/documents/${documentId}/collab-ticket`, async (route) => {
    attempt += 1;
    const response = await route.fetch();
    const payload = (await response.json()) as {
      collab?: Record<string, unknown>;
    };
    expect(payload.collab).toBeTruthy();
    mutate(payload.collab!, attempt);
    await route.fulfill({
      status: response.status(),
      headers: {
        ...response.headers(),
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  });
};

const failCollabTicket = async (page: Page, documentId: string, errorMessage: string) => {
  await page.route(`**/api/documents/${documentId}/collab-ticket`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: errorMessage,
      }),
    });
  });
};

const waitForStatusText = async (page: Page, selector: string, expected: string) => {
  await expect
    .poll(
      async () => {
        const labels = await page.locator(selector).allTextContents();
        return labels.some((label) => label.includes(expected));
      },
      {
        timeout: 15000,
        message: `expected ${selector} to include "${expected}"`,
      },
    )
    .toBeTruthy();
};

const waitForSyncedStatus = async (page: Page) => {
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

const readBackendSnapshot = async (page: Page, documentId: string) => {
  const response = await page.context().request.get(
    `${backendBaseUrl}/api/documents/${documentId}/collab-snapshot`,
  );
  if (!response.ok()) {
    return "";
  }
  const payload = (await response.json()) as { snapshot?: string };
  return String(payload.snapshot || "");
};

const waitForBackendSnapshotChange = async (page: Page, documentId: string, previous: string) => {
  await expect
    .poll(async () => readBackendSnapshot(page, documentId))
    .not.toBe(previous);
};

test("document workspace loads a local snapshot and starts collaboration in place", async ({
  page,
}) => {
  const guards = attachConsoleGuards(page);
  const { seed, documentId } = await bootstrapOwnedDocument(page);
  const seededParagraph = `Manual collaboration seed ${seed}`;

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

test("document workspace falls back to the local snapshot when collaboration ticket bootstrap fails", async ({
  page,
}) => {
  const { seed, documentId } = await bootstrapOwnedDocument(page);
  const seededParagraph = `Manual collab fallback ${seed}`;

  await page.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
    waitUntil: "networkidle",
  });
  const baselineSnapshot = await readBackendSnapshot(page, documentId);
  await setParagraphDocument(page, [seededParagraph]);
  await waitForLayoutIdle(page);
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(seededParagraph);
  await waitForBackendSnapshotChange(page, documentId, baselineSnapshot);

  await failCollabTicket(page, documentId, "Ticket expired");

  await page.goto(`/docs/${documentId}?locale=en-US&collab=1`, {
    waitUntil: "networkidle",
  });

  await expect(page.locator(".collab-status-label")).toHaveCount(0);
  await expect(page.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(seededParagraph);

  await page.locator('[data-floating-action="collaboration"]').click();
  await waitForStatusText(page, ".doc-collaboration-panel-error", "Ticket expired");
  await expect(page.locator(".doc-collaboration-panel-empty-title")).toContainText(
    "Collaboration is currently off",
  );
});

test("document workspace surfaces disconnected collaboration state when the ticket points to an unavailable server", async ({
  page,
}) => {
  const { documentId } = await bootstrapOwnedDocument(page);

  await overrideCollabTicket(page, documentId, (collab) => {
    collab.url = "ws://127.0.0.1:65534";
  });

  await page.goto(`/docs/${documentId}?locale=en-US&collab=1`, {
    waitUntil: "networkidle",
  });

  await waitForStatusText(page, ".collab-status-label", "Disconnected");
  await waitForStatusText(page, ".collab-status-meta", "Disconnected");

  await page.locator('[data-floating-action="collaboration"]').click();
  await waitForStatusText(page, ".doc-collaboration-panel-summary", "Disconnected");
  await expect(page.locator(".doc-collaboration-panel-error")).toHaveCount(0);
  await expect(page.locator('[data-collaboration-action="apply"]')).toContainText("Reconnect");
});

test("disconnected collaboration reconnects in place after retrying from the panel", async ({
  page,
}) => {
  const { seed, documentId } = await bootstrapOwnedDocument(page);
  const seededParagraph = `Manual collab reconnect ${seed}`;

  await page.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
    waitUntil: "networkidle",
  });
  const baselineSnapshot = await readBackendSnapshot(page, documentId);
  await setParagraphDocument(page, [seededParagraph]);
  await waitForLayoutIdle(page);
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(seededParagraph);
  await waitForBackendSnapshotChange(page, documentId, baselineSnapshot);

  await overrideCollabTicketAttempts(page, documentId, (collab, attempt) => {
    if (attempt === 1) {
      collab.url = "ws://127.0.0.1:65534";
    }
  });

  await page.goto(`/docs/${documentId}?locale=en-US&collab=1`, {
    waitUntil: "networkidle",
  });

  await waitForStatusText(page, ".collab-status-label", "Disconnected");
  await page.evaluate(() => {
    (window as typeof window & { __pwManualReconnectMarker?: string }).__pwManualReconnectMarker =
      "manual-collab-reconnect";
  });

  await page.locator('[data-floating-action="collaboration"]').click();
  await waitForStatusText(page, ".doc-collaboration-panel-summary", "Disconnected");
  await expect(page.locator('[data-collaboration-action="apply"]')).toContainText("Reconnect");
  await page.locator('[data-collaboration-action="apply"]').click();

  await waitForSyncedStatus(page);
  await waitForStatusText(page, ".doc-collaboration-panel-summary", "Synced");
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as typeof window & { __pwManualReconnectMarker?: string })
              .__pwManualReconnectMarker || null,
        ),
      { message: "reconnecting collaboration should not reload the page" },
    )
    .toBe("manual-collab-reconnect");
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(seededParagraph);
});
