import { getCanvasConfig } from "../canvasConfig";
import {
  DEFAULT_SETTINGS,
  applyDefaultA11y,
  applyDefaultStyles,
  createA11yStatusElement,
  createDefaultDom,
} from "./dom";

// 构造阶段的环境初始化：校验 state、准备 DOM/样式、挂载容器、读取配置。
export const initEditorViewEnvironment = ({ place, viewProps }) => {
  const editorState = viewProps?.state;
  if (!editorState) {
    throw new Error("CanvasEditorView requires a state, matching ProseMirror EditorView.");
  }

  const canvasConfig = getCanvasConfig(editorState) ?? {};
  if ("collaboration" in canvasConfig || "remoteSelections" in canvasConfig) {
    throw new Error(
      "canvasConfig.collaboration/remoteSelections have been removed. Use createCollaborationPlugin() instead."
    );
  }

  const resolveCanvasConfig = (key, fallback = undefined) => canvasConfig?.[key] ?? fallback;
  const debugConfig = resolveCanvasConfig("debug", {});

  const dom = resolveCanvasConfig("elements") ?? createDefaultDom();
  const settings = { ...DEFAULT_SETTINGS, ...(resolveCanvasConfig("settings") || {}) };
  const tablePanel = resolveCanvasConfig("tablePaginationPanelEl") ?? null;
  if (tablePanel) {
    settings.tablePaginationPanelEl = tablePanel;
  }
  const paginationDebugBuilder =
    resolveCanvasConfig("paginationDebugBuilder") ??
    resolveCanvasConfig("tablePaginationDebugBuilder") ??
    null;
  if (typeof paginationDebugBuilder === "function") {
    settings.paginationDebugBuilder = paginationDebugBuilder;
  }
  settings.debugLayout = debugConfig?.layout === true;
  if (settings.debugPerf) {
    settings.__perf = { layout: null, render: null };
  }
  const basePageWidth = settings.pageWidth;

  if (resolveCanvasConfig("applyDefaultStyles", true)) {
    applyDefaultStyles(dom, settings);
  }

  const initialAttributes =
    typeof viewProps.attributes === "function"
      ? viewProps.attributes(editorState)
      : viewProps.attributes;
  applyDefaultA11y(dom, initialAttributes);

  const schema = editorState.schema;
  const a11yStatus = createA11yStatusElement(dom.root);

  if (typeof place === "function") {
    place(dom.root);
  } else {
    const mountTarget = place?.mount ?? place;
    if (mountTarget) {
      mountTarget.appendChild(dom.root);
    }
  }

  if (settings.debugPerf) {
    const host = dom.overlayHost ?? dom.root;
    const panel = document.createElement("div");
    panel.className = "lumenpage-perf-panel";
    panel.style.position = "absolute";
    panel.style.right = "12px";
    panel.style.top = "12px";
    panel.style.zIndex = "10";
    panel.style.background = "rgba(15, 23, 42, 0.85)";
    panel.style.color = "#e2e8f0";
    panel.style.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
    panel.style.padding = "8px 10px";
    panel.style.borderRadius = "6px";
    panel.style.pointerEvents = "none";
    panel.style.whiteSpace = "pre";
    panel.textContent = "perf: waiting...";
    host.appendChild(panel);
    settings.perfPanelEl = panel;
  }

  return {
    editorState,
    debugConfig,
    dom,
    settings,
    basePageWidth,
    schema,
    a11yStatus,
    resolveCanvasConfig,
    nodeRegistry: resolveCanvasConfig("nodeRegistry") ?? null,
    layoutWorkerConfig: resolveCanvasConfig("layoutWorker") ?? null,
    status: resolveCanvasConfig("statusElement") ?? document.createElement("div"),
  };
};
