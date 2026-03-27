import test from "node:test";
import assert from "node:assert/strict";

import { createSchema, Extension, ExtensionManager, Mark, Node } from "../src/index.ts";

test("ExtensionManager resolves nested extensions and preserves custom canvas/layout hooks", () => {
  const paragraphSelectionGeometry = {
    shouldComputeSelectionRects: () => true,
    shouldRenderBorderOnly: () => false,
    resolveSelectionRects: () => [{ left: 1, top: 2, width: 3, height: 4 }],
  };
  const extraSelectionGeometry = {
    shouldComputeSelectionRects: () => false,
    shouldRenderBorderOnly: () => true,
    resolveSelectionRects: () => [{ left: 9, top: 8, width: 7, height: 6 }],
  };

  const paragraphNodeView = () => "paragraph-node-view";
  const highlightAdapter = () => "highlight-adapter";
  const highlightAnnotation = () => ({ name: "highlight-annotation" });

  const paragraph = Node.create({
    name: "paragraph",
    priority: 200,
    group: "block",
    content: "text*",
    renderPreset: "paragraph-preset",
    layout() {
      return {
        renderer: "paragraph-renderer",
        pagination: {
          fragmentModel: "continuation",
        },
      };
    },
    canvas() {
      return {
        nodeViews: {
          paragraph: paragraphNodeView,
        },
        selectionGeometries: [paragraphSelectionGeometry],
        nodeSelectionTypes: ["paragraph", "shared"],
        decorationProviders: ["paragraph-decoration"],
        hitTestPolicies: ["paragraph-hit-test"],
      };
    },
    addNodeView() {
      return paragraphNodeView;
    },
  });

  const highlight = Mark.create({
    name: "highlight",
    priority: 250,
    inclusive: true,
    addMarkAdapter() {
      return highlightAdapter;
    },
    addMarkAnnotation() {
      return highlightAnnotation;
    },
  });

  const canvasExtra = Extension.create({
    name: "canvas-extra",
    priority: 25,
    canvas() {
      return {
        selectionGeometries: [extraSelectionGeometry],
        nodeSelectionTypes: ["shared", "custom"],
        decorationProviders: ["extra-decoration"],
        hitTestPolicies: ["extra-hit-test"],
      };
    },
  });

  const nested = Extension.create({
    name: "nested",
    priority: 150,
    addExtensions() {
      return [paragraph, highlight, canvasExtra];
    },
  });

  const root = Extension.create({
    name: "root",
    priority: 100,
    addExtensions() {
      return [nested];
    },
  });

  const tail = Extension.create({
    name: "tail",
    priority: 50,
  });

  const manager = new ExtensionManager([root, tail]);
  const structure = manager.resolveStructure();

  assert.deepEqual(
    manager.extensions.map((extension) => extension.name),
    ["highlight", "paragraph", "nested", "root", "tail", "canvas-extra"]
  );
  assert.deepEqual(
    structure.instances.map((instance) => instance.name),
    ["highlight", "paragraph", "nested", "root", "tail", "canvas-extra"]
  );

  assert.ok("paragraph" in structure.schema.nodes);
  assert.ok("highlight" in structure.schema.marks);
  assert.equal(structure.layout.byNodeName.get("paragraph")?.renderer, "paragraph-renderer");
  assert.deepEqual(structure.layout.byNodeName.get("paragraph")?.pagination, {
    fragmentModel: "continuation",
  });
  assert.equal(structure.layout.renderPresetsByNodeName.get("paragraph"), "paragraph-preset");
  assert.equal(structure.canvas.nodeViews.paragraph, paragraphNodeView);
  assert.equal(structure.canvas.markAdapters.highlight, highlightAdapter);
  assert.equal(structure.canvas.markAnnotationResolvers.highlight, highlightAnnotation);
  assert.deepEqual(structure.canvas.selectionGeometries, [
    paragraphSelectionGeometry,
    extraSelectionGeometry,
  ]);
  assert.deepEqual(structure.canvas.nodeSelectionTypes, ["paragraph", "shared", "custom"]);
  assert.deepEqual(structure.canvas.decorationProviders, [
    "paragraph-decoration",
    "extra-decoration",
  ]);
  assert.deepEqual(structure.canvas.hitTestPolicies, [
    "paragraph-hit-test",
    "extra-hit-test",
  ]);
});

test("ExtensionManager keeps dispatch and transform pipeline ordering stable by priority", () => {
  const dispatchLog = [];

  const high = Extension.create({
    name: "high",
    priority: 200,
    dispatchTransaction({ transaction, next }) {
      dispatchLog.push("high-before");
      next(transaction);
      dispatchLog.push("high-after");
    },
    transformPastedText(text) {
      return `${text}|high`;
    },
    transformCopiedHTML(html) {
      return `${html}|high`;
    },
  });

  const low = Extension.create({
    name: "low",
    priority: 100,
    dispatchTransaction({ transaction, next }) {
      dispatchLog.push("low-before");
      next(transaction);
      dispatchLog.push("low-after");
    },
    transformPastedText(text) {
      return `${text}|low`;
    },
    transformCopiedHTML(html) {
      return `${html}|low`;
    },
  });

  const manager = new ExtensionManager([low, high]);
  const dispatch = manager.dispatchTransaction(() => {
    dispatchLog.push("base-dispatch");
  });

  dispatch({ meta: "tx" });

  assert.deepEqual(dispatchLog, [
    "high-before",
    "low-before",
    "base-dispatch",
    "low-after",
    "high-after",
  ]);
  assert.equal(
    manager.transformPastedText((text) => `${text}|base`)("seed", true),
    "seed|base|high|low"
  );
  assert.equal(
    manager.transformCopiedHTML((html) => `${html}|base`)("<p>x</p>"),
    "<p>x</p>|base|high|low"
  );
});

test("ExtensionManager clipboard handlers prefer highest-priority non-null results and fall back to base", () => {
  const preferredParser = {
    parseSlice: () => "preferred-parser",
  };
  const preferredSerializer = {
    serializeFragment: () => "preferred-serializer",
  };

  const high = Extension.create({
    name: "high",
    priority: 300,
    clipboardTextSerializer() {
      return null;
    },
    clipboardTextParser() {
      return null;
    },
    clipboardParser() {
      return preferredParser;
    },
    clipboardSerializer() {
      return preferredSerializer;
    },
  });

  const low = Extension.create({
    name: "low",
    priority: 100,
    clipboardTextSerializer() {
      return "low-text";
    },
    clipboardTextParser(text, context, plain) {
      return {
        text,
        context,
        plain,
        source: "low",
      };
    },
  });

  const manager = new ExtensionManager([low, high]);
  const baseParser = {
    parseSlice: () => "base-parser",
  };
  const baseSerializer = {
    serializeFragment: () => "base-serializer",
  };

  assert.equal(manager.clipboardTextSerializer(() => "base-text")({}), "low-text");
  assert.deepEqual(
    manager.clipboardTextParser(() => "base-slice")("hello", { source: "ctx" }, true),
    {
      text: "hello",
      context: { source: "ctx" },
      plain: true,
      source: "low",
    }
  );
  assert.equal(manager.clipboardParser(baseParser), preferredParser);
  assert.equal(manager.clipboardSerializer(baseSerializer), preferredSerializer);

  const emptyManager = new ExtensionManager([
    Extension.create({
      name: "noop",
    }),
  ]);

  assert.equal(emptyManager.clipboardTextSerializer(() => "base-text")({}), "base-text");
  assert.equal(emptyManager.clipboardTextParser(() => "base-slice")("hello"), "base-slice");
  assert.equal(emptyManager.clipboardParser(baseParser), baseParser);
  assert.equal(emptyManager.clipboardSerializer(baseSerializer), baseSerializer);
});

test("Extendable configure and extend keep current option override and parent-linked storage semantics stable", () => {
  const base = Extension.create({
    name: "configurable",
    addOptions() {
      return {
        nested: {
          alpha: true,
        },
        mode: "base",
        label: "base",
      };
    },
    addStorage() {
      return {
        baseMode: this.options.mode,
        nestedSnapshot: { ...this.options.nested },
      };
    },
  });

  const child = base.extend({
    addOptions() {
      const parentOptions = this.parent?.() ?? {};

      return {
        ...parentOptions,
        nested: {
          ...(parentOptions.nested ?? {}),
          beta: true,
        },
        mode: "child",
      };
    },
    addStorage() {
      const parentStorage = this.parent?.() ?? {};

      return {
        ...parentStorage,
        mode: this.options.mode,
        nestedKeys: Object.keys(this.options.nested ?? {}).sort(),
      };
    },
  });

  const configured = child.configure({
    nested: {
      gamma: true,
    },
    label: "configured",
  });

  const manager = new ExtensionManager([configured]);
  const [instance] = manager.resolveStructure().instances;

  assert.deepEqual(instance.options, {
    nested: {
      gamma: true,
    },
    mode: "child",
    label: "configured",
  });
  assert.deepEqual(instance.storage, {
    baseMode: "child",
    nestedSnapshot: {
      gamma: true,
    },
    mode: "child",
    nestedKeys: ["gamma"],
  });
});

test("ExtensionManager schema resolution keeps local and global attributes wired into parse and render hooks", () => {
  const doc = Node.create({
    name: "doc",
    topNode: true,
    content: "paragraph*",
  });

  const text = Node.create({
    name: "text",
    group: "inline",
  });

  const paragraph = Node.create({
    name: "paragraph",
    group: "block",
    content: "text*",
    addAttributes() {
      return {
        dataId: {
          default: null,
          parseHTML: (element) => element.getAttribute?.("data-id") ?? undefined,
          renderHTML: (attributes) =>
            attributes.dataId
              ? {
                  "data-id": attributes.dataId,
                }
              : null,
        },
      };
    },
    parseHTML() {
      return [
        {
          tag: "p",
          getAttrs: () => ({
            role: "paragraph",
          }),
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        "p",
        {
          class: "paragraph-base",
          style: "font-weight:600",
          ...HTMLAttributes,
        },
        0,
      ];
    },
  });

  const highlight = Mark.create({
    name: "highlight",
    inclusive: true,
    addAttributes() {
      return {
        label: {
          default: null,
          parseHTML: (element) => element.getAttribute?.("data-label") ?? undefined,
          renderHTML: (attributes) =>
            attributes.label
              ? {
                  "data-label": attributes.label,
                }
              : null,
        },
      };
    },
    parseHTML() {
      return [
        {
          tag: "mark",
          getAttrs: () => ({
            source: "mark",
          }),
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        "mark",
        {
          class: "highlight-base",
          style: "background:yellow",
          ...HTMLAttributes,
        },
        0,
      ];
    },
  });

  const globalAttributes = Extension.create({
    name: "global-attributes",
    addGlobalAttributes() {
      return [
        {
          types: ["paragraph", "highlight"],
          attributes: {
            align: {
              default: "left",
              parseHTML: (element) => element.getAttribute?.("data-align") ?? undefined,
              renderHTML: (attributes) =>
                attributes.align
                  ? {
                      "data-align": attributes.align,
                      style: `text-align:${attributes.align}`,
                    }
                  : null,
            },
          },
        },
      ];
    },
  });

  const manager = new ExtensionManager([doc, text, paragraph, highlight, globalAttributes]);
  const structure = manager.resolveStructure();
  const schema = createSchema(structure);
  const paragraphSpec = structure.schema.nodes.paragraph;
  const highlightSpec = structure.schema.marks.highlight;
  const getParagraphAttrs = paragraphSpec.parseDOM?.[0]?.getAttrs;
  const getHighlightAttrs = highlightSpec.parseDOM?.[0]?.getAttrs;

  assert.ok(schema.nodes.paragraph);
  assert.ok(schema.marks.highlight);
  assert.deepEqual(Object.keys(paragraphSpec.attrs ?? {}).sort(), ["align", "dataId"]);
  assert.deepEqual(Object.keys(highlightSpec.attrs ?? {}).sort(), ["align", "label"]);
  assert.equal(typeof getParagraphAttrs, "function");
  assert.equal(typeof getHighlightAttrs, "function");
  assert.deepEqual(
    getParagraphAttrs({
      getAttribute: (name) =>
        ({
          "data-align": "center",
          "data-id": "node-1",
        })[name] ?? null,
    }),
    {
      align: "center",
      dataId: "node-1",
      role: "paragraph",
    }
  );
  assert.deepEqual(
    getHighlightAttrs({
      getAttribute: (name) =>
        ({
          "data-align": "right",
          "data-label": "note",
        })[name] ?? null,
    }),
    {
      align: "right",
      label: "note",
      source: "mark",
    }
  );
  assert.deepEqual(
    paragraphSpec.toDOM?.({
      attrs: {
        align: "center",
        dataId: "node-1",
      },
    }),
    [
      "p",
      {
        class: "paragraph-base",
        style: "font-weight:600;text-align:center",
        "data-id": "node-1",
        "data-align": "center",
      },
      0,
    ]
  );
  assert.deepEqual(
    highlightSpec.toDOM?.(
      {
        attrs: {
          align: "right",
          label: "note",
        },
      },
      true
    ),
    [
      "mark",
      {
        class: "highlight-base",
        style: "background:yellow;text-align:right",
        "data-label": "note",
        "data-align": "right",
      },
      0,
    ]
  );
});

test("ExtensionManager keeps runtime schema and nodeRegistry injection plus state resolution ordering stable", () => {
  const runtimeSchema = {
    kind: "schema",
  };
  const nodeRegistry = {
    kind: "node-registry",
  };
  const commandContextLog = [];
  const highSharedCommand = () => true;
  const lowSharedCommand = () => false;

  const high = Extension.create({
    name: "high",
    priority: 200,
    addStorage() {
      return {
        seesSchema: this.schema === runtimeSchema,
        seesNodeRegistry: this.nodeRegistry === nodeRegistry,
      };
    },
    addCommands() {
      commandContextLog.push({
        name: this.name,
        seesSchema: this.schema === runtimeSchema,
        seesNodeRegistry: this.nodeRegistry === nodeRegistry,
      });

      return {
        shared: highSharedCommand,
        highOnly: () => true,
      };
    },
    extendState() {
      return [
        (state) => ({
          ...state,
          order: [...(state.order ?? []), "high-1"],
        }),
        (state) => ({
          ...state,
          order: [...(state.order ?? []), "high-2"],
        }),
      ];
    },
  });

  const low = Extension.create({
    name: "low",
    priority: 100,
    addStorage() {
      return {
        seesSchema: this.schema === runtimeSchema,
        seesNodeRegistry: this.nodeRegistry === nodeRegistry,
      };
    },
    addCommands() {
      commandContextLog.push({
        name: this.name,
        seesSchema: this.schema === runtimeSchema,
        seesNodeRegistry: this.nodeRegistry === nodeRegistry,
      });

      return {
        shared: lowSharedCommand,
        lowOnly: () => true,
      };
    },
    extendState() {
      return (state) => ({
        ...state,
        order: [...(state.order ?? []), "low"],
      });
    },
  });

  const manager = new ExtensionManager([low, high]);
  manager.setRuntime({
    schema: runtimeSchema,
    nodeRegistry,
  });

  const structure = manager.resolveStructure();
  const state = manager.resolveState(structure);
  const reducedState = state.stateExtenders.reduce(
    (currentState, extendState) => extendState(currentState),
    {
      order: [],
    }
  );

  assert.deepEqual(
    structure.instances.map((instance) => ({
      name: instance.name,
      storage: instance.storage,
    })),
    [
      {
        name: "high",
        storage: {
          seesSchema: true,
          seesNodeRegistry: true,
        },
      },
      {
        name: "low",
        storage: {
          seesSchema: true,
          seesNodeRegistry: true,
        },
      },
    ]
  );
  assert.deepEqual(commandContextLog, [
    {
      name: "high",
      seesSchema: true,
      seesNodeRegistry: true,
    },
    {
      name: "low",
      seesSchema: true,
      seesNodeRegistry: true,
    },
  ]);
  assert.equal(state.commands.shared, highSharedCommand);
  assert.equal(typeof state.commands.highOnly, "function");
  assert.equal(typeof state.commands.lowOnly, "function");
  assert.deepEqual(reducedState.order, ["high-1", "high-2", "low"]);
});
