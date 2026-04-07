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

const waitForOnlineCount = async (page: Page, count: number) => {
  await expect
    .poll(
      async () => {
        const labels = await page.locator(".collab-status-meta").allTextContents();
        return labels.some((label) => label.includes(`${count} online`));
      },
      { timeout: 15000, message: `expected collaboration presence to report ${count} online` },
    )
    .toBeTruthy();
};

const setReloadMarker = async (page: Page, value: string) => {
  await page.evaluate((marker) => {
    (window as typeof window & { __pwWorkspaceCommentsMarker?: string }).__pwWorkspaceCommentsMarker =
      marker;
  }, value);
};

const expectReloadMarker = async (page: Page, value: string) => {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as typeof window & { __pwWorkspaceCommentsMarker?: string })
              .__pwWorkspaceCommentsMarker || null,
        ),
      { message: "enabling realtime collaboration should not reload the workspace" },
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

const waitForSnapshotContent = async (request: APIRequestContext, documentId: string, expected: string) => {
  await expect
    .poll(async () => {
      const response = await request.get(`${backendBaseUrl}/api/documents/${documentId}/collab-snapshot`);
      if (!response.ok()) {
        return "";
      }
      const payload = (await response.json()) as { snapshot?: string };
      const snapshot = String(payload.snapshot || "");
      if (!snapshot) {
        return "";
      }
      try {
        return Buffer.from(snapshot, "base64").toString("utf8");
      } catch (_error) {
        return snapshot;
      }
    })
    .toContain(expected);
};

const registerBackendUser = async (request: APIRequestContext, email: string, displayName: string) => {
  const response = await request.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email,
      password: "password123",
      displayName,
    },
  });
  expect(response.ok()).toBeTruthy();
};

const createBackendDocument = async (ownerApi: APIRequestContext, title: string) => {
  const response = await ownerApi.post(`${backendBaseUrl}/api/documents`, {
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
  ownerApi: APIRequestContext,
  documentId: string,
  email: string,
  role: "editor" | "commenter" | "viewer",
) => {
  const response = await ownerApi.post(`${backendBaseUrl}/api/documents/${documentId}/members`, {
    data: {
      email,
      role,
    },
  });
  expect(response.ok()).toBeTruthy();
};

const seedSnapshotThroughOwnerWorkspace = async (
  page: Page,
  ownerApi: APIRequestContext,
  documentId: string,
  content: string,
) => {
  await applyBackendBootstrap(page);
  await page.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
  await focusEditor(page);
  await page.keyboard.type(content);
  await waitForLayoutIdle(page);
  await expect
    .poll(async () => (await getDocumentSnapshot(page)).textContent)
    .toContain(content);
  await waitForSnapshotContent(ownerApi, documentId, content);
};

const findParagraphIndexContaining = async (page: Page, expectedText: string) => {
  const snapshot = await getDocumentSnapshot(page);
  const docJson = snapshot.json as
    | {
        content?: Array<{
          type?: string;
          content?: Array<{ type?: string; text?: string }>;
        }>;
      }
    | null;
  const paragraphs = Array.isArray(docJson?.content) ? docJson.content : [];
  return paragraphs.findIndex((node) => {
    if (node?.type !== "paragraph") {
      return false;
    }
    const text = Array.isArray(node.content)
      ? node.content
          .map((child) => (child?.type === "text" ? String(child.text || "") : ""))
          .join("")
      : "";
    return text.includes(expectedText);
  });
};

test("comment-only workspace collaboration comments sync across live clients", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const commenterContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const commenterPage = await commenterContext.newPage();
  const ownerApi = ownerContext.request;
  const commenterApi = commenterContext.request;
  const ownerGuards = attachConsoleGuards(ownerPage);
  const commenterGuards = attachConsoleGuards(commenterPage);
  const seed = createSeed();
  const ownerEmail = `workspace-comment-owner-${seed}@example.com`;
  const commenterEmail = `workspace-comment-commenter-${seed}@example.com`;
  const seededParagraph = `Workspace comments ${seed} should sync across live clients.`;
  const commenterMessage = `Comment-only reviewer note ${seed}`;
  const ownerReply = `Owner reply ${seed}`;

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Workspace Comment Owner");
    await registerBackendUser(commenterApi, commenterEmail, "Workspace Commenter");

    const documentId = await createBackendDocument(ownerApi, `Workspace Comments ${seed}`);
    await addDocumentMember(ownerApi, documentId, commenterEmail, "commenter");
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(ownerPage);
    await applyBackendBootstrap(commenterPage);

    await ownerPage.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
      waitUntil: "networkidle",
    });
    await commenterPage.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
      waitUntil: "networkidle",
    });

    await expect
      .poll(async () => (await getDocumentSnapshot(ownerPage)).textContent)
      .toContain(seededParagraph);
    await expect
      .poll(async () => (await getDocumentSnapshot(commenterPage)).textContent)
      .toContain(seededParagraph);

    await enableCollaborationFromPanel(ownerPage, `workspace-comments-owner-${seed}`);
    await enableCollaborationFromPanel(commenterPage, `workspace-comments-commenter-${seed}`);
    await Promise.all([waitForOnlineCount(ownerPage, 2), waitForOnlineCount(commenterPage, 2)]);

    const paragraphIndex = await findParagraphIndexContaining(commenterPage, "Workspace comments");
    expect(paragraphIndex).toBeGreaterThanOrEqual(0);
    const selectionStart = await getParagraphDocPos(commenterPage, paragraphIndex, 0);
    const selectionEnd = await getParagraphDocPos(commenterPage, paragraphIndex, 18);
    expect(selectionStart).not.toBeNull();
    expect(selectionEnd).not.toBeNull();
    await setTextSelection(commenterPage, selectionStart!, selectionEnd!);
    await commenterPage.locator('[data-floating-action="comments"]').click();
    await commenterPage.getByRole("button", { name: "Add Comment" }).click();
    await expect(commenterPage.locator(".doc-comments-item")).toHaveCount(1);
    await expect(commenterPage.locator(".doc-comments-item-quote").first()).toContainText(
      "Workspace comments",
    );
    await commenterPage.locator(".doc-comments-composer-input textarea").fill(commenterMessage);
    await commenterPage
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();
    await expect(commenterPage.locator(".doc-comments-message-body")).toContainText(commenterMessage);

    await ownerPage.locator('[data-floating-action="comments"]').click();
    await expect(ownerPage.locator(".doc-comments-item")).toHaveCount(1);
    await expect(ownerPage.locator(".doc-comments-message-author")).toContainText("Workspace Commenter");
    await expect(ownerPage.locator(".doc-comments-message-body")).toContainText(commenterMessage);

    await ownerPage.locator(".doc-comments-composer-input textarea").fill(ownerReply);
    await ownerPage
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();
    await expect
      .poll(async () => ownerPage.locator(".doc-comments-message-body").allInnerTexts())
      .toEqual([commenterMessage, ownerReply]);
    await expect
      .poll(async () => commenterPage.locator(".doc-comments-message-body").allInnerTexts())
      .toEqual([commenterMessage, ownerReply]);
    await expect
      .poll(async () => commenterPage.locator(".doc-comments-message-author").allInnerTexts())
      .toEqual(["Workspace Commenter", "Workspace Comment Owner"]);

    ownerGuards.assertClean();
    commenterGuards.assertClean();
  } finally {
    await ownerContext.close();
    await commenterContext.close();
  }
});
