import test from "node:test";
import assert from "node:assert/strict";

import { CommandManager } from "../src/index.ts";

const createTransaction = (id) => {
  const meta = new Map();
  const transaction = {
    id,
    selection: {
      id: `selection-${id}`,
    },
    doc: {
      id: `doc-${id}`,
    },
    storedMarks: [`mark-${id}`],
    steps: [],
    setMeta(key, value) {
      meta.set(key, value);
      return transaction;
    },
    getMeta(key) {
      return meta.get(key);
    },
    step(step) {
      transaction.steps.push(step);
      return transaction;
    },
  };

  return transaction;
};

const createState = (transaction, { onApply } = {}) => ({
  id: `state-${transaction.id}`,
  selection: {
    id: `base-selection-${transaction.id}`,
  },
  doc: (() => {
    const doc = {
      id: `base-doc-${transaction.id}`,
      eq(other) {
        return other === doc || other?.id === doc.id;
      },
    };
    transaction.before = doc;
    return doc;
  })(),
  storedMarks: [`base-mark-${transaction.id}`],
  plugins: [],
  schema: {
    id: "schema",
  },
  apply(tr) {
    return onApply ? onApply(tr) : createState(createTransaction(`applied-${tr.id}`));
  },
  applyTransaction(tr) {
    return {
      state: createState(createTransaction(`next-${tr.id}`)),
    };
  },
  reconfigure() {
    return this;
  },
  toJSON() {
    return {
      id: this.id,
    };
  },
  get tr() {
    return transaction;
  },
});

test("CommandManager command facade keeps nested command sharing and legacy dispatch semantics stable", () => {
  const dispatches = [];
  const observations = [];
  const transaction = createTransaction("command");
  const state = createState(transaction);
  const view = {
    state,
    dispatch: (tr) => {
      dispatches.push(tr);
    },
  };
  const editor = {
    view,
    state,
  };
  const manager = new CommandManager(editor, {
    setFlag: (name) => (props) => {
      observations.push({
        command: "setFlag",
        name,
        tr: props.tr,
        dispatchType: typeof props.dispatch,
      });
      props.tr.setMeta(`flag:${name}`, true);
      return true;
    },
    nested: () => (props) => {
      observations.push({
        command: "nested",
        tr: props.tr,
        dispatchType: typeof props.dispatch,
      });
      return props.commands.setFlag("nested");
    },
    legacy(stateArg, dispatchArg, viewArg) {
      observations.push({
        command: "legacy",
        selectionId: stateArg.selection.id,
        docId: stateArg.doc.id,
        storedMarks: stateArg.storedMarks,
        dispatchType: typeof dispatchArg,
        sameView: viewArg === view,
      });
      stateArg.tr.setMeta("legacy", true);
      return true;
    },
  });

  assert.equal(manager.commands.nested(), true);
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0], transaction);
  assert.equal(transaction.getMeta("flag:nested"), true);
  assert.deepEqual(observations.slice(0, 2), [
    {
      command: "nested",
      tr: transaction,
      dispatchType: "function",
    },
    {
      command: "setFlag",
      name: "nested",
      tr: transaction,
      dispatchType: "function",
    },
  ]);

  assert.equal(manager.commands.legacy(), true);
  assert.equal(dispatches.length, 2);
  assert.equal(dispatches[1], transaction);
  assert.equal(transaction.getMeta("legacy"), true);
  assert.deepEqual(observations[2], {
    command: "legacy",
    selectionId: `selection-${transaction.id}`,
    docId: `doc-${transaction.id}`,
    storedMarks: [`mark-${transaction.id}`],
    dispatchType: "function",
    sameView: true,
  });
});

test("CommandManager can and chain keep no-dispatch and shared-transaction semantics stable", () => {
  const dispatches = [];
  const observations = [];
  const transaction = createTransaction("chain");
  const state = createState(transaction);
  const view = {
    state,
    dispatch: (tr) => {
      dispatches.push(tr);
    },
  };
  const editor = {
    view,
    state,
  };
  const manager = new CommandManager(editor, {
    push: (value) => (props) => {
      observations.push({
        command: "push",
        value,
        tr: props.tr,
        dispatchType: typeof props.dispatch,
      });
      const order = props.tr.getMeta("order") ?? [];
      props.tr.setMeta("order", [...order, value]);
      return true;
    },
    fail: () => (props) => {
      observations.push({
        command: "fail",
        tr: props.tr,
        dispatchType: typeof props.dispatch,
      });
      props.tr.setMeta("failed", true);
      return false;
    },
  });

  assert.equal(manager.can().push("can-check"), true);
  assert.equal(dispatches.length, 0);
  assert.deepEqual(observations[0], {
    command: "push",
    value: "can-check",
    tr: transaction,
    dispatchType: "undefined",
  });

  const chainResult = manager.chain().push("first").push("second").fail().run();

  assert.equal(chainResult, false);
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0], transaction);
  assert.deepEqual(transaction.getMeta("order"), ["can-check", "first", "second"]);
  assert.equal(transaction.getMeta("failed"), true);
  assert.deepEqual(observations.slice(1), [
    {
      command: "push",
      value: "first",
      tr: transaction,
      dispatchType: "function",
    },
    {
      command: "push",
      value: "second",
      tr: transaction,
      dispatchType: "function",
    },
    {
      command: "fail",
      tr: transaction,
      dispatchType: "function",
    },
  ]);

  const canChainResult = manager.chain().can().push("can-chain").run();

  assert.equal(canChainResult, true);
  assert.equal(dispatches.length, 1);
  assert.deepEqual(transaction.getMeta("order"), ["can-check", "first", "second", "can-chain"]);
});

test("CommandManager respects preventDispatch and falls back to editor.state.apply when no view exists", () => {
  const transaction = createTransaction("prevent");
  const state = createState(transaction);
  const viewDispatches = [];
  const editorWithView = {
    view: {
      state,
      dispatch: (tr) => {
        viewDispatches.push(tr);
      },
    },
    state,
  };
  const preventManager = new CommandManager(editorWithView, {
    prevent: () => (props) => {
      props.tr.setMeta("preventDispatch", true);
      return true;
    },
  });

  assert.equal(preventManager.commands.prevent(), true);
  assert.equal(viewDispatches.length, 0);

  const applyLog = [];
  const fallbackTransaction = createTransaction("fallback");
  const fallbackState = createState(fallbackTransaction, {
    onApply: (tr) => {
      applyLog.push(tr);
      return createState(createTransaction(`after-${tr.id}`));
    },
  });
  const editorWithoutView = {
    view: null,
    state: fallbackState,
  };
  const fallbackManager = new CommandManager(editorWithoutView, {
    mutate: () => (props) => {
      props.tr.setMeta("mutated", true);
      return true;
    },
  });

  assert.equal(fallbackManager.commands.mutate(), true);
  assert.deepEqual(applyLog, [fallbackTransaction]);
  assert.equal(editorWithoutView.state.id, "state-after-fallback");
});

test("CommandManager runtime overrides and commands.run keep current factory and legacy execution semantics stable", () => {
  const runtimeDispatches = [];
  const transaction = createTransaction("runtime");
  const state = createState(transaction);
  const runtimeView = {
    state,
  };
  const editor = {
    view: {
      state: createState(createTransaction("editor-view")),
      dispatch: () => {
        throw new Error("editor view dispatch should not be used");
      },
    },
    state: createState(createTransaction("editor-state")),
  };
  const manager = new CommandManager(editor, {}).withRuntime({
    state,
    view: runtimeView,
    dispatch: (tr) => {
      runtimeDispatches.push(tr);
    },
  });

  const editorRunResult = manager.commands.run(
    (label) => (props) => {
      assert.equal(label, "editor-run");
      assert.equal(props.view, runtimeView);
      assert.equal(props.state.id, state.id);
      assert.equal(typeof props.dispatch, "function");
      props.tr.setMeta("editor-run", true);
      return true;
    },
    "editor-run"
  );

  const legacyRunResult = manager.commands.run((stateArg, dispatchArg, viewArg) => {
    assert.equal(stateArg.id, state.id);
    assert.equal(typeof dispatchArg, "function");
    assert.equal(viewArg, runtimeView);
    stateArg.tr.setMeta("legacy-run", true);
    return true;
  });

  const suppressedManager = manager.withRuntime({
    dispatch: null,
  });
  const suppressedResult = suppressedManager.commands.run(
    () => (props) => {
      assert.equal(typeof props.dispatch, "undefined");
      props.tr.setMeta("suppressed", true);
      return true;
    }
  );

  assert.equal(editorRunResult, true);
  assert.equal(legacyRunResult, true);
  assert.equal(suppressedResult, true);
  assert.deepEqual(runtimeDispatches, [transaction, transaction]);
  assert.equal(transaction.getMeta("editor-run"), true);
  assert.equal(transaction.getMeta("legacy-run"), true);
  assert.equal(transaction.getMeta("suppressed"), true);
});

test("CommandManager skips final dispatch when a legacy command already changed the editor state", () => {
  const dispatches = [];
  const transaction = createTransaction("external-change");
  const state = createState(transaction);
  const nextState = createState(createTransaction("external-change-next"));
  const view = {
    state,
    dispatch: (tr) => {
      dispatches.push(tr);
    },
  };
  const editor = {
    view,
    state,
  };
  const manager = new CommandManager(editor, {
    externalChange(stateArg, _dispatchArg) {
      stateArg.tr.setMeta("legacy-external-change", true);
      view.state = nextState;
      editor.state = nextState;
      return true;
    },
  });

  assert.equal(manager.commands.externalChange(), true);
  assert.equal(transaction.getMeta("legacy-external-change"), true);
  assert.deepEqual(dispatches, []);
});
