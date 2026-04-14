import test from "node:test";
import assert from "node:assert/strict";

import {
  EDITOR_SHORTCUTS,
  ExtensionManager,
  getShortcutDisplayLabel,
} from "../src/index.ts";
import { Bold } from "../../../extensions/extension-bold/src/index.ts";
import { Italic } from "../../../extensions/extension-italic/src/index.ts";
import { Underline } from "../../../extensions/extension-underline/src/index.ts";
import { Strike } from "../../../extensions/extension-strike/src/index.ts";
import { Code } from "../../../extensions/extension-code/src/index.ts";
import { Heading } from "../../../extensions/extension-heading/src/index.ts";
import { Blockquote } from "../../../extensions/extension-blockquote/src/index.ts";
import { BulletList } from "../../../extensions/extension-bullet-list/src/index.ts";
import { OrderedList } from "../../../extensions/extension-ordered-list/src/index.ts";
import { Table } from "../../../extensions/extension-table/src/index.ts";

test("extensions expose the expected default keyboard shortcut bindings", () => {
  const manager = new ExtensionManager([
    Bold,
    Italic,
    Underline,
    Strike,
    Code,
    Heading,
    Blockquote,
    BulletList,
    OrderedList,
    Table,
  ]);
  const structure = manager.resolveStructure();
  const state = manager.resolveState(structure);
  const mergedShortcuts = Object.assign({}, ...state.keyboardShortcuts);

  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleBold[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleItalic[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleUnderline[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleStrike[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleInlineCode[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleHeading1[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleHeading2[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleHeading3[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleBlockquote[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleBulletList[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.toggleOrderedList[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.nextTableCell[0]], "function");
  assert.equal(typeof mergedShortcuts[EDITOR_SHORTCUTS.previousTableCell[0]], "function");
});

test("shortcut display labels stay aligned with the default bindings", () => {
  assert.equal(getShortcutDisplayLabel(EDITOR_SHORTCUTS.save), "Ctrl+S");
  assert.equal(getShortcutDisplayLabel(EDITOR_SHORTCUTS.undo), "Ctrl+Z");
  assert.equal(getShortcutDisplayLabel(EDITOR_SHORTCUTS.redo), "Ctrl+Y");
  assert.equal(getShortcutDisplayLabel(EDITOR_SHORTCUTS.toggleBold), "Ctrl+B");
  assert.equal(getShortcutDisplayLabel(EDITOR_SHORTCUTS.toggleStrike), "Ctrl+Shift+S");
  assert.equal(getShortcutDisplayLabel(EDITOR_SHORTCUTS.toggleHeading2), "Ctrl+Alt+2");
  assert.equal(getShortcutDisplayLabel(EDITOR_SHORTCUTS.toggleBulletList), "Ctrl+Shift+8");
  assert.equal(getShortcutDisplayLabel(EDITOR_SHORTCUTS.previousTableCell), "Shift+Tab");
});
