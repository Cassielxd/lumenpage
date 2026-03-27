import test from "node:test";
import assert from "node:assert/strict";

import { Editor, Node } from "../src/index.ts";

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

const createEditor = (options = {}) =>
  new Editor({
    enableCoreExtensions: false,
    extensions: createMinimalExtensions(),
    content: null,
    ...options,
  });

test("Editor keeps beforeCreate/mount/create/unmount/destroy ordering stable", () => {
  const originalCreateView = Editor.prototype.createView;
  const log = [];

  try {
    Editor.prototype.createView = function (element) {
      const view = {
        element,
        editable: true,
        state: this.state,
        setProps: () => {},
        focus: () => {
          log.push("view-focus");
        },
        destroy: () => {
          log.push("view-destroy");
        },
        _internals: {
          dispatchTransactionBase: () => {},
        },
      };

      this.view = view;
      this.emit("mount", { editor: this });
      return view;
    };

    const editor = createEditor({
      element: {
        kind: "mount-target",
      },
      onBeforeCreate: () => {
        log.push("beforeCreate");
      },
      onMount: () => {
        log.push("mount");
      },
      onCreate: () => {
        log.push("create");
      },
      onUnmount: () => {
        log.push("unmount");
      },
      onDestroy: () => {
        log.push("destroy");
      },
    });

    assert.deepEqual(log.slice(0, 3), ["beforeCreate", "mount", "create"]);
    editor.focus();
    assert.equal(log[3], "view-focus");
    editor.unmount();
    assert.deepEqual(log.slice(4, 6), ["view-destroy", "unmount"]);
    editor.destroy();
    editor.emit("destroy", { editor });
    assert.deepEqual(log, [
      "beforeCreate",
      "mount",
      "create",
      "view-focus",
      "view-destroy",
      "unmount",
      "destroy",
    ]);
  } finally {
    Editor.prototype.createView = originalCreateView;
  }
});

test("Editor keeps setOptions and setEditable view refresh semantics stable", () => {
  const setPropsCalls = [];
  const updateEvents = [];
  const editor = createEditor({
    onUpdate: (event) => {
      updateEvents.push(event);
    },
  });

  editor.view = {
    editable: true,
    state: {
      tr: {
        id: "view-transaction",
      },
    },
    setProps: (props) => {
      setPropsCalls.push(props);
    },
  };

  editor.setOptions({
    editorProps: {
      canvasViewConfig: {
        flavor: "paper",
      },
    },
  });

  assert.equal(setPropsCalls.length, 1);
  assert.equal(setPropsCalls[0].editable, true);
  assert.deepEqual(setPropsCalls[0].canvasViewConfig, {
    flavor: "paper",
    nodeRegistry: editor.nodeRegistry,
  });

  editor.setEditable(false, true);

  assert.equal(editor.options.editable, false);
  assert.equal(editor.isEditable, false);
  assert.equal(setPropsCalls.length, 2);
  assert.equal(setPropsCalls[1].editable, false);
  assert.equal(updateEvents.length, 1);
  assert.equal(updateEvents[0].transaction.id, "view-transaction");
  assert.equal(updateEvents[0].state, editor.view.state);
});

test("Editor keeps dispatchTransaction capture, custom dispatch, and base dispatch ordering stable", () => {
  const log = [];
  const editor = createEditor({
    onBeforeTransaction: ({ transaction, nextState }) => {
      log.push(["beforeTransaction", transaction.id, nextState.id]);
    },
  });

  editor.view = {
    editable: true,
    state: {
      tr: {
        id: "view-transaction",
      },
      applyTransaction: (transaction) => {
        log.push(["applyTransaction", transaction.id]);
        return {
          state: {
            id: `next-${transaction.id}`,
          },
        };
      },
    },
    setProps: () => {},
    _internals: {
      dispatchTransactionBase: (transaction) => {
        log.push(["dispatchBase", transaction.id]);
      },
    },
  };

  editor.dispatchTransaction({
    id: "base-transaction",
  });

  assert.deepEqual(log, [
    ["applyTransaction", "base-transaction"],
    ["beforeTransaction", "base-transaction", "next-base-transaction"],
    ["dispatchBase", "base-transaction"],
  ]);

  editor.customDispatchTransaction = (transaction) => {
    log.push(["customDispatch", transaction.id]);
  };

  editor.dispatchTransaction({
    id: "custom-transaction",
  });

  assert.deepEqual(log.slice(3), [["customDispatch", "custom-transaction"]]);

  editor.customDispatchTransaction = null;

  const mergedSteps = [];
  const firstTransaction = {
    id: "captured-base",
    step: (step) => {
      mergedSteps.push(step);
    },
  };
  const extraStepA = {
    id: "a",
  };
  const extraStepB = {
    id: "b",
  };
  const followupTransaction = {
    id: "captured-followup",
    steps: [extraStepA, extraStepB],
  };

  const captured = editor.captureTransaction(() => {
    editor.dispatchTransaction(firstTransaction);
    editor.dispatchTransaction(followupTransaction);
  });

  assert.equal(captured, firstTransaction);
  assert.deepEqual(mergedSteps, [extraStepA, extraStepB]);
  assert.equal(editor.capturedTransaction, null);
  assert.deepEqual(log.slice(3), [["customDispatch", "custom-transaction"]]);
});
