import test from "node:test";
import assert from "node:assert/strict";

import {
  markPasteRule,
  nodePasteRule,
  PasteRule,
  pasteRulesPlugin,
  textPasteRule,
} from "../src/index.ts";

const createTransaction = (id, doc) => {
  const meta = new Map();
  const transaction = {
    id,
    doc,
    selection: {
      id: `selection-${id}`,
    },
    storedMarks: [],
    mapping: {
      map: (pos) => pos,
    },
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

const createChainableStateSource = (transaction) => ({
  doc: transaction.doc,
  tr: transaction,
  plugins: [],
  schema: {
    id: "schema",
  },
  apply() {
    return this;
  },
  applyTransaction() {
    return {
      state: this,
    };
  },
  reconfigure() {
    return this;
  },
  toJSON() {
    return {
      id: "state",
    };
  },
});

test("pasteRulesPlugin keeps paste event handoff, diff mapping, and command bridge semantics stable", () => {
  const observations = [];
  const doc = {
    content: {
      findDiffStart: () => 2,
      findDiffEnd: () => ({
        a: 7,
        b: 7,
      }),
    },
    nodesBetween(from, to, callback) {
      observations.push(["nodesBetween", from, to]);
      callback(
        {
          isText: true,
          text: "xxfoo yy",
          nodeSize: 8,
        },
        1
      );
    },
  };
  const transaction = createTransaction("paste-1", doc);
  const oldState = {
    doc: {
      content: {
        findDiffStart: () => 2,
        findDiffEnd: () => ({
          a: 7,
          b: 7,
        }),
      },
    },
  };
  const newState = createChainableStateSource(transaction);
  const editor = {
    rawCommands: {
      record: (label) => (props) => {
        observations.push(["command", label, typeof props.dispatch, props.tr === transaction]);

        if (props.dispatch) {
          props.tr.step({
            label,
          });
        }

        return true;
      },
    },
    view: {
      id: "editor-view",
    },
  };
  const rule = new PasteRule({
    find(text, event) {
      observations.push(["find", text, event?.type ?? null]);
      return [
        {
          index: 2,
          text: "foo",
          data: {
            source: "finder",
          },
        },
      ];
    },
    handler({ range, match, commands, chain, can, pasteEvent }) {
      observations.push(["handler", range, match.data, pasteEvent?.type ?? null]);
      observations.push(["can-result", can().record("can")]);
      observations.push(["chain-result", chain().record("chain").run()]);
      observations.push(["command-result", commands.record("direct")]);
    },
  });
  const [plugin] = pasteRulesPlugin({
    editor,
    rules: [rule],
  });

  assert.equal(
    plugin.props.handlePaste(
      {
        id: "view",
      },
      {
        type: "paste",
      }
    ),
    false
  );

  const appended = plugin.spec.appendTransaction(
    [
      {
        getMeta: (key) => (key === "uiEvent" ? "paste" : null),
      },
    ],
    oldState,
    newState
  );

  assert.equal(appended, transaction);
  assert.deepEqual(transaction.steps, [{ label: "chain" }, { label: "direct" }]);
  assert.deepEqual(observations, [
    ["nodesBetween", 1, 6],
    ["find", "xxfoo yy", "paste"],
    ["handler", { from: 4, to: 7 }, { source: "finder" }, "paste"],
    ["command", "can", "undefined", true],
    ["can-result", true],
    ["command", "chain", "function", true],
    ["chain-result", true],
    ["command", "direct", "function", true],
    ["command-result", true],
  ]);
});

test("pasteRulesPlugin resets cached pasteEvent and returns null when rule does not change the transaction", () => {
  const seenPasteEvents = [];
  const doc = {
    content: {
      findDiffStart: () => 1,
      findDiffEnd: () => ({
        a: 4,
        b: 4,
      }),
    },
    nodesBetween(_from, _to, callback) {
      callback(
        {
          isText: true,
          text: "foo",
          nodeSize: 3,
        },
        0
      );
    },
  };
  const editor = {
    rawCommands: {},
    view: null,
  };
  const rule = new PasteRule({
    find: /foo/,
    handler({ pasteEvent }) {
      seenPasteEvents.push(pasteEvent?.type ?? null);
      return null;
    },
  });
  const [plugin] = pasteRulesPlugin({
    editor,
    rules: [rule],
  });

  plugin.props.handlePaste(
    {},
    {
      type: "paste",
    }
  );

  const firstResult = plugin.spec.appendTransaction(
    [
      {
        getMeta: (key) => (key === "uiEvent" ? "paste" : null),
      },
    ],
    {
      doc: {
        content: doc.content,
      },
    },
    createChainableStateSource(createTransaction("paste-2", doc))
  );
  const secondResult = plugin.spec.appendTransaction(
    [
      {
        getMeta: (key) => (key === "uiEvent" ? "paste" : null),
      },
    ],
    {
      doc: {
        content: doc.content,
      },
    },
    createChainableStateSource(createTransaction("paste-3", doc))
  );

  assert.equal(firstResult, null);
  assert.equal(secondResult, null);
  assert.deepEqual(seenPasteEvents, ["paste", null]);
});

test("markPasteRule keeps current mark application semantics for plain and capture-group matches", () => {
  const actions = [];
  const type = {
    name: "highlight",
    create: (attrs) => ({
      type: "highlight",
      attrs,
    }),
  };
  const plainRule = markPasteRule({
    find: /foo/,
    type,
    getAttributes: (match, event) => ({
      label: match[0],
      eventType: event?.type ?? null,
    }),
  });

  plainRule.handler({
    state: {
      doc: {
        nodesBetween() {},
      },
      tr: {
        addMark: (...args) => {
          actions.push(["addMark", ...args]);
        },
        removeStoredMark: (markType) => {
          actions.push(["removeStoredMark", markType]);
        },
      },
    },
    range: {
      from: 5,
      to: 8,
    },
    match: Object.assign(["foo"], {
      input: "foo",
    }),
    pasteEvent: {
      type: "paste",
    },
  });

  const captureRule = markPasteRule({
    find: /~~(foo)~~/,
    type,
  });

  captureRule.handler({
    state: {
      doc: {
        nodesBetween(_from, _to, callback) {
          callback(
            {
              isText: true,
              marks: [],
              nodeSize: 7,
            },
            10
          );
        },
      },
      tr: {
        delete: (...args) => {
          actions.push(["delete", ...args]);
        },
        addMark: (...args) => {
          actions.push(["capture-addMark", ...args]);
        },
        removeStoredMark: (markType) => {
          actions.push(["capture-removeStoredMark", markType]);
        },
      },
    },
    range: {
      from: 10,
      to: 17,
    },
    match: Object.assign(["~~foo~~", "foo"], {
      input: "~~foo~~",
    }),
    pasteEvent: null,
  });

  assert.deepEqual(actions, [
    [
      "addMark",
      5,
      8,
      {
        type: "highlight",
        attrs: {
          label: "foo",
          eventType: "paste",
        },
      },
    ],
    ["removeStoredMark", type],
    ["delete", 15, 17],
    ["delete", 10, 12],
    [
      "capture-addMark",
      10,
      13,
      {
        type: "highlight",
        attrs: {},
      },
    ],
    ["capture-removeStoredMark", type],
  ]);
});

test("nodePasteRule and textPasteRule keep current replacement semantics stable", () => {
  const actions = [];
  const nodeType = {
    name: "mention",
  };
  const nodeRule = nodePasteRule({
    find: /@(\w+)/,
    type: nodeType,
    getAttributes: (match, event) => ({
      id: match[1],
      source: event?.type ?? null,
    }),
    getContent: (attrs) => [
      {
        type: "text",
        text: attrs.id,
      },
    ],
  });

  nodeRule.handler({
    state: {
      schema: {
        nodeFromJSON: (json) => ({
          createdFrom: json,
        }),
      },
      tr: {
        replaceRangeWith: (...args) => {
          actions.push(["replaceRangeWith", ...args]);
        },
      },
    },
    range: {
      from: 3,
      to: 8,
    },
    match: Object.assign(["@lumen", "lumen"], {
      input: "@lumen",
    }),
    pasteEvent: {
      type: "paste",
    },
  });

  const textRule = textPasteRule({
    find: /~~(foo)~~/,
    replace: "_",
  });

  textRule.handler({
    state: {
      tr: {
        insertText: (...args) => {
          actions.push(["insertText", ...args]);
        },
      },
    },
    range: {
      from: 10,
      to: 17,
    },
    match: Object.assign(["~~foo~~", "foo"], {
      input: "~~foo~~",
    }),
  });

  assert.deepEqual(actions, [
    [
      "replaceRangeWith",
      3,
      8,
      {
        createdFrom: {
          type: "mention",
          attrs: {
            id: "lumen",
            source: "paste",
          },
          content: [
            {
              type: "text",
              text: "lumen",
            },
          ],
        },
      },
    ],
    ["insertText", "_~~", 12, 17],
  ]);
});
