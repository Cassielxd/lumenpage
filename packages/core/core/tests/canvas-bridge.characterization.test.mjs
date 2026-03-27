import test from "node:test";
import assert from "node:assert/strict";

import { createEditorViewProps } from "../src/bridge/canvas/createEditorViewProps.ts";
import {
  collectNodeSelectionTypes,
  createSelectionGeometry,
} from "../src/bridge/canvas/selectionGeometry.ts";
import { PaginationDocWorkerClient } from "../src/bridge/canvas/paginationWorkerClient.ts";

test("selection geometry aggregation keeps current fallback and dedupe behavior stable", () => {
  const firstRects = [{ left: 1, top: 2, width: 3, height: 4 }];
  const secondRects = [{ left: 9, top: 8, width: 7, height: 6 }];
  const resolved = {
    canvas: {
      selectionGeometries: [
        {
          shouldComputeSelectionRects: () => false,
          shouldRenderBorderOnly: () => false,
          resolveSelectionRects: () => null,
        },
        {
          shouldComputeSelectionRects: () => true,
          shouldRenderBorderOnly: () => false,
          resolveSelectionRects: () => firstRects,
        },
        {
          shouldComputeSelectionRects: () => false,
          shouldRenderBorderOnly: () => true,
          resolveSelectionRects: () => secondRects,
        },
      ],
      nodeSelectionTypes: ["paragraph", "shared", "paragraph", "custom"],
    },
  };

  const geometryFactory = createSelectionGeometry(resolved);
  const geometry = geometryFactory?.();

  assert.equal(typeof geometryFactory, "function");
  assert.equal(geometry?.shouldComputeSelectionRects({}), true);
  assert.equal(geometry?.shouldRenderBorderOnly({}), true);
  assert.deepEqual(geometry?.resolveSelectionRects({}), firstRects);
  assert.deepEqual(collectNodeSelectionTypes(resolved), ["paragraph", "shared", "custom"]);
});

test("createEditorViewProps keeps transform wiring and onChange event ordering stable", () => {
  const callLog = [];
  const baseSequence = [];
  const emittedEvents = [];
  const editor = {
    state: {
      id: "editor-state",
    },
    options: {
      editable: true,
    },
    nodeRegistry: {
      kind: "registry",
    },
    selectionGeometry: {
      kind: "geometry",
    },
    nodeSelectionTypes: ["paragraph", "custom"],
    extensionManager: {
      transformCopied: (baseTransform) => (slice, view) => {
        callLog.push(["transformCopied", slice, view]);
        return `${baseTransform ? baseTransform(slice, view) : slice}|ext-copied`;
      },
      transformCopiedHTML: (baseTransform) => (html, slice, view) => {
        callLog.push(["transformCopiedHTML", html, slice, view]);
        return `${baseTransform ? baseTransform(html, slice, view) : html}|ext-copied-html`;
      },
      clipboardTextSerializer: (baseSerializer) => (slice, view) => {
        callLog.push(["clipboardTextSerializer", slice, view]);
        return `${baseSerializer ? baseSerializer(slice, view) : ""}|ext-serializer`;
      },
      clipboardTextParser: (baseParser) => (text, context, plain, view) => {
        callLog.push(["clipboardTextParser", text, context, plain, view]);
        return {
          result: baseParser ? baseParser(text, context, plain, view) : null,
          plain,
          source: "ext",
        };
      },
      clipboardParser: (baseParser) => ({
        source: "ext-parser",
        baseParser,
      }),
      clipboardSerializer: (baseSerializer) => ({
        source: "ext-serializer",
        baseSerializer,
      }),
      transformPasted: (baseTransform) => (slice, view) => {
        callLog.push(["transformPasted", slice, view]);
        return `${baseTransform ? baseTransform(slice, view) : slice}|ext-pasted`;
      },
      transformPastedText: (baseTransform) => (text, plain, view) => {
        callLog.push(["transformPastedText", text, plain, view]);
        return `${baseTransform ? baseTransform(text, plain, view) : text}|ext-pasted-text`;
      },
      transformPastedHTML: (baseTransform) => (html, view) => {
        callLog.push(["transformPastedHTML", html, view]);
        return `${baseTransform ? baseTransform(html, view) : html}|ext-pasted-html`;
      },
    },
    emit: (name, payload) => {
      emittedEvents.push({
        name,
        payload,
      });
    },
  };
  const view = {
    state: {
      id: "view-state",
    },
  };
  const transaction = {
    getMeta: (key) => (key === "focus" ? { event: { type: "focus" } } : null),
  };
  const appendedBlurTransaction = {
    getMeta: (key) => (key === "blur" ? { event: { type: "blur" } } : null),
  };
  const props = createEditorViewProps({
    editor,
    editorProps: {
      onChange: (viewArg, event) => {
        baseSequence.push({
          type: "baseOnChange",
          view: viewArg,
          event,
        });
      },
      canvasViewConfig: {
        shared: "config",
      },
      transformCopied: (_view, slice) => `${slice}|base-copied`,
      transformCopiedHTML: (_view, html) => `${html}|base-copied-html`,
      clipboardTextSerializer: (_view, slice) => `${slice}|base-serializer`,
      clipboardTextParser: (_view, text, _context, plain) => `${text}|base-parser|${plain}`,
      clipboardParser: {
        kind: "base-parser",
      },
      clipboardSerializer: {
        kind: "base-serializer",
      },
      transformPasted: (_view, slice) => `${slice}|base-pasted`,
      transformPastedText: (_view, text, plain) => `${text}|base-pasted-text|${plain}`,
      transformPastedHTML: (_view, html) => `${html}|base-pasted-html`,
    },
    dispatchTransaction: (nextTransaction) => {
      baseSequence.push({
        type: "dispatch",
        transaction: nextTransaction,
      });
    },
  });

  assert.equal(props.state, editor.state);
  assert.equal(props.editable, true);
  assert.deepEqual(props.canvasViewConfig, {
    shared: "config",
    nodeRegistry: editor.nodeRegistry,
  });
  assert.equal(props.selectionGeometry, editor.selectionGeometry);
  assert.deepEqual(props.nodeSelectionTypes, ["paragraph", "custom"]);
  assert.equal(props.transformCopied(view, "slice"), "slice|base-copied|ext-copied");
  assert.equal(
    props.transformCopiedHTML(view, "<p>x</p>", "slice"),
    "<p>x</p>|base-copied-html|ext-copied-html"
  );
  assert.equal(props.clipboardTextSerializer(view, "slice"), "slice|base-serializer|ext-serializer");
  assert.deepEqual(props.clipboardTextParser(view, "hello", { source: "ctx" }, true), {
    result: "hello|base-parser|true",
    plain: true,
    source: "ext",
  });
  assert.deepEqual(props.clipboardParser, {
    source: "ext-parser",
    baseParser: {
      kind: "base-parser",
    },
  });
  assert.deepEqual(props.clipboardSerializer, {
    source: "ext-serializer",
    baseSerializer: {
      kind: "base-serializer",
    },
  });
  assert.equal(props.transformPasted(view, "slice"), "slice|base-pasted|ext-pasted");
  assert.equal(
    props.transformPastedText(view, "hello", false),
    "hello|base-pasted-text|false|ext-pasted-text"
  );
  assert.equal(props.transformPastedHTML(view, "<p>x</p>"), "<p>x</p>|base-pasted-html|ext-pasted-html");

  props.onChange(view, {
    oldState: {
      id: "old-state",
    },
    state: {
      id: "next-state",
    },
    transaction,
    appendedTransactions: [appendedBlurTransaction],
    selectionChanged: true,
    docChanged: true,
  });

  assert.equal(editor.state.id, "next-state");
  assert.deepEqual(baseSequence.map((entry) => entry.type), ["baseOnChange"]);
  assert.deepEqual(emittedEvents.map((entry) => entry.name), [
    "transaction",
    "selectionUpdate",
    "blur",
    "update",
  ]);
  assert.equal(emittedEvents[0].payload.oldState.id, "old-state");
  assert.equal(emittedEvents[0].payload.state.id, "next-state");
  assert.equal(emittedEvents[2].payload.event.type, "blur");
  assert.equal(callLog.length, 7);
});

test("PaginationDocWorkerClient keeps seed-layout reuse and settings reset semantics stable", async () => {
  const OriginalWorker = globalThis.Worker;

  class FakeWorker {
    static instances = [];

    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.posted = [];
      this.terminated = false;
      this.listeners = {
        message: [],
        error: [],
      };
      FakeWorker.instances.push(this);
    }

    addEventListener(type, listener) {
      this.listeners[type].push(listener);
    }

    postMessage(message) {
      this.posted.push(message);
    }

    emitMessage(data) {
      for (const listener of this.listeners.message) {
        listener({ data });
      }
    }

    terminate() {
      this.terminated = true;
    }
  }

  globalThis.Worker = FakeWorker;

  try {
    const client = new PaginationDocWorkerClient(new URL("file:///pagination-worker.js"));
    const worker = FakeWorker.instances[0];
    const settings = {
      pageWidth: 900,
      pageHeight: 1200,
      margin: {
        left: 80,
      },
      textLocale: "en-US",
      paginationWorker: {
        timeoutMs: 25,
      },
    };
    const firstPromise = client.requestLayout({
      doc: {
        toJSON: () => ({
          type: "doc",
        }),
      },
      previousLayout: {
        pages: [1],
      },
      changeSummary: {
        changed: true,
      },
      settings,
      cascadePagination: true,
      cascadeFromPageIndex: 2,
    });

    assert.equal(worker.options.type, "module");
    assert.deepEqual(worker.posted[0].docJson, {
      type: "doc",
    });
    assert.deepEqual(worker.posted[0].seedLayout, {
      pages: [1],
    });
    assert.deepEqual(worker.posted[0].workerDebug, {
      hadSeedLayout: false,
      sentSeedLayout: true,
      settingsChanged: true,
      prevPages: 1,
    });
    assert.equal(worker.posted[0].settings.pageWidth, 900);
    assert.equal(worker.posted[0].settings.pageHeight, 1200);
    assert.equal(worker.posted[0].settings.margin.left, 80);
    assert.equal(worker.posted[0].settings.margin.right, 72);
    assert.equal(worker.posted[0].settings.textLocale, "en-US");
    assert.equal(worker.posted[0].cascadePagination, true);
    assert.equal(worker.posted[0].cascadeFromPageIndex, 2);

    worker.emitMessage({
      id: 1,
      ok: true,
      layout: {
        pages: [1, 2],
      },
    });

    assert.deepEqual(await firstPromise, {
      pages: [1, 2],
    });

    const secondPromise = client.requestLayout({
      doc: {
        toJSON: () => ({
          type: "doc-2",
        }),
      },
      previousLayout: {
        pages: [9],
      },
      changeSummary: null,
      settings,
    });

    assert.equal(worker.posted[1].seedLayout, null);
    assert.deepEqual(worker.posted[1].workerDebug, {
      hadSeedLayout: true,
      sentSeedLayout: false,
      settingsChanged: false,
      prevPages: 1,
    });

    worker.emitMessage({
      id: 2,
      ok: false,
      error: "layout-failed",
    });

    await assert.rejects(secondPromise, /layout-failed/);

    const thirdPromise = client.requestLayout({
      doc: {
        toJSON: () => ({
          type: "doc-3",
        }),
      },
      previousLayout: {
        pages: [7],
      },
      changeSummary: null,
      settings: {
        ...settings,
        pageWidth: 901,
      },
    });

    assert.deepEqual(worker.posted[2].seedLayout, {
      pages: [7],
    });
    assert.deepEqual(worker.posted[2].workerDebug, {
      hadSeedLayout: false,
      sentSeedLayout: true,
      settingsChanged: true,
      prevPages: 1,
    });

    worker.emitMessage({
      id: 3,
      ok: true,
      layout: {
        pages: [3],
      },
    });

    assert.deepEqual(await thirdPromise, {
      pages: [3],
    });
    client.destroy();
    assert.equal(worker.terminated, true);
  } finally {
    if (OriginalWorker === undefined) {
      delete globalThis.Worker;
    } else {
      globalThis.Worker = OriginalWorker;
    }
  }
});

test("PaginationDocWorkerClient destroy rejects pending jobs and disables future requests", async () => {
  const OriginalWorker = globalThis.Worker;

  class FakeWorker {
    static instances = [];

    constructor() {
      this.posted = [];
      this.terminated = false;
      this.listeners = {
        message: [],
        error: [],
      };
      FakeWorker.instances.push(this);
    }

    addEventListener(type, listener) {
      this.listeners[type].push(listener);
    }

    postMessage(message) {
      this.posted.push(message);
    }

    terminate() {
      this.terminated = true;
    }
  }

  globalThis.Worker = FakeWorker;

  try {
    const client = new PaginationDocWorkerClient(new URL("file:///pagination-worker.js"));
    const worker = FakeWorker.instances[0];
    const pending = client.requestLayout({
      doc: {
        toJSON: () => ({
          type: "doc",
        }),
      },
      previousLayout: null,
      changeSummary: null,
      settings: {
        paginationWorker: {
          timeoutMs: 0,
        },
      },
    });

    client.destroy();

    await assert.rejects(pending, /worker-destroyed/);
    assert.equal(worker.terminated, true);
    await assert.rejects(
      client.requestLayout({
        doc: null,
        previousLayout: null,
        changeSummary: null,
        settings: null,
      }),
      /worker-unavailable/
    );
  } finally {
    if (OriginalWorker === undefined) {
      delete globalThis.Worker;
    } else {
      globalThis.Worker = OriginalWorker;
    }
  }
});
