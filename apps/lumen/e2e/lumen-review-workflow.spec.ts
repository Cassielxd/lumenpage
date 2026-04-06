import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { attachConsoleGuards, focusEditor, getDocumentSnapshot, waitForLayoutIdle } from "./helpers";

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

const registerBackendUser = async (page: Page, email: string, displayName: string) => {
  const response = await page.context().request.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email,
      password: "password123",
      displayName,
    },
  });
  expect(response.ok()).toBeTruthy();
  const backendCookies = await page.context().cookies(backendBaseUrl);
  await page.context().addCookies(
    backendCookies.map((cookie) => ({
      ...cookie,
      domain: backendHost,
      url: undefined,
    })),
  );
};

const createBackendDocument = async (request: APIRequestContext, title: string) => {
  const response = await request.post(`${backendBaseUrl}/api/documents`, {
    data: {
      title,
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    document?: {
      id?: string;
    };
  };
  const documentId = String(payload.document?.id || "");
  expect(documentId).not.toBe("");
  return documentId;
};

const addDocumentMember = async (
  ownerRequest: APIRequestContext,
  documentId: string,
  email: string,
  role: "editor" | "commenter" | "viewer",
) => {
  const response = await ownerRequest.post(`${backendBaseUrl}/api/documents/${documentId}/members`, {
    data: {
      email,
      role,
    },
  });
  expect(response.ok()).toBeTruthy();
};

const createDocumentShareToken = async (
  ownerRequest: APIRequestContext,
  documentId: string,
  role: "editor" | "commenter" | "viewer",
  allowAnonymous: boolean,
) => {
  const response = await ownerRequest.post(`${backendBaseUrl}/api/documents/${documentId}/share-links`, {
    data: {
      role,
      allowAnonymous,
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    shareLink?: {
      token?: string;
    };
  };
  const shareToken = String(payload.shareLink?.token || "");
  expect(shareToken).not.toBe("");
  return shareToken;
};

const waitForBackendSnapshotContaining = async (
  request: APIRequestContext,
  documentId: string,
  expected: string,
) => {
  const decodeSnapshot = (value: string) => {
    if (!value) {
      return "";
    }
    try {
      return Buffer.from(value, "base64").toString("utf8");
    } catch (_error) {
      return value;
    }
  };

  await expect
    .poll(async () => {
      const response = await request.get(`${backendBaseUrl}/api/documents/${documentId}/collab-snapshot`);
      if (!response.ok()) {
        return "";
      }
      const payload = (await response.json()) as { snapshot?: string };
      return decodeSnapshot(String(payload.snapshot || ""));
    })
    .toContain(expected);
};

const openTrackChangesPanel = async (page: Page) => {
  await page.locator('[data-floating-action="changes"]').click();
  await expect(page.locator(".doc-track-changes")).toBeVisible();
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

const setReloadMarker = async (page: Page, value: string) => {
  await page.evaluate((marker) => {
    (window as typeof window & { __pwReviewReloadMarker?: string }).__pwReviewReloadMarker = marker;
  }, value);
};

const expectReloadMarker = async (page: Page, value: string) => {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as typeof window & { __pwReviewReloadMarker?: string }).__pwReviewReloadMarker ||
            null,
        ),
      { message: "enabling realtime collaboration should not reload the page" },
    )
    .toBe(value);
};

const enableCollaborationFromPanel = async (page: Page, marker: string) => {
  await setReloadMarker(page, marker);
  await page.locator('[data-floating-action="collaboration"]').click();
  await expect(page.locator(".doc-collaboration-panel-empty-title")).toBeVisible();
  await page.locator('[data-collaboration-action="apply"]').click();
  await waitForSyncedStatus(page);
  await expectReloadMarker(page, marker);
};

const expectTrackChangeCount = async (page: Page, count: number) => {
  await expect
    .poll(async () => page.locator(".doc-track-changes-item").count(), {
      message: `expected ${count} tracked changes`,
    })
    .toBe(count);
};

const seedTrackedInsertThroughOwnerWorkspace = async ({
  page,
  ownerRequest,
  documentId,
  baseText,
  insertedText,
}: {
  page: Page;
  ownerRequest: APIRequestContext;
  documentId: string;
  baseText: string;
  insertedText: string;
}) => {
  await applyBackendBootstrap(page);
  await page.goto(`/docs/${documentId}?locale=en-US`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");

  await focusEditor(page);
  await page.keyboard.type(baseText);
  await waitForLayoutIdle(page);
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(baseText);
  await waitForBackendSnapshotContaining(ownerRequest, documentId, baseText);

  await openTrackChangesPanel(page);
  await page.getByRole("button", { name: "Enable Tracking" }).click();
  await expect(page.getByRole("button", { name: "Disable Tracking" })).toBeVisible();
  await expect(page.locator(".doc-side-tab-actions .t-tag")).toContainText("On");

  await focusEditor(page);
  await page.keyboard.type(insertedText);
  await waitForLayoutIdle(page);
  await expect
    .poll(async () => {
      const textContent = (await getDocumentSnapshot(page)).textContent;
      return textContent.includes(baseText) && textContent.includes(insertedText);
    })
    .toBeTruthy();
  await waitForBackendSnapshotContaining(ownerRequest, documentId, insertedText.trim());
  await expectTrackChangeCount(page, 1);
};

test("owner can reject a tracked insert from the changes panel", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const ownerRequest = ownerContext.request;
  const guards = attachConsoleGuards(ownerPage);
  const seed = createSeed();
  const ownerEmail = `review-owner-${seed}@example.com`;
  const baseText = `Track changes base ${seed}`;
  const insertedText = ` insert-${seed}`;

  try {
    await registerBackendUser(ownerPage, ownerEmail, "Review Owner");
    const documentId = await createBackendDocument(ownerRequest, `Review ${seed}`);

    await seedTrackedInsertThroughOwnerWorkspace({
      page: ownerPage,
      ownerRequest,
      documentId,
      baseText,
      insertedText,
    });

    await expect(ownerPage.locator(".doc-track-changes-item-text.is-insert")).toContainText(
      insertedText.trim(),
    );
    await ownerPage
      .locator(".doc-track-changes-detail-actions")
      .getByRole("button", { name: "Reject" })
      .click();
    await waitForLayoutIdle(ownerPage);

    await expect
      .poll(async () => (await getDocumentSnapshot(ownerPage)).textContent)
      .toBe(baseText);
    await expectTrackChangeCount(ownerPage, 0);

    guards.assertClean();
  } finally {
    await ownerContext.close();
  }
});

test("comment-only members can review tracked changes but cannot manage them", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const commenterContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const commenterPage = await commenterContext.newPage();
  const ownerRequest = ownerContext.request;
  const guardsOwner = attachConsoleGuards(ownerPage);
  const guardsCommenter = attachConsoleGuards(commenterPage);
  const seed = createSeed();
  const ownerEmail = `review-owner-${seed}@example.com`;
  const commenterEmail = `review-commenter-${seed}@example.com`;
  const baseText = `Track review base ${seed}`;
  const insertedText = ` review-${seed}`;

  try {
    await registerBackendUser(ownerPage, ownerEmail, "Review Owner");
    await registerBackendUser(commenterPage, commenterEmail, "Review Commenter");

    const documentId = await createBackendDocument(ownerRequest, `Review comment ${seed}`);
    await addDocumentMember(ownerRequest, documentId, commenterEmail, "commenter");

    await seedTrackedInsertThroughOwnerWorkspace({
      page: ownerPage,
      ownerRequest,
      documentId,
      baseText,
      insertedText,
    });

    await applyBackendBootstrap(commenterPage);
    await commenterPage.goto(`/docs/${documentId}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expect(commenterPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => {
        const textContent = (await getDocumentSnapshot(commenterPage)).textContent;
        return textContent.includes(baseText) && textContent.includes(insertedText);
      })
      .toBeTruthy();

    await openTrackChangesPanel(commenterPage);
    await expectTrackChangeCount(commenterPage, 1);
    await expect(commenterPage.locator(".doc-track-changes-item-author")).toContainText("Review Owner");
    await expect(commenterPage.locator(".doc-track-changes-item-text.is-insert")).toContainText(
      insertedText.trim(),
    );
    await expect(commenterPage.getByRole("button", { name: "Enable Tracking" })).toBeDisabled();
    await expect(
      commenterPage
        .locator(".doc-track-changes-detail-actions")
        .getByRole("button", { name: "Accept" }),
    ).toBeDisabled();
    await expect(
      commenterPage
        .locator(".doc-track-changes-detail-actions")
        .getByRole("button", { name: "Reject" }),
    ).toBeDisabled();

    guardsOwner.assertClean();
    guardsCommenter.assertClean();
  } finally {
    await ownerContext.close();
    await commenterContext.close();
  }
});

test("owner can manage tracked changes after starting realtime collaboration in place", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const ownerRequest = ownerContext.request;
  const guards = attachConsoleGuards(ownerPage);
  const seed = createSeed();
  const ownerEmail = `review-realtime-owner-${seed}@example.com`;
  const baseText = `Realtime review base ${seed}`;
  const insertedText = ` realtime-${seed}`;

  try {
    await registerBackendUser(ownerPage, ownerEmail, "Realtime Review Owner");
    const documentId = await createBackendDocument(ownerRequest, `Realtime review ${seed}`);

    await applyBackendBootstrap(ownerPage);
    await ownerPage.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
      waitUntil: "networkidle",
    });
    await expect(ownerPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");

    await focusEditor(ownerPage);
    await ownerPage.keyboard.type(baseText);
    await waitForLayoutIdle(ownerPage);
    await expect
      .poll(async () => (await getDocumentSnapshot(ownerPage)).textContent)
      .toContain(baseText);
    await waitForBackendSnapshotContaining(ownerRequest, documentId, baseText);

    await enableCollaborationFromPanel(ownerPage, `review-realtime-${seed}`);

    await openTrackChangesPanel(ownerPage);
    await ownerPage.getByRole("button", { name: "Enable Tracking" }).click();
    await expect(ownerPage.getByRole("button", { name: "Disable Tracking" })).toBeVisible();
    await expect(ownerPage.locator(".doc-side-tab-actions .t-tag")).toContainText("On");

    await focusEditor(ownerPage);
    await ownerPage.keyboard.type(insertedText);
    await waitForLayoutIdle(ownerPage);
    await expect
      .poll(async () => {
        const textContent = (await getDocumentSnapshot(ownerPage)).textContent;
        return textContent.includes(baseText) && textContent.includes(insertedText);
      })
      .toBeTruthy();
    await expectTrackChangeCount(ownerPage, 1);

    await ownerPage
      .locator(".doc-track-changes-detail-actions")
      .getByRole("button", { name: "Reject" })
      .click();
    await waitForLayoutIdle(ownerPage);

    await expect
      .poll(async () => (await getDocumentSnapshot(ownerPage)).textContent)
      .toBe(baseText);
    await expectTrackChangeCount(ownerPage, 0);

    guards.assertClean();
  } finally {
    await ownerContext.close();
  }
});

test("comment-only members can review tracked changes after starting realtime collaboration", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const commenterContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const commenterPage = await commenterContext.newPage();
  const ownerRequest = ownerContext.request;
  const guardsOwner = attachConsoleGuards(ownerPage);
  const guardsCommenter = attachConsoleGuards(commenterPage);
  const seed = createSeed();
  const ownerEmail = `review-realtime-owner-${seed}@example.com`;
  const commenterEmail = `review-realtime-commenter-${seed}@example.com`;
  const baseText = `Realtime comment review ${seed}`;
  const insertedText = ` collab-review-${seed}`;

  try {
    await registerBackendUser(ownerPage, ownerEmail, "Realtime Review Owner");
    await registerBackendUser(commenterPage, commenterEmail, "Realtime Review Commenter");

    const documentId = await createBackendDocument(ownerRequest, `Realtime comment review ${seed}`);
    await addDocumentMember(ownerRequest, documentId, commenterEmail, "commenter");

    await seedTrackedInsertThroughOwnerWorkspace({
      page: ownerPage,
      ownerRequest,
      documentId,
      baseText,
      insertedText,
    });

    await applyBackendBootstrap(commenterPage);
    await commenterPage.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
      waitUntil: "networkidle",
    });
    await expect(commenterPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await enableCollaborationFromPanel(commenterPage, `review-realtime-commenter-${seed}`);

    await openTrackChangesPanel(commenterPage);
    await expectTrackChangeCount(commenterPage, 1);
    await expect(commenterPage.locator(".doc-track-changes-item-author")).toContainText(
      "Realtime Review Owner",
    );
    await expect(commenterPage.locator(".doc-track-changes-item-text.is-insert")).toContainText(
      insertedText.trim(),
    );
    await expect(commenterPage.getByRole("button", { name: "Enable Tracking" })).toBeDisabled();
    await expect(
      commenterPage
        .locator(".doc-track-changes-detail-actions")
        .getByRole("button", { name: "Accept" }),
    ).toBeDisabled();
    await expect(
      commenterPage
        .locator(".doc-track-changes-detail-actions")
        .getByRole("button", { name: "Reject" }),
    ).toBeDisabled();

    guardsOwner.assertClean();
    guardsCommenter.assertClean();
  } finally {
    await ownerContext.close();
    await commenterContext.close();
  }
});

test("readonly share viewers can review tracked changes after starting realtime collaboration", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const viewerPage = await viewerContext.newPage();
  const ownerRequest = ownerContext.request;
  const guardsOwner = attachConsoleGuards(ownerPage);
  const guardsViewer = attachConsoleGuards(viewerPage);
  const seed = createSeed();
  const ownerEmail = `review-realtime-owner-${seed}@example.com`;
  const baseText = `Realtime readonly review ${seed}`;
  const insertedText = ` readonly-review-${seed}`;

  try {
    await registerBackendUser(ownerPage, ownerEmail, "Realtime Review Owner");

    const documentId = await createBackendDocument(ownerRequest, `Realtime readonly review ${seed}`);
    const shareToken = await createDocumentShareToken(ownerRequest, documentId, "viewer", true);

    await seedTrackedInsertThroughOwnerWorkspace({
      page: ownerPage,
      ownerRequest,
      documentId,
      baseText,
      insertedText,
    });

    await applyBackendBootstrap(viewerPage);
    await viewerPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await viewerPage.getByRole("button", { name: "Open Document" }).click();
    await expect(viewerPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await enableCollaborationFromPanel(viewerPage, `review-realtime-viewer-${seed}`);

    await openTrackChangesPanel(viewerPage);
    await expectTrackChangeCount(viewerPage, 1);
    await expect(viewerPage.locator(".doc-track-changes-item-author")).toContainText(
      "Realtime Review Owner",
    );
    await expect(viewerPage.locator(".doc-track-changes-item-text.is-insert")).toContainText(
      insertedText.trim(),
    );
    await expect(viewerPage.getByRole("button", { name: "Enable Tracking" })).toBeDisabled();
    await expect(
      viewerPage
        .locator(".doc-track-changes-detail-actions")
        .getByRole("button", { name: "Accept" }),
    ).toBeDisabled();
    await expect(
      viewerPage
        .locator(".doc-track-changes-detail-actions")
        .getByRole("button", { name: "Reject" }),
    ).toBeDisabled();

    guardsOwner.assertClean();
    guardsViewer.assertClean();
  } finally {
    await ownerContext.close();
    await viewerContext.close();
  }
});
