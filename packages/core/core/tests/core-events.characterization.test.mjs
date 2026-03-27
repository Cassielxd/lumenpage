import test from "node:test";
import assert from "node:assert/strict";

import { createEditorViewProps } from "../src/bridge/canvas/createEditorViewProps.ts";
import { Editor, Extension, Node } from "../src/index.ts";

const createMinimalExtensions = () => [
  Node.create({
    name: "doc",
    topNode: true,
    content: "paragraph*",
  }),
  Node.create({
    name: "paragraph",
    group: "block",
    content: "text*",
  }),
  Node.create({
    name: "text",
    group: "inline",
  }),
];

test("Editor keeps option listeners before extension hooks and extension priority order stable", () => {
  const log = [];
  const high = Extension.create({
    name: "high-hooks",
    priority: 200,
    onBeforeCreate() {
      log.push("high-beforeCreate");
    },
    onCreate() {
      log.push("high-create");
    },
    onDestroy() {
      log.push("high-destroy");
    },
  });
  const low = Extension.create({
    name: "low-hooks",
    priority: 100,
    onBeforeCreate() {
      log.push("low-beforeCreate");
    },
    onCreate() {
      log.push("low-create");
    },
    onDestroy() {
      log.push("low-destroy");
    },
  });

  const editor = new Editor({
    enableCoreExtensions: false,
    extensions: [...createMinimalExtensions(), low, high],
    onBeforeCreate: () => {
      log.push("option-beforeCreate");
    },
    onCreate: () => {
      log.push("option-create");
    },
    onDestroy: () => {
      log.push("option-destroy");
    },
  });

  assert.deepEqual(log, [
    "option-beforeCreate",
    "high-beforeCreate",
    "low-beforeCreate",
    "option-create",
    "high-create",
    "low-create",
  ]);

  editor.destroy();

  assert.deepEqual(log, [
    "option-beforeCreate",
    "high-beforeCreate",
    "low-beforeCreate",
    "option-create",
    "high-create",
    "low-create",
    "option-destroy",
    "high-destroy",
    "low-destroy",
  ]);
});

test("core focus, blur, paste, drop, and beforeInput plugins keep current event semantics stable", () => {
  const emitted = [];
  const editor = new Editor({
    enableCoreExtensions: ["focusEvents", "beforeInput", "paste", "drop"],
    extensions: createMinimalExtensions(),
  });

  editor.on("focus", (event) => {
    emitted.push(["focus", event.event.type]);
  });
  editor.on("blur", (event) => {
    emitted.push(["blur", event.event.type]);
  });
  editor.on("paste", (event) => {
    emitted.push(["paste", event.event.type, event.slice]);
  });
  editor.on("drop", (event) => {
    emitted.push(["drop", event.event.type, event.slice, event.moved]);
  });

  const props = createEditorViewProps({
    editor,
    editorProps: {},
    dispatchTransaction: () => {},
  });
  const focusPlugin = editor.plugins.find((plugin) => plugin.props.handleDOMEvents?.focus);
  const beforeInputPlugin = editor.plugins.find((plugin) => plugin.props.handleBeforeInput);
  const pastePlugin = editor.plugins.find((plugin) => plugin.props.handlePaste);
  const dropPlugin = editor.plugins.find((plugin) => plugin.props.handleDrop);
  const dispatchedTransactions = [];
  const fakeView = {
    state: editor.state,
    dispatch: (transaction) => {
      dispatchedTransactions.push(transaction);
    },
  };

  assert.ok(focusPlugin);
  assert.ok(beforeInputPlugin);
  assert.ok(pastePlugin);
  assert.ok(dropPlugin);

  editor.handleCoreBeforeInput = (_view, event) => event.type === "beforeinput";

  assert.equal(
    beforeInputPlugin.props.handleBeforeInput(fakeView, {
      type: "beforeinput",
    }),
    true
  );

  assert.equal(
    pastePlugin.props.handlePaste(
      fakeView,
      {
        type: "paste",
      },
      "slice-paste"
    ),
    false
  );
  assert.equal(
    dropPlugin.props.handleDrop(
      fakeView,
      {
        type: "drop",
      },
      "slice-drop",
      true
    ),
    false
  );

  assert.deepEqual(emitted.slice(0, 2), [
    ["paste", "paste", "slice-paste"],
    ["drop", "drop", "slice-drop", true],
  ]);

  assert.equal(
    focusPlugin.props.handleDOMEvents.focus(fakeView, {
      type: "focus",
    }),
    false
  );
  assert.equal(editor.isFocused, true);
  assert.equal(dispatchedTransactions.length, 1);
  assert.equal(dispatchedTransactions[0].getMeta("focus").event.type, "focus");
  assert.equal(dispatchedTransactions[0].getMeta("addToHistory"), false);

  props.onChange(fakeView, {
    oldState: editor.state,
    state: editor.state,
    transaction: dispatchedTransactions[0],
    appendedTransactions: [],
    selectionChanged: false,
    docChanged: false,
  });

  assert.deepEqual(emitted[2], ["focus", "focus"]);

  assert.equal(
    focusPlugin.props.handleDOMEvents.blur(fakeView, {
      type: "blur",
    }),
    false
  );
  assert.equal(editor.isFocused, false);
  assert.equal(dispatchedTransactions.length, 2);
  assert.equal(dispatchedTransactions[1].getMeta("blur").event.type, "blur");
  assert.equal(dispatchedTransactions[1].getMeta("addToHistory"), false);

  props.onChange(fakeView, {
    oldState: editor.state,
    state: editor.state,
    transaction: dispatchedTransactions[1],
    appendedTransactions: [],
    selectionChanged: false,
    docChanged: false,
  });

  assert.deepEqual(emitted[3], ["blur", "blur"]);
});
