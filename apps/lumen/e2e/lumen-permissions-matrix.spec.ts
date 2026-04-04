import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  attachConsoleGuards,
  focusEditor,
  getDocumentSnapshot,
  getParagraphDocPos,
  setTextSelection,
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

const waitForSnapshotContent = async (
  request: APIRequestContext,
  documentId: string,
) => {
  await expect
    .poll(async () => {
      const response = await request.get(`${backendBaseUrl}/api/documents/${documentId}/collab-snapshot`);
      if (!response.ok()) {
        return "";
      }
      const payload = (await response.json()) as { snapshot?: string };
      return String(payload.snapshot || "");
    })
    .not.toBe("");
};

const seedSnapshotThroughOwnerWorkspace = async (
  page: Page,
  ownerApi: APIRequestContext,
  documentId: string,
  content: string,
) => {
  await applyBackendBootstrap(page);
  await page.goto(`/docs/${documentId}?locale=en-US`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
  await focusEditor(page);
  await page.keyboard.type(content);
  await waitForLayoutIdle(page);
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(content);
  await waitForSnapshotContent(ownerApi, documentId);
};

test("comment-only member can comment but cannot edit, readonly share viewer cannot mutate", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const commenterContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const commenterApi = commenterContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const commenterEmail = `commenter-${seed}@example.com`;
  const seededParagraph = `Permission matrix ${seed}`;
  const blockedEdit = ` blocked-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const commenterPage = await commenterContext.newPage();
  const viewerPage = await viewerContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const commenterGuards = attachConsoleGuards(commenterPage);
  const viewerGuards = attachConsoleGuards(viewerPage);

  try {
    const ownerRegisterResponse = await ownerApi.post(`${backendBaseUrl}/api/auth/register`, {
      data: {
        email: ownerEmail,
        password: "password123",
        displayName: "Permissions Owner",
      },
    });
    expect(ownerRegisterResponse.ok()).toBeTruthy();

    const commenterRegisterResponse = await commenterApi.post(`${backendBaseUrl}/api/auth/register`, {
      data: {
        email: commenterEmail,
        password: "password123",
        displayName: "Permissions Commenter",
      },
    });
    expect(commenterRegisterResponse.ok()).toBeTruthy();

    const createResponse = await ownerApi.post(`${backendBaseUrl}/api/documents`, {
      data: {
        title: `Permissions ${seed}`,
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

    const inviteResponse = await ownerApi.post(`${backendBaseUrl}/api/documents/${documentId}/members`, {
      data: {
        email: commenterEmail,
        role: "commenter",
      },
    });
    expect(inviteResponse.ok()).toBeTruthy();

    const shareResponse = await ownerApi.post(`${backendBaseUrl}/api/documents/${documentId}/share-links`, {
      data: {
        role: "viewer",
        allowAnonymous: true,
      },
    });
    expect(shareResponse.ok()).toBeTruthy();
    const sharePayload = (await shareResponse.json()) as {
      shareLink?: {
        token?: string;
      };
    };
    const shareToken = String(sharePayload.shareLink?.token || "");
    expect(shareToken).not.toBe("");

    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(commenterPage);
    await commenterPage.goto(`/docs/${documentId}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expect(commenterPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(commenterPage)).textContent)
      .toContain(seededParagraph);

    const commenterBaseline = (await getDocumentSnapshot(commenterPage)).textContent;
    await focusEditor(commenterPage);
    await commenterPage.keyboard.type(blockedEdit);
    await commenterPage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(commenterPage)).textContent)
      .toBe(commenterBaseline);

    const commenterSelectionStart = await getParagraphDocPos(commenterPage, 0, 0);
    const commenterSelectionEnd = await getParagraphDocPos(commenterPage, 0, 10);
    expect(commenterSelectionStart).not.toBeNull();
    expect(commenterSelectionEnd).not.toBeNull();
    await setTextSelection(commenterPage, commenterSelectionStart!, commenterSelectionEnd!);
    await commenterPage.locator('[data-floating-action="comments"]').click();
    const addCommentButton = commenterPage.getByRole("button", { name: "Add Comment" });
    await expect(addCommentButton).toBeEnabled();
    await addCommentButton.click();
    await expect(commenterPage.locator(".doc-comments-item")).toHaveCount(1);
    await commenterPage.locator(".doc-comments-composer-input textarea").fill("Comment-only can still review.");
    await commenterPage
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();
    await expect(commenterPage.locator(".doc-comments-message-body")).toContainText(
      "Comment-only can still review.",
    );

    await applyBackendBootstrap(viewerPage);
    await viewerPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await viewerPage.getByRole("button", { name: "Open Document" }).click();
    await expect(viewerPage).toHaveURL(new RegExp(`/docs/${documentId}$`));
    await expect(viewerPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await expect
      .poll(async () => (await getDocumentSnapshot(viewerPage)).textContent)
      .toContain(seededParagraph);

    const viewerBaseline = (await getDocumentSnapshot(viewerPage)).textContent;
    await focusEditor(viewerPage);
    await viewerPage.keyboard.type(blockedEdit);
    await viewerPage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(viewerPage)).textContent)
      .toBe(viewerBaseline);

    await viewerPage.locator('[data-floating-action="comments"]').click();
    await expect(viewerPage.getByRole("button", { name: "Add Comment" })).toHaveCount(0);

    ownerGuards.assertClean();
    commenterGuards.assertClean();
    viewerGuards.assertClean();
  } finally {
    await ownerContext.close();
    await commenterContext.close();
    await viewerContext.close();
  }
});
