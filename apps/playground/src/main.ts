import {
  createDefaultNodeRendererRegistry,
  createDocFromText,
  docToText,
  schema,
} from "lumenpage-kit-basic";
import {
  applyTransaction,
  runCommand,
  setBlockAlign,
  setHeadingLevel,
  setParagraph,
} from "lumenpage-core";
import { CanvasEditorView } from "lumenpage-view-canvas";

const settings = {
  pageWidth: 816,
  pageHeight: 720,
  pageGap: 24,
  margin: {
    top: 72,
    right: 72,
    bottom: 72,
    left: 72,
  },
  lineHeight: 22,
  font: "16px Arial",
  wrapTolerance: 2,
  pageBuffer: 1,
  maxPageCache: 16,
};
const initialDocJson = {
  type: "doc",

  content: [
    {
      type: "heading",

      attrs: { level: 1 },

      content: [{ type: "text", text: "LumenPage MVP" }],
    },

    {
      type: "paragraph",

      content: [
        {
          type: "text",

          text: "This is a minimal prototype for paginated canvas rendering with a DOM input layer.",
        },
      ],
    },

    {
      type: "table",

      content: [
        {
          type: "table_row",

          content: [
            {
              type: "table_cell",

              content: [
                {
                  type: "paragraph",

                  content: [{ type: "text", text: "R1C1" }],
                },
              ],
            },

            {
              type: "table_cell",

              content: [
                {
                  type: "paragraph",

                  content: [{ type: "text", text: "R1C2" }],
                },
              ],
            },

            {
              type: "table_cell",

              content: [
                {
                  type: "paragraph",

                  content: [{ type: "text", text: "R1C3" }],
                },
              ],
            },
          ],
        },

        {
          type: "table_row",

          content: [
            {
              type: "table_cell",

              content: [
                {
                  type: "paragraph",

                  content: [{ type: "text", text: "R2C1" }],
                },
              ],
            },

            {
              type: "table_cell",

              content: [
                {
                  type: "paragraph",

                  content: [{ type: "text", text: "R2C2" }],
                },
              ],
            },

            {
              type: "table_cell",

              content: [
                {
                  type: "paragraph",

                  content: [{ type: "text", text: "R2C3" }],
                },
              ],
            },
          ],
        },
      ],
    },

    {
      type: "paragraph",

      content: [
        {
          type: "text",

          text: "The table above is editable text in each cell.",
        },
      ],
    },
  ],
};

const nodeRegistry = createDefaultNodeRendererRegistry();
const tools = document.getElementById("tools");
const viewport = document.getElementById("viewport");

if (!viewport) {
  throw new Error("Missing #viewport element");
}

viewport.innerHTML = "";

let devtoolsView = null;
let view = null;

const dispatchTransaction = (tr) => {
  if (!view) {
    return;
  }
  if (devtoolsView) {
    try {
      devtoolsView.dispatch(tr);
    } catch (error) {
      console.warn("Devtools dispatch failed", error);
    }
  }
  const nextState = applyTransaction(view.state, tr);
  view.updateState(nextState);
};

view = new CanvasEditorView(viewport, {
  schema,
  createDocFromText,
  nodeRegistry,
  json: initialDocJson,
  settings,
  getText: (doc) => docToText(doc),
  dispatchTransaction,
});

const initDevTools = async () => {
  if (!import.meta.env.DEV) {
    return;
  }
  try {
    const [{ EditorView }, { default: applyDevTools }] = await Promise.all([
      import("prosemirror-view"),
      import("prosemirror-dev-tools"),
    ]);
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.width = "0";
    host.style.height = "0";
    host.style.overflow = "hidden";
    document.body.appendChild(host);
    devtoolsView = new EditorView(host, { state: view.state });
    applyDevTools(devtoolsView);
  } catch (error) {
    console.warn("Failed to init prosemirror devtools", error);
  }
};

tools?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !view) {
    return;
  }

  const action = button.dataset.action;
  const dispatch = view.dispatch.bind(view);

  switch (action) {
    case "block-paragraph":
      runCommand(setParagraph(), view.state, dispatch);
      break;
    case "block-h1":
      runCommand(setHeadingLevel(1), view.state, dispatch);
      break;
    case "block-h2":
      runCommand(setHeadingLevel(2), view.state, dispatch);
      break;
    case "block-h3":
      runCommand(setHeadingLevel(3), view.state, dispatch);
      break;
    case "align-left":
      runCommand(setBlockAlign("left"), view.state, dispatch);
      break;
    case "align-center":
      runCommand(setBlockAlign("center"), view.state, dispatch);
      break;
    case "align-right":
      runCommand(setBlockAlign("right"), view.state, dispatch);
      break;
    default:
      break;
  }

  view.focus();
});

initDevTools();
