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

const applyStoredShareAccessToken = async (page: Page, documentId: string, shareToken: string) => {
  await page.addInitScript(
    ([normalizedDocumentId, normalizedShareToken]) => {
      const key = `lumenpage-share-access-token:${encodeURIComponent(normalizedDocumentId)}`;
      window.sessionStorage.setItem(key, normalizedShareToken);
    },
    [documentId, shareToken] as const,
  );
};

const waitForSyncedStatus = async (page: Page) => {
  await expect
    .poll(
      async () => (await page.locator(".collab-presence.is-success").count()) > 0,
      { timeout: 15000, message: "expected collaboration status to reach Synced" },
    )
    .toBeTruthy();
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

const expectWorkspaceUrl = async (
  page: Page,
  documentId: string,
  locale: string = "en-US",
) => {
  await expect
    .poll(
      async () => {
        const currentUrl = new URL(page.url());
        return `${currentUrl.pathname}?locale=${currentUrl.searchParams.get("locale") || ""}`;
      },
      { message: "expected document workspace URL to preserve the requested locale" },
    )
    .toBe(`/docs/${documentId}?locale=${locale}`);
};

const expectShareAccessUrl = async (
  page: Page,
  shareToken: string,
  locale: string = "en-US",
) => {
  await expect
    .poll(
      async () => {
        const currentUrl = new URL(page.url());
        return `${currentUrl.pathname}?locale=${currentUrl.searchParams.get("locale") || ""}`;
      },
      { message: "expected share landing URL to preserve the requested locale" },
    )
    .toBe(`/share/${shareToken}?locale=${locale}`);
};

const expectAddCommentUnavailable = async (page: Page) => {
  await expect
    .poll(
      async () => {
        const button = page.getByRole("button", { name: "Add Comment" });
        const count = await button.count();
        if (count === 0) {
          return "hidden";
        }
        return (await button.isDisabled()) ? "disabled" : "enabled";
      },
      { message: "expected add comment action to stay unavailable" },
    )
    .not.toBe("enabled");
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

const loginThroughAccountDialog = async (page: Page, email: string, password: string) => {
  const dialog = page
    .locator(".t-dialog")
    .filter({ has: page.locator(".doc-account-dialog") })
    .last();
  await expect(dialog).toBeVisible();
  const inputs = dialog.locator(".doc-account-auth-grid .t-input__inner");
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await dialog.getByRole("button", { name: "Submit" }).click();
};

const loginThroughWorkspaceTopbar = async (page: Page, email: string, password: string) => {
  await page.locator(".topbar-avatar-trigger").click();
  await page.locator(".topbar-account-menu").getByRole("button", { name: "Login" }).click();
  await loginThroughAccountDialog(page, email, password);
};

const logoutThroughWorkspaceTopbar = async (page: Page) => {
  await page.locator(".topbar-avatar-trigger").click();
  await page.locator(".topbar-account-menu").getByRole("button", { name: "Manage Account" }).click();
  const dialog = page
    .locator(".t-dialog")
    .filter({ has: page.locator(".doc-account-dialog") })
    .last();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Log out" }).click();
};

const setReloadMarker = async (page: Page, value: string) => {
  await page.evaluate((marker) => {
    (window as typeof window & { __pwCollabMarker?: string }).__pwCollabMarker = marker;
  }, value);
};

const expectReloadMarker = async (page: Page, value: string) => {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => (window as typeof window & { __pwCollabMarker?: string }).__pwCollabMarker || null,
        ),
      { message: "collaboration should start without a full page reload" },
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

const registerBackendUser = async (
  request: APIRequestContext,
  email: string,
  displayName: string,
) => {
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
  const createResponse = await ownerApi.post(`${backendBaseUrl}/api/documents`, {
    data: {
      title,
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
  return documentId;
};

const addDocumentMember = async (
  ownerApi: APIRequestContext,
  documentId: string,
  email: string,
  role: "editor" | "commenter" | "viewer",
) => {
  const inviteResponse = await ownerApi.post(`${backendBaseUrl}/api/documents/${documentId}/members`, {
    data: {
      email,
      role,
    },
  });
  expect(inviteResponse.ok()).toBeTruthy();
  const invitePayload = (await inviteResponse.json()) as {
    member?: {
      user?: {
        id?: string;
      };
    };
  };
  const memberUserId = String(invitePayload.member?.user?.id || "");
  expect(memberUserId).not.toBe("");
  return memberUserId;
};

const updateDocumentMemberRole = async (
  ownerApi: APIRequestContext,
  documentId: string,
  userId: string,
  role: "editor" | "commenter" | "viewer",
) => {
  const response = await ownerApi.put(`${backendBaseUrl}/api/documents/${documentId}/members/${userId}`, {
    data: {
      role,
    },
  });
  expect(response.ok()).toBeTruthy();
};

const createDocumentShareLink = async (
  ownerApi: APIRequestContext,
  documentId: string,
  role: "editor" | "commenter" | "viewer",
  allowAnonymous: boolean,
  options: { expiresAt?: string | null } = {},
) => {
  const shareResponse = await ownerApi.post(`${backendBaseUrl}/api/documents/${documentId}/share-links`, {
    data: {
      role,
      allowAnonymous,
      ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
    },
  });
  expect(shareResponse.ok()).toBeTruthy();
  const sharePayload = (await shareResponse.json()) as {
    shareLink?: {
      id?: string;
      token?: string;
    };
  };
  const shareId = String(sharePayload.shareLink?.id || "");
  const shareToken = String(sharePayload.shareLink?.token || "");
  expect(shareId).not.toBe("");
  expect(shareToken).not.toBe("");
  return {
    shareId,
    shareToken,
  };
};

const createDocumentShareToken = async (
  ownerApi: APIRequestContext,
  documentId: string,
  role: "editor" | "commenter" | "viewer",
  allowAnonymous: boolean,
) => {
  const { shareToken } = await createDocumentShareLink(ownerApi, documentId, role, allowAnonymous);
  return shareToken;
};

const revokeDocumentShareLink = async (ownerApi: APIRequestContext, shareId: string) => {
  const response = await ownerApi.delete(`${backendBaseUrl}/api/share-links/${shareId}`);
  expect(response.ok()).toBeTruthy();
};

const removeDocumentMember = async (
  ownerApi: APIRequestContext,
  documentId: string,
  userId: string,
) => {
  const response = await ownerApi.delete(
    `${backendBaseUrl}/api/documents/${documentId}/members/${userId}`,
  );
  expect(response.ok()).toBeTruthy();
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

test("comment-only member can comment but cannot edit, anonymous readonly share viewer cannot mutate", async ({
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
    await registerBackendUser(ownerApi, ownerEmail, "Permissions Owner");
    await registerBackendUser(commenterApi, commenterEmail, "Permissions Commenter");

    const documentId = await createBackendDocument(ownerApi, `Permissions ${seed}`);
    await addDocumentMember(ownerApi, documentId, commenterEmail, "commenter");
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", true);

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

    const commenterParagraphIndex = await findParagraphIndexContaining(commenterPage, seededParagraph);
    expect(commenterParagraphIndex).toBeGreaterThanOrEqual(0);
    const commenterSelectionStart = await getParagraphDocPos(commenterPage, commenterParagraphIndex, 0);
    const commenterSelectionEnd = await getParagraphDocPos(commenterPage, commenterParagraphIndex, 10);
    expect(commenterSelectionStart).not.toBeNull();
    expect(commenterSelectionEnd).not.toBeNull();
    await commenterPage.locator('[data-floating-action="comments"]').click();
    await setTextSelection(commenterPage, commenterSelectionStart!, commenterSelectionEnd!);
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
    await expectWorkspaceUrl(viewerPage, documentId);
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
    await expectAddCommentUnavailable(viewerPage);

    ownerGuards.assertClean();
    commenterGuards.assertClean();
    viewerGuards.assertClean();
  } finally {
    await ownerContext.close();
    await commenterContext.close();
    await viewerContext.close();
  }
});

test("editor member keeps edit access when entering through a readonly share link", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const editorContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const editorApi = editorContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const editorEmail = `editor-${seed}@example.com`;
  const seededParagraph = `Editor share precedence ${seed}`;
  const editorEdit = ` editor-update-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const editorPage = await editorContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const editorGuards = attachConsoleGuards(editorPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Share Owner");
    await registerBackendUser(editorApi, editorEmail, "Share Editor");

    const documentId = await createBackendDocument(ownerApi, `Editor Share ${seed}`);
    await addDocumentMember(ownerApi, documentId, editorEmail, "editor");
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", true);

    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(editorPage);
    await editorPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await editorPage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(editorPage, documentId);
    await expect(editorPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(editorPage)).textContent)
      .toContain(seededParagraph);

    await focusEditor(editorPage);
    await editorPage.keyboard.type(editorEdit);
    await waitForLayoutIdle(editorPage);
    await expect
      .poll(async () => (await getDocumentSnapshot(editorPage)).textContent)
      .toContain(editorEdit);
    await waitForSnapshotContent(ownerApi, documentId);

    ownerGuards.assertClean();
    editorGuards.assertClean();
  } finally {
    await ownerContext.close();
    await editorContext.close();
  }
});

test("signed-in-only share link prompts login before opening readonly workspace", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const shareContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const viewerEmail = `restricted-viewer-${seed}@example.com`;
  const seededParagraph = `Restricted share ${seed}`;

  const ownerPage = await ownerContext.newPage();
  const sharePage = await shareContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const shareGuards = attachConsoleGuards(sharePage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Restricted Share Owner");
    await registerBackendUser(memberApi, viewerEmail, "Restricted Share Viewer");

    const documentId = await createBackendDocument(ownerApi, `Restricted Share ${seed}`);
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", false);

    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(sharePage);
    await sharePage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expect(sharePage.locator(".doc-share-page-meta")).toContainText("Signed-in access only");
    await expect(sharePage.locator(".doc-share-page-note")).toContainText(
      "Sign in before opening this shared document",
    );

    await sharePage
      .locator(".doc-share-page-actions-row")
      .getByRole("button", { name: "Sign In to Open" })
      .click();
    await expect(sharePage).toHaveURL(new RegExp(`/share/${shareToken}`));

    await loginThroughAccountDialog(sharePage, viewerEmail, "password123");

    await expectWorkspaceUrl(sharePage, documentId);
    await expect(sharePage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await expect
      .poll(async () => (await getDocumentSnapshot(sharePage)).textContent)
      .toContain(seededParagraph);

    ownerGuards.assertClean();
    shareGuards.assertClean();
  } finally {
    await ownerContext.close();
    await memberContext.close();
    await shareContext.close();
  }
});

test("signed-in-only editor share link prompts login before opening editable workspace", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const shareContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const editorEmail = `restricted-editor-${seed}@example.com`;
  const seededParagraph = `Restricted editor share ${seed}`;
  const editorEdit = ` restricted-editor-edit-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const sharePage = await shareContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const shareGuards = attachConsoleGuards(sharePage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Restricted Editor Share Owner");
    await registerBackendUser(memberApi, editorEmail, "Restricted Editor Share User");

    const documentId = await createBackendDocument(ownerApi, `Restricted Editor Share ${seed}`);
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "editor", false);

    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(sharePage);
    await sharePage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expect(sharePage.locator(".doc-share-page-meta")).toContainText("Signed-in access only");
    await sharePage
      .locator(".doc-share-page-actions-row")
      .getByRole("button", { name: "Sign In to Open" })
      .click();
    await expect(sharePage).toHaveURL(new RegExp(`/share/${shareToken}`));

    await loginThroughAccountDialog(sharePage, editorEmail, "password123");

    await expectWorkspaceUrl(sharePage, documentId);
    await expect(sharePage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(sharePage)).textContent)
      .toContain(seededParagraph);

    await focusEditor(sharePage);
    await sharePage.keyboard.type(editorEdit);
    await waitForLayoutIdle(sharePage);
    await expect
      .poll(async () => (await getDocumentSnapshot(sharePage)).textContent)
      .toContain(editorEdit);
    await waitForSnapshotContent(ownerApi, documentId);

    ownerGuards.assertClean();
    shareGuards.assertClean();
  } finally {
    await ownerContext.close();
    await memberContext.close();
    await shareContext.close();
  }
});

test("comment-only member keeps comment access when entering through a readonly share link", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const commenterContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const commenterApi = commenterContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const commenterEmail = `commenter-share-${seed}@example.com`;
  const seededParagraph = `Comment share precedence ${seed}`;
  const blockedEdit = ` comment-share-blocked-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const commenterPage = await commenterContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const commenterGuards = attachConsoleGuards(commenterPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Comment Share Owner");
    await registerBackendUser(commenterApi, commenterEmail, "Comment Share Member");

    const documentId = await createBackendDocument(ownerApi, `Comment Share ${seed}`);
    await addDocumentMember(ownerApi, documentId, commenterEmail, "commenter");
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", true);

    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(commenterPage);
    await commenterPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await commenterPage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(commenterPage, documentId);
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
    await commenterPage
      .locator(".doc-comments-composer-input textarea")
      .fill("Readonly share should not override commenter access.");
    await commenterPage
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();
    await expect(commenterPage.locator(".doc-comments-message-body")).toContainText(
      "Readonly share should not override commenter access.",
    );

    ownerGuards.assertClean();
    commenterGuards.assertClean();
  } finally {
    await ownerContext.close();
    await commenterContext.close();
  }
});

test("editor share link does not escalate commenter or viewer members", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const commenterContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const commenterApi = commenterContext.request;
  const viewerApi = viewerContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const commenterEmail = `editor-share-commenter-${seed}@example.com`;
  const viewerEmail = `editor-share-viewer-${seed}@example.com`;
  const seededParagraph = `Editor share should not escalate members ${seed}`;
  const blockedCommenterEdit = ` blocked-commenter-${seed}`;
  const blockedViewerEdit = ` blocked-viewer-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const commenterPage = await commenterContext.newPage();
  const viewerPage = await viewerContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const commenterGuards = attachConsoleGuards(commenterPage);
  const viewerGuards = attachConsoleGuards(viewerPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Editor Share Owner");
    await registerBackendUser(commenterApi, commenterEmail, "Editor Share Commenter");
    await registerBackendUser(viewerApi, viewerEmail, "Editor Share Viewer");

    const documentId = await createBackendDocument(ownerApi, `Editor Share No Escalation ${seed}`);
    await addDocumentMember(ownerApi, documentId, commenterEmail, "commenter");
    await addDocumentMember(ownerApi, documentId, viewerEmail, "viewer");
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "editor", true);

    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(commenterPage);
    await commenterPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await commenterPage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(commenterPage, documentId);
    await expect(commenterPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(commenterPage)).textContent)
      .toContain(seededParagraph);

    const commenterBaseline = (await getDocumentSnapshot(commenterPage)).textContent;
    await focusEditor(commenterPage);
    await commenterPage.keyboard.type(blockedCommenterEdit);
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
    const commenterAddCommentButton = commenterPage.getByRole("button", { name: "Add Comment" });
    await expect(commenterAddCommentButton).toBeEnabled();
    await commenterAddCommentButton.click();
    await expect(commenterPage.locator(".doc-comments-item")).toHaveCount(1);
    await commenterPage
      .locator(".doc-comments-composer-input textarea")
      .fill("Editor share should not promote commenter permissions.");
    await commenterPage
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();
    await expect(commenterPage.locator(".doc-comments-message-body")).toContainText(
      "Editor share should not promote commenter permissions.",
    );

    await applyBackendBootstrap(viewerPage);
    await viewerPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await viewerPage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(viewerPage, documentId);
    await expect(viewerPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await expect
      .poll(async () => (await getDocumentSnapshot(viewerPage)).textContent)
      .toContain(seededParagraph);

    const viewerBaseline = (await getDocumentSnapshot(viewerPage)).textContent;
    await focusEditor(viewerPage);
    await viewerPage.keyboard.type(blockedViewerEdit);
    await viewerPage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(viewerPage)).textContent)
      .toBe(viewerBaseline);
    await viewerPage.locator('[data-floating-action="comments"]').click();
    await expectAddCommentUnavailable(viewerPage);

    ownerGuards.assertClean();
    commenterGuards.assertClean();
    viewerGuards.assertClean();
  } finally {
    await ownerContext.close();
    await commenterContext.close();
    await viewerContext.close();
  }
});

test("signed-in-only commenter share link prompts login before opening comment-only workspace", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const shareContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const commenterEmail = `restricted-commenter-${seed}@example.com`;
  const seededParagraph = `Restricted commenter share ${seed}`;
  const blockedEdit = ` restricted-commenter-blocked-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const sharePage = await shareContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const shareGuards = attachConsoleGuards(sharePage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Restricted Comment Share Owner");
    await registerBackendUser(memberApi, commenterEmail, "Restricted Comment Share Member");

    const documentId = await createBackendDocument(ownerApi, `Restricted Comment Share ${seed}`);
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "commenter", false);

    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(sharePage);
    await sharePage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expect(sharePage.locator(".doc-share-page-meta")).toContainText("Signed-in access only");
    await sharePage
      .locator(".doc-share-page-actions-row")
      .getByRole("button", { name: "Sign In to Open" })
      .click();
    await expect(sharePage).toHaveURL(new RegExp(`/share/${shareToken}`));

    await loginThroughAccountDialog(sharePage, commenterEmail, "password123");

    await expectWorkspaceUrl(sharePage, documentId);
    await expect(sharePage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(sharePage)).textContent)
      .toContain(seededParagraph);

    const shareBaseline = (await getDocumentSnapshot(sharePage)).textContent;
    await focusEditor(sharePage);
    await sharePage.keyboard.type(blockedEdit);
    await sharePage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(sharePage)).textContent)
      .toBe(shareBaseline);

    const selectionStart = await getParagraphDocPos(sharePage, 0, 0);
    const selectionEnd = await getParagraphDocPos(sharePage, 0, 10);
    expect(selectionStart).not.toBeNull();
    expect(selectionEnd).not.toBeNull();
    await setTextSelection(sharePage, selectionStart!, selectionEnd!);
    await sharePage.locator('[data-floating-action="comments"]').click();
    const addCommentButton = sharePage.getByRole("button", { name: "Add Comment" });
    await expect(addCommentButton).toBeEnabled();
    await addCommentButton.click();
    await expect(sharePage.locator(".doc-comments-item")).toHaveCount(1);
    await sharePage
      .locator(".doc-comments-composer-input textarea")
      .fill("Signed-in commenter share can still review.");
    await sharePage
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();
    await expect(sharePage.locator(".doc-comments-message-body")).toContainText(
      "Signed-in commenter share can still review.",
    );

    ownerGuards.assertClean();
    shareGuards.assertClean();
  } finally {
    await ownerContext.close();
    await memberContext.close();
    await shareContext.close();
  }
});

test("comment-only member keeps comment access when entering through a signed-in-only readonly share link", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const shareContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const commenterEmail = `restricted-readonly-commenter-${seed}@example.com`;
  const seededParagraph = `Restricted readonly commenter share ${seed}`;
  const blockedEdit = ` restricted-readonly-commenter-blocked-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const sharePage = await shareContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const shareGuards = attachConsoleGuards(sharePage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Restricted Readonly Comment Share Owner");
    await registerBackendUser(memberApi, commenterEmail, "Restricted Readonly Comment Share Member");

    const documentId = await createBackendDocument(ownerApi, `Restricted Readonly Comment Share ${seed}`);
    await addDocumentMember(ownerApi, documentId, commenterEmail, "commenter");
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", false);

    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(sharePage);
    await sharePage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expect(sharePage.locator(".doc-share-page-meta")).toContainText("Signed-in access only");
    await sharePage
      .locator(".doc-share-page-actions-row")
      .getByRole("button", { name: "Sign In to Open" })
      .click();
    await expect(sharePage).toHaveURL(new RegExp(`/share/${shareToken}`));

    await loginThroughAccountDialog(sharePage, commenterEmail, "password123");

    await expectWorkspaceUrl(sharePage, documentId);
    await expect(sharePage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(sharePage)).textContent)
      .toContain(seededParagraph);

    const shareBaseline = (await getDocumentSnapshot(sharePage)).textContent;
    await focusEditor(sharePage);
    await sharePage.keyboard.type(blockedEdit);
    await sharePage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(sharePage)).textContent)
      .toBe(shareBaseline);

    const selectionStart = await getParagraphDocPos(sharePage, 0, 0);
    const selectionEnd = await getParagraphDocPos(sharePage, 0, 10);
    expect(selectionStart).not.toBeNull();
    expect(selectionEnd).not.toBeNull();
    await setTextSelection(sharePage, selectionStart!, selectionEnd!);
    await sharePage.locator('[data-floating-action="comments"]').click();
    const addCommentButton = sharePage.getByRole("button", { name: "Add Comment" });
    await expect(addCommentButton).toBeEnabled();
    await addCommentButton.click();
    await expect(sharePage.locator(".doc-comments-item")).toHaveCount(1);
    await sharePage
      .locator(".doc-comments-composer-input textarea")
      .fill("Signed-in readonly share should not override commenter membership.");
    await sharePage
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();
    await expect(sharePage.locator(".doc-comments-message-body")).toContainText(
      "Signed-in readonly share should not override commenter membership.",
    );

    ownerGuards.assertClean();
    shareGuards.assertClean();
  } finally {
    await ownerContext.close();
    await memberContext.close();
    await shareContext.close();
  }
});

test("direct member workspace entry keeps editor editable and viewer readonly", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const editorContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const editorApi = editorContext.request;
  const viewerApi = viewerContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const editorEmail = `editor-member-${seed}@example.com`;
  const viewerEmail = `viewer-member-${seed}@example.com`;
  const seededParagraph = `Member roles ${seed}`;
  const editorEdit = ` editor-member-update-${seed}`;
  const blockedEdit = ` viewer-member-blocked-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const editorPage = await editorContext.newPage();
  const viewerPage = await viewerContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const editorGuards = attachConsoleGuards(editorPage);
  const viewerGuards = attachConsoleGuards(viewerPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Member Matrix Owner");
    await registerBackendUser(editorApi, editorEmail, "Member Matrix Editor");
    await registerBackendUser(viewerApi, viewerEmail, "Member Matrix Viewer");

    const documentId = await createBackendDocument(ownerApi, `Member Matrix ${seed}`);
    await addDocumentMember(ownerApi, documentId, editorEmail, "editor");
    await addDocumentMember(ownerApi, documentId, viewerEmail, "viewer");
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(editorPage);
    await editorPage.goto(`/docs/${documentId}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expect(editorPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(editorPage)).textContent)
      .toContain(seededParagraph);
    await focusEditor(editorPage);
    await editorPage.keyboard.type(editorEdit);
    await waitForLayoutIdle(editorPage);
    await expect
      .poll(async () => (await getDocumentSnapshot(editorPage)).textContent)
      .toContain(editorEdit);

    await applyBackendBootstrap(viewerPage);
    await viewerPage.goto(`/docs/${documentId}?locale=en-US`, {
      waitUntil: "networkidle",
    });
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
    await expectAddCommentUnavailable(viewerPage);

    ownerGuards.assertClean();
    editorGuards.assertClean();
    viewerGuards.assertClean();
  } finally {
    await ownerContext.close();
    await editorContext.close();
    await viewerContext.close();
  }
});

test("comment-only member stays comment-only after starting realtime collaboration", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const commenterContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const commenterApi = commenterContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const commenterEmail = `commenter-collab-${seed}@example.com`;
  const seededParagraph = `Comment collaboration ${seed}`;
  const blockedEdit = ` blocked-collab-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const commenterPage = await commenterContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const commenterGuards = attachConsoleGuards(commenterPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Comment Collab Owner");
    await registerBackendUser(commenterApi, commenterEmail, "Comment Collab Member");

    const documentId = await createBackendDocument(ownerApi, `Comment Collab ${seed}`);
    await addDocumentMember(ownerApi, documentId, commenterEmail, "commenter");
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(commenterPage);
    await commenterPage.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
      waitUntil: "networkidle",
    });
    await expect(commenterPage.locator(".collab-status-label")).toHaveCount(0);
    await expect(commenterPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(commenterPage)).textContent)
      .toContain(seededParagraph);

    await enableCollaborationFromPanel(commenterPage, `commenter-collab-${seed}`);

    const commenterBaseline = (await getDocumentSnapshot(commenterPage)).textContent;
    await focusEditor(commenterPage);
    await commenterPage.keyboard.type(blockedEdit);
    await commenterPage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(commenterPage)).textContent)
      .toBe(commenterBaseline);

    await commenterPage.locator('[data-floating-action="comments"]').click();
    await expect(commenterPage.locator(".doc-comments")).toBeVisible();
    await expect(commenterPage.getByRole("button", { name: "Add Comment" })).toBeVisible();

    ownerGuards.assertClean();
    commenterGuards.assertClean();
  } finally {
    await ownerContext.close();
    await commenterContext.close();
  }
});

test("realtime member workspace downgrades to readonly after the owner changes the member role", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-role-refresh-${seed}@example.com`;
  const memberEmail = `commenter-role-refresh-${seed}@example.com`;
  const seededParagraph = `Realtime role refresh ${seed}`;
  const blockedEdit = ` blocked-role-refresh-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const memberPage = await memberContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const memberGuards = attachConsoleGuards(memberPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Role Refresh Owner");
    await registerBackendUser(memberApi, memberEmail, "Role Refresh Commenter");

    const documentId = await createBackendDocument(ownerApi, `Role Refresh ${seed}`);
    const memberUserId = await addDocumentMember(ownerApi, documentId, memberEmail, "commenter");
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(memberPage);
    await memberPage.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
      waitUntil: "networkidle",
    });
    await expect(memberPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(memberPage)).textContent)
      .toContain(seededParagraph);

    await enableCollaborationFromPanel(memberPage, `role-refresh-${seed}`);

    await updateDocumentMemberRole(ownerApi, documentId, memberUserId, "viewer");

    await setReloadMarker(memberPage, `role-refresh-${seed}`);
    await memberPage.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await expectReloadMarker(memberPage, `role-refresh-${seed}`);
    await expect(memberPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await expect
      .poll(async () => (await getDocumentSnapshot(memberPage)).textContent)
      .toContain(seededParagraph);

    await focusEditor(memberPage);
    await memberPage.keyboard.type(blockedEdit);
    await memberPage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(memberPage)).textContent)
      .toContain(seededParagraph);
    await expect
      .poll(async () => (await getDocumentSnapshot(memberPage)).textContent)
      .not.toContain(blockedEdit);

    await memberPage.locator('[data-floating-action="comments"]').click();
    await expectAddCommentUnavailable(memberPage);

    ownerGuards.assertClean();
    memberGuards.assertClean();
  } finally {
    await ownerContext.close();
    await memberContext.close();
  }
});

test("realtime direct member workspace falls into a workspace error after the owner removes the member", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-member-remove-${seed}@example.com`;
  const memberEmail = `editor-member-remove-${seed}@example.com`;
  const seededParagraph = `Realtime member remove ${seed}`;

  const ownerPage = await ownerContext.newPage();
  const memberPage = await memberContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const memberGuards = attachConsoleGuards(memberPage, {
    ignoreConsoleErrors: [/^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/],
  });

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Member Remove Owner");
    await registerBackendUser(memberApi, memberEmail, "Member Remove Editor");

    const documentId = await createBackendDocument(ownerApi, `Member Remove ${seed}`);
    const memberUserId = await addDocumentMember(ownerApi, documentId, memberEmail, "editor");
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(memberPage);
    await memberPage.goto(`/docs/${documentId}?locale=en-US&collab=0`, {
      waitUntil: "networkidle",
    });
    await expect(memberPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await expect
      .poll(async () => (await getDocumentSnapshot(memberPage)).textContent)
      .toContain(seededParagraph);

    await enableCollaborationFromPanel(memberPage, `member-remove-${seed}`);

    await removeDocumentMember(ownerApi, documentId, memberUserId);

    await setReloadMarker(memberPage, `member-remove-${seed}`);
    await memberPage.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await expectReloadMarker(memberPage, `member-remove-${seed}`);
    await expect(memberPage.locator(".doc-workspace-status-copy")).toContainText(
      "Document not found or access denied.",
    );
    await expect(memberPage.locator(".lumenpage-editor")).toHaveCount(0);

    ownerGuards.assertClean();
    memberGuards.assertClean();
  } finally {
    await ownerContext.close();
    await memberContext.close();
  }
});

test("anonymous realtime share returns to the share landing after the owner revokes the share link", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const shareContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-share-revoke-${seed}@example.com`;
  const seededParagraph = `Share revoke ${seed}`;

  const ownerPage = await ownerContext.newPage();
  const sharePage = await shareContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const shareGuards = attachConsoleGuards(sharePage, {
    ignoreConsoleErrors: [/^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/],
  });

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Share Revoke Owner");

    const documentId = await createBackendDocument(ownerApi, `Share Revoke ${seed}`);
    const { shareId, shareToken } = await createDocumentShareLink(ownerApi, documentId, "viewer", true);
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(sharePage);
    await sharePage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await sharePage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(sharePage, documentId);
    await expect
      .poll(async () => (await getDocumentSnapshot(sharePage)).textContent)
      .toContain(seededParagraph);

    await enableCollaborationFromPanel(sharePage, `share-revoke-${seed}`);

    await revokeDocumentShareLink(ownerApi, shareId);

    await setReloadMarker(sharePage, `share-revoke-${seed}`);
    await sharePage.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await expectReloadMarker(sharePage, `share-revoke-${seed}`);
    await expectShareAccessUrl(sharePage, shareToken);
    await expect(sharePage.locator(".doc-share-page-empty.is-error")).toContainText(
      "Share link not found.",
    );
    await expect(sharePage.locator(".lumenpage-editor")).toHaveCount(0);

    ownerGuards.assertClean();
    shareGuards.assertClean();
  } finally {
    await ownerContext.close();
    await shareContext.close();
  }
});

test("expired share workspace route redirects back to the share landing", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const shareContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-share-expiry-${seed}@example.com`;

  const ownerPage = await ownerContext.newPage();
  const sharePage = await shareContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const shareGuards = attachConsoleGuards(sharePage, {
    ignoreConsoleErrors: [/^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/],
  });

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Share Expiry Owner");

    const documentId = await createBackendDocument(ownerApi, `Share Expiry ${seed}`);
    const expiresAt = new Date(Date.now() - 1_000).toISOString();
    const { shareToken } = await createDocumentShareLink(ownerApi, documentId, "viewer", true, {
      expiresAt,
    });

    await applyBackendBootstrap(sharePage);
    await applyStoredShareAccessToken(sharePage, documentId, shareToken);
    await sharePage.goto(`/docs/${documentId}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expectShareAccessUrl(sharePage, shareToken);
    await expect(sharePage.locator(".doc-share-page-empty.is-error")).toContainText(
      "Share link not found.",
    );
    await expect(sharePage.locator(".lumenpage-editor")).toHaveCount(0);

    ownerGuards.assertClean();
    shareGuards.assertClean();
  } finally {
    await ownerContext.close();
    await shareContext.close();
  }
});

test("anonymous readonly share viewer stays readonly after starting realtime collaboration", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const seededParagraph = `Readonly collab ${seed}`;
  const blockedEdit = ` readonly-collab-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const viewerPage = await viewerContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const viewerGuards = attachConsoleGuards(viewerPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Readonly Collab Owner");

    const documentId = await createBackendDocument(ownerApi, `Readonly Collab ${seed}`);
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", true);
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(viewerPage);
    await viewerPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await viewerPage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(viewerPage, documentId);
    await expect(viewerPage.locator(".collab-status-label")).toHaveCount(0);
    await expect(viewerPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await expect
      .poll(async () => (await getDocumentSnapshot(viewerPage)).textContent)
      .toContain(seededParagraph);

    await enableCollaborationFromPanel(viewerPage, `viewer-collab-${seed}`);

    const viewerBaseline = (await getDocumentSnapshot(viewerPage)).textContent;
    await focusEditor(viewerPage);
    await viewerPage.keyboard.type(blockedEdit);
    await viewerPage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(viewerPage)).textContent)
      .toBe(viewerBaseline);
    await viewerPage.locator('[data-floating-action="comments"]').click();
    await expectAddCommentUnavailable(viewerPage);

    ownerGuards.assertClean();
    viewerGuards.assertClean();
  } finally {
    await ownerContext.close();
    await viewerContext.close();
  }
});

test("anonymous realtime share viewer upgrades to editor access in place after signing in as a member", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const editorEmail = `viewer-upgrade-editor-${seed}@example.com`;
  const seededParagraph = `Viewer upgrade collaboration ${seed}`;
  const editorEdit = ` editor-upgrade-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const viewerPage = await viewerContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const viewerGuards = attachConsoleGuards(viewerPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Viewer Upgrade Owner");
    await registerBackendUser(memberApi, editorEmail, "Viewer Upgrade Editor");

    const documentId = await createBackendDocument(ownerApi, `Viewer Upgrade ${seed}`);
    await addDocumentMember(ownerApi, documentId, editorEmail, "editor");
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", true);
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(viewerPage);
    await viewerPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await viewerPage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(viewerPage, documentId);
    await expect(viewerPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await expect
      .poll(async () => (await getDocumentSnapshot(viewerPage)).textContent)
      .toContain(seededParagraph);

    await enableCollaborationFromPanel(viewerPage, `viewer-upgrade-${seed}`);
    await expect(viewerPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await waitForStatusText(viewerPage, ".doc-collaboration-panel-value", "Viewer");

    await loginThroughWorkspaceTopbar(viewerPage, editorEmail, "password123");
    await waitForSyncedStatus(viewerPage);
    await expectReloadMarker(viewerPage, `viewer-upgrade-${seed}`);
    await expect(viewerPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await waitForStatusText(viewerPage, ".doc-collaboration-panel-value", "Viewer Upgrade Editor");
    await waitForStatusText(viewerPage, ".doc-collaboration-panel-value", "Editor");

    await focusEditor(viewerPage);
    await viewerPage.keyboard.type(editorEdit);
    await waitForLayoutIdle(viewerPage);
    await expect
      .poll(async () => (await getDocumentSnapshot(viewerPage)).textContent)
      .toContain(editorEdit);
    await waitForSnapshotContent(ownerApi, documentId);

    ownerGuards.assertClean();
    viewerGuards.assertClean();
  } finally {
    await ownerContext.close();
    await viewerContext.close();
    await memberContext.close();
  }
});

test("member collaboration session downgrades back to readonly share access after logout", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const editorContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const editorApi = editorContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const editorEmail = `collab-logout-editor-${seed}@example.com`;
  const seededParagraph = `Logout downgrade collaboration ${seed}`;
  const blockedEdit = ` logout-downgrade-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const editorPage = await editorContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const editorGuards = attachConsoleGuards(editorPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Collab Logout Owner");
    await registerBackendUser(editorApi, editorEmail, "Collab Logout Editor");

    const documentId = await createBackendDocument(ownerApi, `Collab Logout ${seed}`);
    await addDocumentMember(ownerApi, documentId, editorEmail, "editor");
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", true);
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(editorPage);
    await editorPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await editorPage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(editorPage, documentId);
    await expect(editorPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await enableCollaborationFromPanel(editorPage, `editor-logout-${seed}`);
    await waitForStatusText(editorPage, ".doc-collaboration-panel-value", "Editor");

    await logoutThroughWorkspaceTopbar(editorPage);
    await waitForSyncedStatus(editorPage);
    await expectReloadMarker(editorPage, `editor-logout-${seed}`);
    await expect(editorPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await waitForStatusText(editorPage, ".doc-collaboration-panel-value", "Viewer");
    await waitForStatusText(editorPage, ".doc-collaboration-panel-value", "Read-only");
    await expect
      .poll(async () => (await getDocumentSnapshot(editorPage)).textContent)
      .toContain(seededParagraph);

    const editorBaseline = (await getDocumentSnapshot(editorPage)).textContent;
    await focusEditor(editorPage);
    await editorPage.keyboard.type(blockedEdit);
    await editorPage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(editorPage)).textContent)
      .toBe(editorBaseline);
    await editorPage.locator('[data-floating-action="comments"]').click();
    await expectAddCommentUnavailable(editorPage);

    ownerGuards.assertClean();
    editorGuards.assertClean();
  } finally {
    await ownerContext.close();
    await editorContext.close();
  }
});

test("member collaboration session downgrades back to readonly share access after the owner removes the member", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const editorContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const editorApi = editorContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-member-share-remove-${seed}@example.com`;
  const editorEmail = `collab-share-remove-editor-${seed}@example.com`;
  const seededParagraph = `Member share remove ${seed}`;
  const blockedEdit = ` member-share-remove-${seed}`;

  const ownerPage = await ownerContext.newPage();
  const editorPage = await editorContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const editorGuards = attachConsoleGuards(editorPage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Member Share Remove Owner");
    await registerBackendUser(editorApi, editorEmail, "Member Share Remove Editor");

    const documentId = await createBackendDocument(ownerApi, `Member Share Remove ${seed}`);
    const memberUserId = await addDocumentMember(ownerApi, documentId, editorEmail, "editor");
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", true);
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(editorPage);
    await editorPage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await editorPage.getByRole("button", { name: "Open Document" }).click();
    await expectWorkspaceUrl(editorPage, documentId);
    await expect(editorPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "false");
    await enableCollaborationFromPanel(editorPage, `editor-share-remove-${seed}`);
    await waitForStatusText(editorPage, ".doc-collaboration-panel-value", "Editor");

    await removeDocumentMember(ownerApi, documentId, memberUserId);

    await setReloadMarker(editorPage, `editor-share-remove-${seed}`);
    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitForSyncedStatus(editorPage);
    await expectReloadMarker(editorPage, `editor-share-remove-${seed}`);
    await expect(editorPage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");
    await waitForStatusText(editorPage, ".doc-collaboration-panel-value", "Viewer");
    await waitForStatusText(editorPage, ".doc-collaboration-panel-value", "Read-only");
    await expect
      .poll(async () => (await getDocumentSnapshot(editorPage)).textContent)
      .toContain(seededParagraph);

    const editorBaseline = (await getDocumentSnapshot(editorPage)).textContent;
    await focusEditor(editorPage);
    await editorPage.keyboard.type(blockedEdit);
    await editorPage.waitForTimeout(500);
    await expect
      .poll(async () => (await getDocumentSnapshot(editorPage)).textContent)
      .toBe(editorBaseline);
    await editorPage.locator('[data-floating-action="comments"]').click();
    await expectAddCommentUnavailable(editorPage);

    ownerGuards.assertClean();
    editorGuards.assertClean();
  } finally {
    await ownerContext.close();
    await editorContext.close();
  }
});

test("signed-in-only collaboration share returns to the login gate after logout", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const shareContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const viewerEmail = `restricted-collab-viewer-${seed}@example.com`;
  const seededParagraph = `Restricted collab share ${seed}`;

  const ownerPage = await ownerContext.newPage();
  const sharePage = await shareContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const shareGuards = attachConsoleGuards(sharePage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Restricted Collab Share Owner");
    await registerBackendUser(memberApi, viewerEmail, "Restricted Collab Share Viewer");

    const documentId = await createBackendDocument(ownerApi, `Restricted Collab Share ${seed}`);
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", false);
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(sharePage);
    await sharePage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await sharePage
      .locator(".doc-share-page-actions-row")
      .getByRole("button", { name: "Sign In to Open" })
      .click();
    await loginThroughAccountDialog(sharePage, viewerEmail, "password123");
    await expectWorkspaceUrl(sharePage, documentId);
    await expect(sharePage.locator(".lumenpage-editor")).toHaveAttribute("aria-readonly", "true");

    await enableCollaborationFromPanel(sharePage, `restricted-share-logout-${seed}`);
    await waitForStatusText(sharePage, ".doc-collaboration-panel-value", "Viewer");

    await logoutThroughWorkspaceTopbar(sharePage);
    await expectReloadMarker(sharePage, `restricted-share-logout-${seed}`);
    await expect
      .poll(() => {
        const currentUrl = new URL(sharePage.url());
        return `${currentUrl.pathname}?locale=${currentUrl.searchParams.get("locale") || ""}`;
      })
      .toBe(`/share/${shareToken}?locale=en-US`);
    await expect(sharePage.locator(".doc-share-page-meta")).toContainText("Signed-in access only");
    await expect(sharePage.locator(".doc-share-page-note")).toContainText(
      "Sign in before opening this shared document",
    );
    await expect(sharePage.getByRole("button", { name: "Sign In to Open" })).toBeVisible();

    ownerGuards.assertClean();
    shareGuards.assertClean();
  } finally {
    await ownerContext.close();
    await memberContext.close();
    await shareContext.close();
  }
});

test("signed-in-only workspace route redirects back to the share login gate after logout", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const shareContext = await browser.newContext();
  const ownerApi = ownerContext.request;
  const memberApi = memberContext.request;
  const seed = createSeed();
  const ownerEmail = `owner-${seed}@example.com`;
  const viewerEmail = `restricted-route-viewer-${seed}@example.com`;
  const seededParagraph = `Restricted route share ${seed}`;

  const ownerPage = await ownerContext.newPage();
  const sharePage = await shareContext.newPage();
  const ownerGuards = attachConsoleGuards(ownerPage);
  const shareGuards = attachConsoleGuards(sharePage);

  try {
    await registerBackendUser(ownerApi, ownerEmail, "Restricted Route Share Owner");
    await registerBackendUser(memberApi, viewerEmail, "Restricted Route Share Viewer");

    const documentId = await createBackendDocument(ownerApi, `Restricted Route Share ${seed}`);
    const shareToken = await createDocumentShareToken(ownerApi, documentId, "viewer", false);
    await seedSnapshotThroughOwnerWorkspace(ownerPage, ownerApi, documentId, seededParagraph);

    await applyBackendBootstrap(sharePage);
    await sharePage.goto(`/share/${shareToken}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await sharePage
      .locator(".doc-share-page-actions-row")
      .getByRole("button", { name: "Sign In to Open" })
      .click();
    await loginThroughAccountDialog(sharePage, viewerEmail, "password123");
    await expectWorkspaceUrl(sharePage, documentId);
    await enableCollaborationFromPanel(sharePage, `restricted-route-logout-${seed}`);

    await logoutThroughWorkspaceTopbar(sharePage);
    await expect
      .poll(() => {
        const currentUrl = new URL(sharePage.url());
        return `${currentUrl.pathname}?locale=${currentUrl.searchParams.get("locale") || ""}`;
      })
      .toBe(`/share/${shareToken}?locale=en-US`);

    await sharePage.goto(`/docs/${documentId}?locale=en-US`, {
      waitUntil: "networkidle",
    });
    await expect
      .poll(() => {
        const currentUrl = new URL(sharePage.url());
        return `${currentUrl.pathname}?locale=${currentUrl.searchParams.get("locale") || ""}`;
      })
      .toBe(`/share/${shareToken}?locale=en-US`);
    await expect(sharePage.locator(".doc-share-page-meta")).toContainText("Signed-in access only");
    await expect(sharePage.locator(".doc-share-page-note")).toContainText(
      "Sign in before opening this shared document",
    );
    await expect(sharePage.getByRole("button", { name: "Sign In to Open" })).toBeVisible();

    ownerGuards.assertClean();
    shareGuards.assertClean();
  } finally {
    await ownerContext.close();
    await memberContext.close();
    await shareContext.close();
  }
});
