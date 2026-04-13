import { computed, defineComponent, h, onBeforeUnmount, onMounted, watch } from "vue";
import type { PropType, VNode } from "vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import {
  getPaginationData,
  getPlugins,
  getSchemaSummary,
  getStateSummary,
} from "./controller.js";
import {
  collapsedStateFormatSelection,
  expandedStateFormatSelection,
} from "./utils/format-selection-object.js";
import findNodeIn from "./utils/find-node.js";
import type {
  DevToolsController,
  DevToolsHistoryItem,
  DevToolsTabKey,
} from "./types.js";

const TAB_LABELS: Array<{ key: DevToolsTabKey; label: string }> = [
  { key: "state", label: "State" },
  { key: "history", label: "History" },
  { key: "plugins", label: "Plugins" },
  { key: "schema", label: "Schema" },
  { key: "structure", label: "Structure" },
  { key: "snapshots", label: "Snapshots" },
  { key: "pages", label: "Pages" },
];

const JsonBlock = defineComponent({
  name: "DevToolsJsonBlock",
  props: {
    value: {
      type: null as unknown as PropType<unknown>,
      required: true,
    },
  },
  setup(props) {
    const normalizeValue = (value: unknown): unknown => {
      const seen = new WeakMap<object, string>();

      const visit = (entry: unknown, path: string): unknown => {
        if (typeof entry === "bigint") {
          return `${entry}n`;
        }
        if (entry === undefined) {
          return "__undefined__";
        }
        if (typeof entry === "function") {
          return `[Function ${entry.name || "anonymous"}]`;
        }
        if (typeof entry === "symbol") {
          return entry.toString();
        }
        if (entry instanceof Date) {
          return Number.isNaN(entry.getTime()) ? "Invalid Date" : entry.toISOString();
        }
        if (entry instanceof Error) {
          return {
            name: entry.name,
            message: entry.message,
            stack: entry.stack ?? null,
          };
        }
        if (!entry || typeof entry !== "object") {
          return entry;
        }

        const existingPath = seen.get(entry);
        if (existingPath) {
          return `[Circular -> ${existingPath}]`;
        }
        seen.set(entry, path);

        if (Array.isArray(entry)) {
          return entry.map((item, index) => visit(item, `${path}[${index}]`));
        }

        return Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).map(([key, item]) => [
            key,
            visit(item, `${path}.${key}`),
          ]),
        );
      };

      return visit(value, "$");
    };

    const viewerData = computed(() => normalizeValue(props.value));

    return () =>
      h("div", { class: "lumenpage-dev-tools__json-viewer" }, [
        h(VueJsonPretty as any, {
          data: viewerData.value,
          theme: "dark",
          deep: 2,
          showLine: false,
          showLineNumber: false,
          showDoubleQuotes: false,
          showLength: true,
          showIcon: false,
          showKeyValueSpace: true,
          collapsedOnClickBrackets: true,
        }),
      ]);
  },
});

const SectionCard = defineComponent({
  name: "DevToolsSectionCard",
  props: {
    title: {
      type: String,
      required: true,
    },
  },
  setup(props, { slots }) {
    return () =>
      h("section", { class: "lumenpage-dev-tools__section" }, [
        h("div", { class: "lumenpage-dev-tools__section-header" }, props.title),
        h("div", { class: "lumenpage-dev-tools__section-body" }, slots.default?.()),
      ]);
  },
});

const HeadingRow = defineComponent({
  name: "DevToolsHeadingRow",
  props: {
    title: {
      type: String,
      required: true,
    },
    buttonLabel: {
      type: String,
      required: false,
    },
    onButtonClick: {
      type: Function as PropType<(() => void) | undefined>,
      required: false,
    },
  },
  setup(props) {
    return () =>
      h("div", { class: "lumenpage-dev-tools__heading-row" }, [
        h("h2", { class: "lumenpage-dev-tools__heading" }, props.title),
        props.buttonLabel
          ? h(
              "button",
              {
                class: "lumenpage-dev-tools__heading-button",
                onClick: props.onButtonClick,
              },
              props.buttonLabel,
            )
          : null,
      ]);
  },
});

const MetaGrid = defineComponent({
  name: "DevToolsMetaGrid",
  props: {
    items: {
      type: Array as PropType<Array<{ key: string; value: unknown }>>,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h(
        "div",
        { class: "lumenpage-dev-tools__meta" },
        props.items.map((item) =>
          h("div", { class: "lumenpage-dev-tools__meta-card", key: item.key }, [
            h("div", { class: "lumenpage-dev-tools__meta-key" }, item.key),
            h("div", { class: "lumenpage-dev-tools__meta-value" }, String(item.value)),
          ]),
        ),
      );
  },
});

function toViewerPath(path: Array<string | number>): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") {
      return `${result}[${segment}]`;
    }
    return `${result}.${segment}`;
  }, "root");
}

function isPathPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

function getValueAtViewerPath(source: unknown, path: string) {
  const relativePath = path.replace(/^root/, "");
  if (!relativePath) {
    return source;
  }

  const segments = Array.from(
    relativePath.matchAll(/\.([A-Za-z_$][\w$]*)|\[(\d+)\]/g),
    (match) => match[1] ?? Number(match[2]),
  );

  return segments.reduce<any>((current, segment) => current?.[segment as any], source as any);
}

function getNodeAtViewerPath(doc: any, path: string) {
  const relativePath = path.replace(/^root/, "");
  if (!relativePath) {
    return doc;
  }

  const segments = Array.from(
    relativePath.matchAll(/\.([A-Za-z_$][\w$]*)|\[(\d+)\]/g),
    (match) => match[1] ?? Number(match[2]),
  );

  let currentNode = doc;
  let lastResolvedNode = doc;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === "content" && typeof segments[index + 1] === "number") {
      const childIndex = segments[index + 1] as number;
      const nextNode = currentNode?.child?.(childIndex);
      if (!nextNode) {
        break;
      }
      currentNode = nextNode;
      lastResolvedNode = nextNode;
      index += 1;
      continue;
    }

    if (segment === "attrs" || segment === "marks" || segment === "text" || segment === "type") {
      break;
    }
  }

  return lastResolvedNode;
}

const DocJsonTree = defineComponent({
  name: "DevToolsDocJsonTree",
  props: {
    docNode: {
      type: null as unknown as PropType<any>,
      required: true,
    },
    data: {
      type: Object as PropType<Record<string, unknown>>,
      required: true,
    },
    selectedNodePath: {
      type: String,
      required: false,
      default: "",
    },
    onSelectNode: {
      type: Function as PropType<(node: any) => void>,
      required: false,
    },
  },
  setup(props) {
    const pathCollapsible = (node: { path: string; level: number }) => {
      if (!props.selectedNodePath) {
        return node.level > 1;
      }

      if (node.path === "root" || isPathPrefix(props.selectedNodePath, node.path)) {
        return false;
      }

      return node.level > 0;
    };

    const renderNodeActions = ({ node }: { node: { path: string } }) =>
      h(
        "button",
        {
          class: "lumenpage-dev-tools__json-action",
          onClick: (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            console.log(getValueAtViewerPath(props.data, node.path));
          },
        },
        "log",
      );

    return () =>
      h("div", { class: "lumenpage-dev-tools__json-viewer" }, [
        h(VueJsonPretty as any, {
          data: props.data,
          theme: "dark",
          deep: Number.MAX_SAFE_INTEGER,
          showLine: false,
          showLineNumber: false,
          showDoubleQuotes: false,
          showLength: true,
          showIcon: true,
          showKeyValueSpace: true,
          collapsedOnClickBrackets: true,
          highlightSelectedNode: true,
          selectedValue: props.selectedNodePath || undefined,
          pathCollapsible,
          renderNodeActions,
          onNodeClick: (node: { path: string }) => {
            const pmNode = getNodeAtViewerPath(props.docNode, node.path);
            if (pmNode && props.onSelectNode) {
              props.onSelectNode(pmNode);
            }
          },
        }),
      ]);
  },
});

const SCHEMA_IGNORE_FIELDS = new Set(["schema", "contentExpr", "parseDOM", "toDOM"]);

const SchemaJsonTree = defineComponent({
  name: "DevToolsSchemaJsonTree",
  props: {
    data: {
      type: null as unknown as PropType<unknown>,
      required: true,
    },
  },
  setup(props) {
    const normalizeSchemaValue = (value: unknown): unknown => {
      const seen = new WeakMap<object, string>();

      const visit = (entry: unknown, path: string): unknown => {
        if (entry === undefined) {
          return "__undefined__";
        }
        if (entry === null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
          return entry;
        }
        if (typeof entry === "function") {
          return `[Function ${entry.name || "anonymous"}]`;
        }
        if (typeof entry === "symbol") {
          return entry.toString();
        }
        if (!entry || typeof entry !== "object") {
          return String(entry);
        }

        const existingPath = seen.get(entry);
        if (existingPath) {
          return `[Circular -> ${existingPath}]`;
        }
        seen.set(entry, path);

        if (Array.isArray(entry)) {
          return entry.map((item, index) => visit(item, `${path}[${index}]`));
        }

        const output: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(entry as Record<string, unknown>)) {
          if (SCHEMA_IGNORE_FIELDS.has(key)) {
            continue;
          }
          output[key] = visit(item, `${path}.${key}`);
        }
        return output;
      };

      return visit(value, "$");
    };

    const viewerData = computed(() => normalizeSchemaValue(props.data));
    const pathCollapsible = (node: { level: number }) => node.level > 1;

    return () =>
      h("div", { class: "lumenpage-dev-tools__json-viewer" }, [
        h(VueJsonPretty as any, {
          data: viewerData.value,
          theme: "dark",
          deep: Number.MAX_SAFE_INTEGER,
          showLine: false,
          showLineNumber: false,
          showDoubleQuotes: false,
          showLength: true,
          showIcon: true,
          showKeyValueSpace: true,
          collapsedOnClickBrackets: true,
          pathCollapsible,
        }),
      ]);
  },
});

const HIGHLIGHT_REGEXP = /(&lt;\/?[\w\d\s="'-:/.]+&gt;)/gim;

function highlightMarkup(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      HIGHLIGHT_REGEXP,
      "<span class=\"lumenpage-dev-tools__highlighter-tag\">$&</span>",
    );
}

const Highlighter = defineComponent({
  name: "DevToolsHighlighter",
  props: {
    text: {
      type: String,
      required: false,
      default: "",
    },
  },
  setup(props) {
    const html = computed(() => highlightMarkup(props.text || ""));
    return () =>
      props.text
        ? h("pre", {
            class: "lumenpage-dev-tools__highlighter",
            innerHTML: html.value,
          })
        : null;
  },
});

function postprocessDiffValue(value: Record<string, any>) {
  if (value && value._t === "a") {
    const result: Record<string, any> = {};
    for (const key in value) {
      if (key === "_t") {
        continue;
      }
      if (key[0] === "_" && !value[key.substring(1)]) {
        result[key.substring(1)] = value[key];
      } else if (value[`_${key}`]) {
        result[key] = [value[`_${key}`][0], value[key][0]];
      } else if (key[0] !== "_") {
        result[key] = value[key];
      }
    }
    return result;
  }
  return value;
}

function stringifyAndShrink(value: object | null) {
  if (value === null) {
    return "null";
  }
  const serialized = JSON.stringify(value);
  if (typeof serialized === "undefined") {
    return "undefined";
  }
  return serialized.length > 22
    ? `${serialized.slice(0, 15)}...${serialized.slice(-5)}`
    : serialized;
}

function getDiffValueString(value: string | object | null) {
  if (typeof value === "string") {
    return value;
  }
  return stringifyAndShrink(value);
}

function replaceSpacesWithNonBreakingSpace(value: string) {
  return value.replace(/\s/gm, "\u00A0");
}

function parseTextDiff(textDiff: string) {
  return textDiff
    .split(/\n/gm)
    .slice(1)
    .map((line) => {
      const type = line.startsWith("-")
        ? "delete"
        : line.startsWith("+")
          ? "add"
          : "raw";
      return { type, value: replaceSpacesWithNonBreakingSpace(line.slice(1)) };
    });
}

const JsonDiff = defineComponent({
  name: "DevToolsJsonDiff",
  props: {
    delta: {
      type: null as unknown as PropType<any>,
      required: true,
    },
  },
  setup(props) {
    const renderDiffValue = (value: any): VNode => {
      if (Array.isArray(value)) {
        if (value.length === 1) {
          return h("span", { class: "lumenpage-dev-tools__diff-added" }, getDiffValueString(value[0]));
        }

        if (value.length === 2) {
          return h("span", { class: "lumenpage-dev-tools__diff-updated" }, [
            h("span", { class: "lumenpage-dev-tools__diff-deleted" }, getDiffValueString(value[0])),
            " => ",
            h("span", { class: "lumenpage-dev-tools__diff-added" }, getDiffValueString(value[1])),
          ]);
        }

        if (value.length === 3 && value[1] === 0 && value[2] === 0) {
          return h("span", { class: "lumenpage-dev-tools__diff-deleted" }, getDiffValueString(value[0]));
        }

        if (value.length === 3 && value[2] === 2) {
          return h("span", { class: "lumenpage-dev-tools__diff-updated" }, [
            '"',
            ...parseTextDiff(value[0]).map((part, index) =>
              h(
                "span",
                {
                  key: `${part.type}-${index}`,
                  class:
                    part.type === "delete"
                      ? "lumenpage-dev-tools__diff-deleted"
                      : part.type === "add"
                        ? "lumenpage-dev-tools__diff-added"
                        : "lumenpage-dev-tools__diff-raw",
                },
                part.value,
              ),
            ),
            '"',
          ]);
        }
      }

      if (value && typeof value === "object") {
        return renderDiffObject(postprocessDiffValue(value));
      }

      return h("span", { class: "lumenpage-dev-tools__diff-raw" }, String(value));
    };

    const renderDiffObject = (value: Record<string, any>): VNode => {
      const entries = Object.entries(value ?? {});
      return h("div", { class: "lumenpage-dev-tools__diff-tree" }, [
        h("div", { class: "lumenpage-dev-tools__diff-brace" }, "{"),
        h(
          "div",
          { class: "lumenpage-dev-tools__diff-children" },
          entries.map(([key, child]) =>
            h("div", { class: "lumenpage-dev-tools__diff-row", key }, [
              h("span", { class: "lumenpage-dev-tools__diff-key" }, key),
              h("span", { class: "lumenpage-dev-tools__diff-colon" }, ": "),
              renderDiffValue(child),
            ]),
          ),
        ),
        h("div", { class: "lumenpage-dev-tools__diff-brace" }, "}"),
      ]);
    };

    return () =>
      props.delta ? renderDiffValue(props.delta) : h("div", { class: "lumenpage-dev-tools__muted" }, "No diff");
  },
});

const GRAPH_NODE_COLORS = [
  "#F38BA8",
  "#74C7EC",
  "#A6E3A1",
  "#CA9EDB",
  "#DCDC5D",
  "#B9CC7C",
  "#FAB387",
  "#89B4FA",
  "#F36E98",
  "#E45F44",
  "#DD97D8",
  "#A6A4AE",
  "#F9E2AF",
  "#FFC129",
  "#EBA0AC",
  "#89DCEB",
  "#B4BEFE",
];

function buildNodeColors(schema: any) {
  const names = Object.keys(schema?.nodes ?? {});
  return names.reduce<Record<string, string>>((acc, name, index) => {
    acc[name] = GRAPH_NODE_COLORS[index % GRAPH_NODE_COLORS.length];
    return acc;
  }, {});
}

function getMarksText(node: any) {
  const marks = node?.marks ?? [];
  return marks.length === 1
    ? ` - [${marks[0].type.name}]`
    : marks.length > 1
      ? ` - [${marks.length} marks]`
      : "";
}

const StructureNodeView = defineComponent({
  name: "StructureNodeView",
  props: {
    node: {
      type: null as unknown as PropType<any>,
      required: true,
    },
    startPos: {
      type: Number,
      required: true,
    },
    colors: {
      type: Object as PropType<Record<string, string>>,
      required: true,
    },
    onSelect: {
      type: Function as PropType<(node: any) => void>,
      required: true,
    },
  },
  setup(props) {
    const renderInlineNode = (node: any, startPos: number, index: number) =>
      h(
        "div",
        {
          class: ["lumenpage-dev-tools__graph-row", "lumenpage-dev-tools__graph-row--inline"],
          style: { background: props.colors[node.type.name] },
          onClick: () => props.onSelect(node),
        },
        [
          index === 0
            ? h(
                "div",
                {
                  class: "lumenpage-dev-tools__graph-side",
                  title: `Pos: ${startPos} (before ${node.type.name} opening tag)`,
                },
                String(startPos),
              )
            : null,
          h(
            "div",
            { class: "lumenpage-dev-tools__graph-center" },
            `${node.type.name}${getMarksText(node)}`,
          ),
          h("div", { class: "lumenpage-dev-tools__graph-bar" }),
          h(
            "div",
            {
              class: "lumenpage-dev-tools__graph-side",
              title: `Pos: ${startPos + node.nodeSize} (before ${node.type.name} closing tag)`,
            },
            String(startPos + node.nodeSize),
          ),
        ],
      );

    const renderContent = (node: any, startPos: number): any => {
      const content = node?.content?.content ?? [];
      if (!content.length) {
        return null;
      }
      if (content[0].isBlock) {
        let childPos = startPos + 1;
        return h(
          "div",
          { class: "lumenpage-dev-tools__graph-block-content" },
          content.map((child: any, index: number) => {
            const currentPos = childPos;
            childPos += child.nodeSize;
            return h(StructureNodeView, {
              key: `${child.type.name}-${index}-${currentPos}`,
              node: child,
              startPos: currentPos,
              colors: props.colors,
              onSelect: props.onSelect,
            });
          }),
        );
      }

      let childPos = startPos;
      return h(
        "div",
        { class: "lumenpage-dev-tools__graph-inline-content" },
        content.map((child: any, index: number) => {
          const currentPos = childPos;
          childPos += child.nodeSize;
          return renderInlineNode(child, currentPos, index);
        }),
      );
    };

    return () =>
      h("div", null, [
        h(
          "div",
          {
            class: "lumenpage-dev-tools__graph-row",
            style: { background: props.colors[props.node.type.name] },
            onClick: () => props.onSelect(props.node),
          },
          [
            props.startPos > 0
              ? h(
                  "div",
                  {
                    class: "lumenpage-dev-tools__graph-side",
                    title: `Pos: ${props.startPos - 1} (before ${props.node.type.name} opening tag)`,
                  },
                  String(props.startPos - 1),
                )
              : null,
            h(
              "div",
              { class: "lumenpage-dev-tools__graph-start" },
              `${props.node.type.name}${getMarksText(props.node)}`,
            ),
            h(
              "div",
              {
                class: "lumenpage-dev-tools__graph-side",
                title: `Pos: ${props.startPos} (after ${props.node.type.name} opening tag)`,
              },
              String(props.startPos),
            ),
            h("div", { class: "lumenpage-dev-tools__graph-bar" }),
            h(
              "div",
              {
                class: "lumenpage-dev-tools__graph-side",
                title: `Pos: ${props.startPos + props.node.nodeSize - 1} (after ${props.node.type.name} closing tag)`,
              },
              String(props.startPos + props.node.nodeSize - 1),
            ),
          ],
        ),
        renderContent(props.node, props.startPos),
      ]);
  },
});

function renderEmpty(message: string) {
  return h("div", { class: "lumenpage-dev-tools__empty" }, message);
}

function renderStateTab(controller: DevToolsController) {
  const state = controller.editorState.value;
  if (!state) {
    return renderEmpty("No editor state available.");
  }

  const summary = getStateSummary(state);
  const docJson = state.doc.toJSON() as Record<string, unknown>;
  const selectedPath = controller.selectedStructureNode.value
    ? toViewerPath(findNodeIn(state.doc as any, controller.selectedStructureNode.value) ?? [])
    : "";
  const selectionData = controller.selectionExpanded.value
    ? expandedStateFormatSelection(state.selection)
    : collapsedStateFormatSelection(state.selection);

  return h("div", { class: "lumenpage-dev-tools__split" }, [
    h("div", { class: "lumenpage-dev-tools__split-right", style: "border-left:none; flex-basis: calc(100% - 220px);" }, [
      h("div", { class: "lumenpage-dev-tools__stack" }, [
        h("div", { class: "lumenpage-dev-tools__section" }, [
          h(HeadingRow, {
            title: "Current Doc",
            buttonLabel: "Log State",
            onButtonClick: () => console.log(state),
          }),
          h("div", { class: "lumenpage-dev-tools__section-body" }, [
            h(DocJsonTree, {
              docNode: state.doc,
              data: docJson,
              selectedNodePath: selectedPath,
              onSelectNode: (node: any) => {
                controller.selectedStructureNode.value = node;
              },
            }),
          ]),
        ]),
      ]),
    ]),
    h("div", { class: "lumenpage-dev-tools__split-right", style: "flex-basis: 220px; flex-grow:0;" }, [
      h("div", { class: "lumenpage-dev-tools__stack" }, [
        h("div", { class: "lumenpage-dev-tools__section" }, [
          h(HeadingRow, {
            title: "Selection",
            buttonLabel: controller.selectionExpanded.value ? "Collapse" : "Expand",
            onButtonClick: () => {
              controller.selectionExpanded.value = !controller.selectionExpanded.value;
            },
          }),
          h(JsonBlock, { value: selectionData }),
        ]),
        h("div", { class: "lumenpage-dev-tools__section" }, [
          h(HeadingRow, { title: "Active Marks" }),
          summary.activeMarks.length
            ? h(JsonBlock, { value: summary.activeMarks })
            : h("div", { class: "lumenpage-dev-tools__group" }, [
                h("div", { class: "lumenpage-dev-tools__group-row" }, [
                  h("span", { class: "lumenpage-dev-tools__group-key" }, "no active marks"),
                ]),
              ]),
        ]),
        h("div", { class: "lumenpage-dev-tools__section" }, [
          h(HeadingRow, { title: "Document Stats" }),
          h("div", { class: "lumenpage-dev-tools__group" }, [
            h("div", { class: "lumenpage-dev-tools__group-row" }, [
              h("span", { class: "lumenpage-dev-tools__group-key" }, "nodeSize:"),
              h("span", { class: "lumenpage-dev-tools__group-value" }, String(state.doc.nodeSize)),
            ]),
            h("div", { class: "lumenpage-dev-tools__group-row" }, [
              h("span", { class: "lumenpage-dev-tools__group-key" }, "childCount:"),
              h("span", { class: "lumenpage-dev-tools__group-value" }, String(state.doc.childCount)),
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return (
    date.toLocaleTimeString(undefined, { hour12: false }) +
    `.${String(date.getMilliseconds()).padStart(3, "0")}`
  );
}

function renderHistoryTab(controller: DevToolsController) {
  const history = controller.history.value;
  if (!history.length) {
    return renderEmpty("No history entries yet.");
  }

  const selectedItem =
    history[controller.selectedHistoryIndex.value] ?? history[0];
  const selectedDiff = controller.historyDiffs.value[selectedItem.id];
  const historyList = history.reduce<Array<DevToolsHistoryItem | DevToolsHistoryItem[]>>(
    (acc, item) => {
      const pending = !controller.historyDiffs.value[item.id]?.diff;
      const last = acc[acc.length - 1];
      if (pending) {
        if (Array.isArray(last)) {
          last.push(item);
        } else {
          acc.push([item]);
        }
      } else {
        acc.push(item);
      }
      return acc;
    },
    [],
  );

  return h("div", { class: "lumenpage-dev-tools__split" }, [
    h(
      "div",
      { class: "lumenpage-dev-tools__split-left" },
      h("div", { class: "lumenpage-dev-tools__list" }, [
        ...historyList.map((entry) => {
          if (Array.isArray(entry)) {
            const head = entry[0];
            return [
              h(
                "div",
                {
                  class: "lumenpage-dev-tools__list-item",
                  key: `group-${head.id}`,
                },
                `${formatTime(head.timestamp)} [${entry.length}]`,
              ),
              ...entry.map((item) => {
                const index = history.findIndex((candidate) => candidate.id === item.id);
                return h(
                  "button",
                  {
                    class: [
                      "lumenpage-dev-tools__list-item",
                      "lumenpage-dev-tools__list-item--nested",
                      index === controller.selectedHistoryIndex.value
                        ? "lumenpage-dev-tools__list-item--active"
                        : index === controller.selectedHistoryIndex.value + 1
                          ? "lumenpage-dev-tools__list-item--previous"
                          : "",
                    ],
                    key: item.id,
                    onClick: () => {
                      controller.selectedHistoryIndex.value = index;
                    },
                    onDblclick: () => controller.rollbackHistory(item, index),
                  },
                  formatTime(item.timestamp),
                );
              }),
            ];
          }
          const index = history.findIndex((candidate) => candidate.id === entry.id);
          return h(
            "button",
            {
              class: [
                "lumenpage-dev-tools__list-item",
                index === controller.selectedHistoryIndex.value
                  ? "lumenpage-dev-tools__list-item--active"
                  : index === controller.selectedHistoryIndex.value + 1
                    ? "lumenpage-dev-tools__list-item--previous"
                    : "",
              ],
              key: entry.id,
              onClick: () => {
                controller.selectedHistoryIndex.value = index;
              },
              onDblclick: () => controller.rollbackHistory(entry, index),
            },
            formatTime(entry.timestamp),
          );
        }).flat(),
      ]),
    ),
    h("div", { class: "lumenpage-dev-tools__split-right" }, [
      h(SectionCard, { title: "Doc Diff" }, () =>
        selectedDiff?.pending
          ? h("div", { class: "lumenpage-dev-tools__muted" }, "Computing diff...")
          : selectedDiff?.diff
            ? h(JsonDiff, { delta: selectedDiff.diff })
            : h("div", { class: "lumenpage-dev-tools__muted" }, "Docs are equal."),
      ),
      h(SectionCard, { title: "Selection Diff" }, () =>
        selectedDiff?.pending
          ? h("div", { class: "lumenpage-dev-tools__muted" }, "Computing diff...")
          : selectedDiff?.selection
            ? h(JsonDiff, { delta: selectedDiff.selection })
            : h("div", { class: "lumenpage-dev-tools__muted" }, "Selection is unchanged."),
      ),
      h(SectionCard, { title: "Selection Content" }, () =>
        selectedItem.selectionContent
          ? h(Highlighter, { text: selectedItem.selectionContent })
          : h("div", { class: "lumenpage-dev-tools__muted" }, "(empty)"),
      ),
    ]),
  ]);
}

function renderPluginsTab(controller: DevToolsController) {
  const state = controller.editorState.value;
  if (!state) {
    return renderEmpty("No editor state available.");
  }

  const plugins = getPlugins(state, controller.pluginSearch.value).sort((a, b) => {
    if (controller.pluginSortAsc.value) {
      return a.key.localeCompare(b.key);
    }
    return b.key.localeCompare(a.key);
  });
  const selected =
    plugins.find((item) => item.key === controller.selectedPluginKey.value) ??
    plugins[0] ??
    null;

  if (selected && controller.selectedPluginKey.value !== selected.key) {
    controller.selectedPluginKey.value = selected.key;
  }

  return h("div", { class: "lumenpage-dev-tools__split" }, [
    h("div", { class: "lumenpage-dev-tools__split-left" }, [
      h("div", { class: "lumenpage-dev-tools__toolbar" }, [
        h("input", {
          class: "lumenpage-dev-tools__input",
          value: controller.pluginSearch.value,
          placeholder: "Search plugin key",
          onInput: (event: Event) => {
            controller.pluginSearch.value = (event.target as HTMLInputElement).value;
          },
        }),
        h(
          "button",
          {
            class: "lumenpage-dev-tools__toolbar-button",
            onClick: () => {
              controller.pluginSortAsc.value = !controller.pluginSortAsc.value;
            },
          },
          controller.pluginSortAsc.value ? "SORT DES" : "SORT ASC",
        ),
      ]),
      h(
        "div",
        { class: "lumenpage-dev-tools__list" },
        plugins.map((item) =>
          h(
            "button",
            {
              class: [
                "lumenpage-dev-tools__list-item",
                selected?.key === item.key
                  ? "lumenpage-dev-tools__list-item--active"
                  : "",
                item.hasState ? "" : "lumenpage-dev-tools__list-item--muted",
              ],
              key: item.key,
              onClick: () => {
                controller.selectedPluginKey.value = item.key;
              },
            },
            [
              h("div", null, item.key),
              h(
                "div",
                { class: "lumenpage-dev-tools__muted" },
                item.hasState ? "has state" : "no state",
              ),
            ],
          ),
        ),
      ),
    ]),
    h("div", { class: "lumenpage-dev-tools__split-right" }, [
      selected
        ? h("div", { class: "lumenpage-dev-tools__stack" }, [
            h(SectionCard, { title: "Plugin State" }, () =>
              h(JsonBlock, { value: selected.state }),
            ),
          ])
        : renderEmpty("No plugin matched the current filter."),
    ]),
  ]);
}

function renderSchemaTab(controller: DevToolsController) {
  const state = controller.editorState.value;
  if (!state) {
    return renderEmpty("No editor state available.");
  }
  const schema = getSchemaSummary(state);
  return h("div", { class: "lumenpage-dev-tools__split" }, [
    h("div", { class: "lumenpage-dev-tools__split-right", style: "border-left:none;" }, [
      h(SectionCard, { title: "Nodes" }, () => h(SchemaJsonTree, { data: schema.nodes ?? {} })),
    ]),
    h("div", { class: "lumenpage-dev-tools__split-right" }, [
      h(SectionCard, { title: "Marks" }, () => h(SchemaJsonTree, { data: schema.marks ?? {} })),
    ]),
  ]);
}

function renderStructureTab(controller: DevToolsController) {
  const state = controller.editorState.value;
  if (!state) {
    return renderEmpty("No editor state available.");
  }
  const selectedNode = controller.selectedStructureNode.value || state.doc;
  const colors = buildNodeColors(state.schema);
  return h("div", { class: "lumenpage-dev-tools__split" }, [
    h("div", { class: "lumenpage-dev-tools__split-right", style: "border-left:none; flex-basis: calc(100% - 240px);" }, [
      h("div", { class: "lumenpage-dev-tools__section" }, [
        h(HeadingRow, { title: "Current Doc" }),
        h("div", { class: "lumenpage-dev-tools__graph" }, [
          h(StructureNodeView, {
            node: state.doc,
            startPos: 0,
            colors,
            onSelect: (node: any) => {
              controller.selectedStructureNode.value = node;
            },
          }),
        ]),
      ]),
    ]),
    h("div", { class: "lumenpage-dev-tools__split-right", style: "flex-basis: 240px; flex-grow:0;" }, [
      h("div", { class: "lumenpage-dev-tools__section" }, [
        h(HeadingRow, {
          title: "Node Info",
          buttonLabel: "Log Node",
          onButtonClick: () => console.log(selectedNode),
        }),
        h(JsonBlock, { value: selectedNode?.toJSON?.() ?? selectedNode }),
      ]),
    ]),
  ]);
}

function renderSnapshotsTab(controller: DevToolsController) {
  const items = controller.snapshots.value;
  return h("div", { class: "lumenpage-dev-tools__split" }, [
    h("div", { class: "lumenpage-dev-tools__split-left", style: "flex-grow:1;" }, [
      items.length
        ? h(
            "div",
            { class: "lumenpage-dev-tools__list" },
            items.map((snapshot) =>
              h("div", { class: "lumenpage-dev-tools__list-item", key: snapshot.id }, [
                h("div", { class: "lumenpage-dev-tools__snapshot-row" }, [
                  h("div", { class: "lumenpage-dev-tools__snapshot-title" }, snapshot.name),
                  h("div", null, [
                    h(
                      "button",
                      {
                        class: "lumenpage-dev-tools__action-button",
                        onClick: () => controller.deleteSnapshot(snapshot.id),
                      },
                      "delete",
                    ),
                    h(
                      "button",
                      {
                        class: "lumenpage-dev-tools__action-button",
                        onClick: () => controller.loadSnapshot(snapshot),
                      },
                      "restore",
                    ),
                  ]),
                ]),
              ]),
            ),
          )
        : renderEmpty("No saved snapshots yet. Press \"Save Snapshot\" button to add one."),
    ]),
  ]);
}

function renderPagesTab(controller: DevToolsController) {
  const pages = getPaginationData(controller.editorView);
  if (!pages) {
    return renderEmpty("Pagination info is unavailable.");
  }
  const summary = {
    pageCount: pages.pageCount ?? 0,
    totalHeight: pages.totalHeight ?? 0,
    pageWidth: pages.pageWidth ?? 0,
    pageHeight: pages.pageHeight ?? 0,
    pageGap: pages.pageGap ?? 0,
    margin: pages.margin ?? null,
    scrollTop: pages.scrollTop ?? 0,
    viewportHeight: pages.viewportHeight ?? 0,
    visibleRange: pages.visibleRange ?? null,
  };
  return [
    h(SectionCard, { title: "Summary" }, () => h(JsonBlock, { value: summary })),
    h(SectionCard, { title: "Pages" }, () =>
      h(JsonBlock, { value: pages.pages ?? [] }),
    ),
  ];
}

export const DevToolsApp = defineComponent({
  name: "LumenpageDevToolsApp",
  props: {
    controller: {
      type: Object as PropType<DevToolsController>,
      required: true,
    },
  },
  setup(props) {
    const syncHtmlMargin = (isOpen: boolean) => {
      if (typeof document === "undefined") {
        return;
      }
      document.documentElement.style.marginBottom = isOpen ? "50vh" : "";
    };

    onMounted(() => {
      syncHtmlMargin(props.controller.isOpen.value);
    });

    watch(
      () => props.controller.isOpen.value,
      (value) => {
        syncHtmlMargin(value);
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      syncHtmlMargin(false);
    });

    const subtitle = computed(() => {
      const state = props.controller.editorState.value;
      if (!state) {
        return "No editor state";
      }
      return `docSize=${state.doc.content.size} selection=${state.selection.from}->${state.selection.to}`;
    });

    const renderTabContent = () => {
      switch (props.controller.activeTab.value) {
        case "state":
          return renderStateTab(props.controller);
        case "history":
          return renderHistoryTab(props.controller);
        case "plugins":
          return renderPluginsTab(props.controller);
        case "schema":
          return renderSchemaTab(props.controller);
        case "structure":
          return renderStructureTab(props.controller);
        case "snapshots":
          return renderSnapshotsTab(props.controller);
        case "pages":
          return renderPagesTab(props.controller);
        default:
          return renderEmpty("Unknown tab.");
      }
    };

    return () =>
      h("div", { class: "lumenpage-dev-tools" }, [
        props.controller.isOpen.value
          ? h("div", { class: "lumenpage-dev-tools__shell" }, [
              h(
                "button",
                {
                  class: "lumenpage-dev-tools__save-snapshot",
                  onClick: () => props.controller.saveSnapshot(),
                },
                "Save snapshots",
              ),
              h(
                "button",
                {
                  class: "lumenpage-dev-tools__close",
                  onClick: () => props.controller.close(),
                  title: subtitle.value,
                },
                "×",
              ),
              h(
                "div",
                { class: "lumenpage-dev-tools__tabs" },
                TAB_LABELS.map((tab) =>
                  h(
                    "button",
                    {
                      class: [
                        "lumenpage-dev-tools__tab",
                        props.controller.activeTab.value === tab.key
                          ? "lumenpage-dev-tools__tab--active"
                          : "",
                      ],
                      key: tab.key,
                      onClick: () => {
                        props.controller.activeTab.value = tab.key;
                      },
                    },
                    tab.label,
                  ),
                ),
              ),
              h("div", { class: "lumenpage-dev-tools__content" }, [
                h(
                  "div",
                  { class: "lumenpage-dev-tools__content-body" },
                  renderTabContent(),
                ),
              ]),
            ])
          : h(
              "button",
              {
                class: "lumenpage-dev-tools__button",
                onClick: () => props.controller.open(),
                title: subtitle.value,
              },
              h("svg", {
                width: "530",
                height: "530",
                viewBox: "0 0 530 530",
                xmlns: "http://www.w3.org/2000/svg",
                innerHTML:
                  '<title>prosemirror</title><path d="M265 116c-81.157 0-147 65.843-147 147s65.843 147 147 147 147-65.843 147-147-65.988-147-147-147z" fill="#FFF"/><path d="M387.202 159.411c0-26.752 16.476-47.82 41.238-62.306-4.488-14.894-10.38-29.2-17.648-42.64-27.772 7.266-50.24-3.598-69.136-22.52-18.898-18.874-24.688-41.344-17.418-69.142A222.724 222.724 0 0 0 281.598 0c-14.486 24.74-40.678 41.188-67.38 41.188-26.726 0-52.892-16.45-67.404-41.188A221.776 221.776 0 0 0 104.2 17.624c7.268 27.8 1.506 50.268-17.442 69.14-18.872 18.924-41.34 29.788-69.138 22.52A224.356 224.356 0 0 0 0 151.926c24.738 14.486 41.186 35.554 41.186 62.306 0 26.704-16.448 52.892-41.186 67.404a226.676 226.676 0 0 0 17.62 42.642c27.798-7.268 50.266-1.504 69.138 17.394 18.896 18.924 24.71 41.392 17.442 69.14a225.306 225.306 0 0 0 42.64 17.674c14.486-24.814 40.678-41.238 67.404-41.238 26.702 0 52.894 16.45 67.402 41.238a228.44 228.44 0 0 0 42.64-17.674c-7.268-27.748-1.504-50.216 17.418-69.14 18.896-18.874 41.364-29.738 69.136-22.52a224.686 224.686 0 0 0 17.646-42.642c-24.812-14.512-41.288-35.58-41.288-62.282z" fill="#FFF" opacity=".92"/><circle cx="214.2" cy="214.2" r="20.4" fill="#363755"/><circle cx="295.8" cy="214" r="17.6" fill="#363755"/><path d="M265 225c21.6 0 4 29.8-1.2 41.8-3.6-16.8-20.4-41.8 1.2-41.8z" fill="#363755"/>',
              }),
            ),
      ]);
  },
});


