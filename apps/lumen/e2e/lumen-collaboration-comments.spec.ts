import { expect, test } from "@playwright/test";

import {
  attachConsoleGuards,
  getDocumentSnapshot,
  getParagraphDocPos,
  setParagraphDocument,
  setTextSelection,
  waitForLayoutIdle,
} from "./helpers";

const collabUrl = process.env.PW_COLLAB_URL || "ws://127.0.0.1:15345";

const createDocumentId = () =>
  `pw-collab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildLumenCollabUrl = ({
  docId,
  user,
  color,
}: {
  docId: string;
  user: string;
  color: string;
}) => {
  const params = new URLSearchParams({
    locale: "en-US",
    collab: "1",
    collabUrl,
    collabDoc: docId,
    collabField: "default",
    collabUser: user,
    collabColor: color,
  });
  return `/?${params.toString()}`;
};

const waitForSyncedPresence = async (page: import("@playwright/test").Page, userCount: number) => {
  await expect(page.locator(".collab-status-label")).toHaveText("Synced");
  await expect(page.locator(".collab-status-meta")).toContainText(`${userCount} online`);
};

test("collaboration comments sync and orphan threads are pruned", async ({ browser }) => {
  const docId = createDocumentId();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const aliceGuards = attachConsoleGuards(alice);
  const bobGuards = attachConsoleGuards(bob);

  try {
    await Promise.all([
      alice.goto(
        buildLumenCollabUrl({
          docId,
          user: "Alice",
          color: "#2563eb",
        }),
        { waitUntil: "networkidle" }
      ),
      bob.goto(
        buildLumenCollabUrl({
          docId,
          user: "Bob",
          color: "#dc2626",
        }),
        { waitUntil: "networkidle" }
      ),
    ]);

    await Promise.all([waitForSyncedPresence(alice, 2), waitForSyncedPresence(bob, 2)]);

    await setParagraphDocument(alice, ["Collaboration comments should stay in sync across clients."]);
    await waitForLayoutIdle(alice);

    await expect
      .poll(async () => (await getDocumentSnapshot(bob)).textContent)
      .toContain("Collaboration comments should stay in sync across clients.");

    const selectionStart = await getParagraphDocPos(alice, 0, 0);
    const selectionEnd = await getParagraphDocPos(alice, 0, 13);
    expect(selectionStart).not.toBeNull();
    expect(selectionEnd).not.toBeNull();

    await setTextSelection(alice, selectionStart!, selectionEnd!);
    await alice.getByRole("button", { name: /^Comment(?: \(\d+\))?$/ }).click();
    await expect(alice.locator(".doc-comments")).toBeVisible();
    await expect(alice.locator(".doc-comments-item")).toHaveCount(1);
    await expect(alice.locator(".doc-comments-item-quote").first()).toContainText("Collaboration");

    await alice.locator(".doc-comments-composer-input textarea").fill("Alice created the thread.");
    await alice
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();

    await setTextSelection(bob, selectionStart!, selectionEnd!);
    await bob.getByRole("button", { name: /^Comment(?: \(\d+\))?$/ }).click();
    await expect(bob.locator(".doc-comments")).toBeVisible();
    await expect(bob.locator(".doc-comments-item")).toHaveCount(1);
    await expect(bob.locator(".doc-comments-message-author")).toContainText("Alice");
    await expect(bob.locator(".doc-comments-message-body")).toContainText("Alice created the thread.");

    await bob.locator(".doc-comments-composer-input textarea").fill("Bob replied from the second client.");
    await bob
      .locator(".doc-comments-composer-footer")
      .getByRole("button", { name: "Reply" })
      .click();

    await expect
      .poll(async () => await alice.locator(".doc-comments-message-author").allInnerTexts())
      .toEqual(["Alice", "Bob"]);
    await expect
      .poll(async () => await alice.locator(".doc-comments-message-body").allInnerTexts())
      .toEqual(["Alice created the thread.", "Bob replied from the second client."]);

    await setParagraphDocument(alice, ["The previous comment anchor has been removed."]);
    await waitForLayoutIdle(alice);

    await expect
      .poll(async () => (await getDocumentSnapshot(bob)).textContent)
      .toContain("The previous comment anchor has been removed.");
    await expect.poll(async () => await alice.locator(".doc-comments-item").count()).toBe(0);
    await expect.poll(async () => await bob.locator(".doc-comments-item").count()).toBe(0);
    await expect(alice.getByRole("button", { name: /^Comment$/ })).toBeVisible();
    await expect(bob.getByRole("button", { name: /^Comment$/ })).toBeVisible();

    aliceGuards.assertClean();
    bobGuards.assertClean();
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});
