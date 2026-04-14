import test from "node:test";
import assert from "node:assert/strict";

import { createSchema, ExtensionManager } from "../../../core/core/dist/index.js";
import { Document } from "../../extension-document/dist/index.js";
import { Paragraph } from "../../extension-paragraph/dist/index.js";
import { Text } from "../../extension-text/dist/index.js";
import { WebPage } from "../../extension-web-page/dist/index.js";
import {
  canRunCommandByEditor,
  normalizeContextMenuEntries,
  resolveNodeTarget,
  runContextMenuItemByEditor,
  selectionContainsHit,
} from "../dist/context-menu-plugin.js";
import { EditorState, NodeSelection, TextSelection } from "../../../lp/state/dist/index.js";

const createBasicSchemaState = () => {
  const manager = new ExtensionManager([Document, Text, Paragraph, WebPage]);
  const structure = manager.resolveStructure();
  const schema = createSchema(structure);
  const resolvedState = manager.resolveState(structure);
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("alpha beta")]),
    schema.node("webPage", {
      href: "https://example.com",
      title: "Example",
    }),
    schema.node("paragraph", null, [schema.text("tail")]),
  ]);

  return {
    state: EditorState.create({
      schema,
      doc,
      plugins: resolvedState.plugins,
    }),
    webPagePos: doc.child(0).nodeSize,
  };
};

test("normalizeContextMenuEntries compacts separators and drops invalid items", () => {
  const entries = normalizeContextMenuEntries([
    null,
    { type: "separator", id: "leading" },
    { id: "lock", label: "Lock", command: "lockSelection" },
    { type: "separator", id: "middle-1" },
    { type: "separator", id: "middle-2" },
    { id: "broken", label: "Broken" },
    {
      id: "settings",
      label: "Settings",
      children: [
        { type: "separator", id: "nested-leading" },
        { id: "toggle", label: "Toggle", command: "toggle" },
        { id: "nested-broken", label: "Broken" },
        { type: "separator", id: "nested-trailing" },
      ],
    },
    { id: "unlock", label: "Unlock", run: () => true },
    { type: "separator", id: "trailing" },
  ]);

  assert.deepEqual(entries, [
    {
      type: "item",
      id: "lock",
      label: "Lock",
      command: "lockSelection",
      args: [],
      shortcut: undefined,
      danger: false,
      children: undefined,
      isEnabled: undefined,
      isVisible: undefined,
      run: undefined,
    },
    {
      type: "separator",
      id: "middle-1",
    },
    {
      type: "item",
      id: "settings",
      label: "Settings",
      command: undefined,
      args: [],
      shortcut: undefined,
      danger: false,
      children: [
        {
          type: "item",
          id: "toggle",
          label: "Toggle",
          command: "toggle",
          args: [],
          shortcut: undefined,
          danger: false,
          children: undefined,
          isEnabled: undefined,
          isVisible: undefined,
          run: undefined,
        },
      ],
      isEnabled: undefined,
      isVisible: undefined,
      run: undefined,
    },
    {
      type: "item",
      id: "unlock",
      label: "Unlock",
      command: undefined,
      args: [],
      shortcut: undefined,
      danger: false,
      children: undefined,
      isEnabled: undefined,
      isVisible: undefined,
      run: entries[3]?.run,
    },
  ]);
});

test("selectionContainsHit respects text selections and node selections", () => {
  const { state, webPagePos } = createBasicSchemaState();
  const textState = state.applyTransaction(
    state.tr.setSelection(TextSelection.create(state.doc, 2, 6))
  ).state;

  assert.equal(selectionContainsHit(textState, 3, null), true);
  assert.equal(selectionContainsHit(textState, 7, null), false);

  const nodeState = state.applyTransaction(
    state.tr.setSelection(NodeSelection.create(state.doc, webPagePos))
  ).state;

  assert.equal(selectionContainsHit(nodeState, webPagePos, webPagePos), true);
  assert.equal(selectionContainsHit(nodeState, webPagePos + 1, null), false);
});

test("resolveNodeTarget resolves explicit inside positions and node boundaries", () => {
  const { state, webPagePos } = createBasicSchemaState();

  const fromInside = resolveNodeTarget(state, null, webPagePos);
  assert.equal(fromInside.nodePos, webPagePos);
  assert.equal(fromInside.node?.type?.name, "webPage");

  const fromBoundary = resolveNodeTarget(state, webPagePos, null);
  assert.equal(fromBoundary.nodePos, webPagePos);
  assert.equal(fromBoundary.node?.type?.name, "webPage");
});

test("context menu command helpers use editor command table and custom run handlers", () => {
  const executed = [];
  const editor = {
    commands: {
      can(command, ...args) {
        return command === "lockSelection" && args.length === 1 && args[0] === "range";
      },
      lockSelection(...args) {
        executed.push(["lockSelection", ...args]);
        return true;
      },
    },
  };
  const fakeView = {
    state: null,
    dom: {},
    dispatch() {},
  };

  const commandItem = {
    id: "lock",
    label: "Lock",
    command: "lockSelection",
    args: ["range"],
  };
  assert.equal(canRunCommandByEditor(editor, commandItem), true);
  assert.equal(runContextMenuItemByEditor(editor, fakeView, commandItem, null), true);
  assert.deepEqual(executed, [["lockSelection", "range"]]);

  const customItem = {
    id: "custom",
    label: "Custom",
    run: ({ item, context }) => {
      executed.push([item.id, context?.pos ?? null]);
      return true;
    },
  };
  assert.equal(canRunCommandByEditor(editor, customItem), true);
  assert.equal(runContextMenuItemByEditor(editor, fakeView, customItem, { pos: 12 }), true);
  assert.deepEqual(executed[1], ["custom", 12]);
});
