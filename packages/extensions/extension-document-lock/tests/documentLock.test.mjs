import test from "node:test";
import assert from "node:assert/strict";

import { createSchema, ExtensionManager } from "../../../core/core/dist/index.js";
import { Document } from "../../extension-document/dist/index.js";
import { Paragraph } from "../../extension-paragraph/dist/index.js";
import { Text } from "../../extension-text/dist/index.js";
import { WebPage } from "../../extension-web-page/dist/index.js";
import {
  DOCUMENT_LOCK_META,
  DocumentLock,
  DocumentLockPluginKey,
  findDocumentLockRanges,
} from "../dist/index.js";
import { EditorState, NodeSelection } from "../../../lp/state/dist/index.js";

const createLockedState = () => {
  const manager = new ExtensionManager([Document, Text, Paragraph, DocumentLock]);
  const structure = manager.resolveStructure();
  const schema = createSchema(structure);
  const resolvedState = manager.resolveState(structure);
  const lockMark = schema.marks.documentLock.create();
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [
      schema.text("abc", [lockMark]),
      schema.text("xyz"),
    ]),
  ]);
  return EditorState.create({
    schema,
    doc,
    plugins: resolvedState.plugins,
  });
};

const applyStateCommand = (state, command) => {
  let nextState = state;
  let transactions = [];
  const handled = command(state, (tr) => {
    const result = state.applyTransaction(tr);
    nextState = result.state;
    transactions = result.transactions;
  });
  return { handled, state: nextState, transactions };
};

const createLockedWebPageState = () => {
  const manager = new ExtensionManager([Document, Text, Paragraph, WebPage, DocumentLock]);
  const structure = manager.resolveStructure();
  const schema = createSchema(structure);
  const resolvedState = manager.resolveState(structure);
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("lead")]),
    schema.node("webPage", {
      href: "https://example.com",
      title: "Example",
    }),
    schema.node("paragraph", null, [schema.text("tail")]),
  ]);
  const state = EditorState.create({
    schema,
    doc,
    plugins: resolvedState.plugins,
  });
  const webPagePos = doc.child(0).nodeSize;
  const selected = state.applyTransaction(
    state.tr.setSelection(NodeSelection.create(state.doc, webPagePos))
  ).state;

  return {
    state: selected,
    commands: resolvedState.commands,
    webPagePos,
  };
};

test("document lock blocks deleting locked content", () => {
  const state = createLockedState();
  const [range] = findDocumentLockRanges(state);

  const result = state.applyTransaction(state.tr.delete(range.from, range.to));

  assert.equal(result.transactions.length, 0);
  assert.equal(result.state.doc.textContent, "abcxyz");
});

test("document lock blocks inserting inside a locked range but allows inserting after it", () => {
  const state = createLockedState();
  const [range] = findDocumentLockRanges(state);

  const blocked = state.applyTransaction(state.tr.insertText("!", range.from + 1, range.from + 1));
  assert.equal(blocked.transactions.length, 0);
  assert.equal(blocked.state.doc.textContent, "abcxyz");

  const allowed = state.applyTransaction(state.tr.insertText("!", range.to, range.to));
  assert.equal(allowed.transactions.length, 1);
  assert.equal(allowed.state.doc.textContent, "abc!xyz");
});

test("document lock can be disabled through meta and still keeps marker decorations available", () => {
  const state = createLockedState();
  const disableResult = state.applyTransaction(
    state.tr.setMeta(DOCUMENT_LOCK_META, { enabled: false, skipEnforcement: true })
  );
  const nextState = disableResult.state;
  const pluginState = DocumentLockPluginKey.getState(nextState);
  const plugin = DocumentLockPluginKey.get(nextState);

  assert.equal(pluginState?.enabled, false);
  const decorations = plugin?.props?.decorations?.(nextState);
  assert.equal(decorations?.decorations?.length, 1);
  assert.equal(decorations?.decorations?.[0]?.spec?.widgetAlignment, "page-right");

  const [range] = findDocumentLockRanges(nextState);
  const allowed = nextState.applyTransaction(
    nextState.tr.insertText("!", range.from + 1, range.from + 1)
  );
  assert.equal(allowed.transactions.length, 1);
  assert.equal(allowed.state.doc.textContent, "a!bcxyz");
});

test("document lock locks block atoms like webPage and blocks deleting them", () => {
  const { state, commands, webPagePos } = createLockedWebPageState();

  const lockedResult = applyStateCommand(state, commands.lockSelection());
  assert.equal(lockedResult.handled, true);
  assert.equal(lockedResult.transactions.length, 1);

  const ranges = findDocumentLockRanges(lockedResult.state);
  const nodeRanges = ranges.filter((range) => range.kind === "node");
  assert.equal(nodeRanges.length, 1);
  assert.deepEqual(nodeRanges[0], {
    from: webPagePos,
    to: webPagePos + lockedResult.state.doc.nodeAt(webPagePos).nodeSize,
    kind: "node",
    nodeType: "webPage",
  });

  const plugin = DocumentLockPluginKey.get(lockedResult.state);
  const decorations = plugin?.props?.decorations?.(lockedResult.state)?.decorations || [];
  assert.deepEqual(
    decorations.map((decoration) => decoration.type).sort(),
    ["node", "widget"]
  );

  const blockedDelete = lockedResult.state.applyTransaction(
    lockedResult.state.tr.delete(nodeRanges[0].from, nodeRanges[0].to)
  );
  assert.equal(blockedDelete.transactions.length, 0);
  assert.equal(blockedDelete.state.doc.childCount, lockedResult.state.doc.childCount);
});

test("document lock can unlock a single locked range by explicit range coordinates", () => {
  const { state, commands, webPagePos } = createLockedWebPageState();
  const lockedResult = applyStateCommand(state, commands.lockSelection());
  const lockedNode = lockedResult.state.doc.nodeAt(webPagePos);
  const lockedRange = {
    from: webPagePos,
    to: webPagePos + lockedNode.nodeSize,
  };

  const unlockedResult = applyStateCommand(
    lockedResult.state,
    commands.unlockDocumentLockRange(lockedRange.from, lockedRange.to)
  );
  assert.equal(unlockedResult.handled, true);
  assert.equal(
    findDocumentLockRanges(unlockedResult.state).filter((range) => range.kind === "node").length,
    0
  );

  const allowedDelete = unlockedResult.state.applyTransaction(
    unlockedResult.state.tr.delete(lockedRange.from, lockedRange.to)
  );
  assert.equal(allowedDelete.transactions.length, 1);
  assert.equal(allowedDelete.state.doc.childCount, unlockedResult.state.doc.childCount - 1);
});

test("document lock marker widget can unlock a locked block atom on click", () => {
  const { state, commands } = createLockedWebPageState();
  const lockedResult = applyStateCommand(state, commands.lockSelection());
  const plugin = DocumentLockPluginKey.get(lockedResult.state);
  const decorations = plugin?.props?.decorations?.(lockedResult.state)?.decorations || [];
  const widget = decorations.find((decoration) => decoration.type === "widget");

  let clickedState = lockedResult.state;
  const fakeView = {
    state: clickedState,
    dispatch(tr) {
      const result = this.state.applyTransaction(tr);
      this.state = result.state;
      clickedState = result.state;
    },
  };

  const handled = widget?.spec?.onClick?.({
    view: fakeView,
    event: {
      preventDefault() {},
      stopPropagation() {},
    },
    decoration: widget,
    x: 0,
    y: 0,
    width: Number(widget?.spec?.widgetWidth) || 0,
    height: Number(widget?.spec?.widgetWidth) || 0,
  });

  assert.equal(handled, true);
  assert.equal(
    findDocumentLockRanges(clickedState).filter((range) => range.kind === "node").length,
    0
  );
});
