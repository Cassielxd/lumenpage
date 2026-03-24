type EChartsModule = typeof import("echarts");
type EChartsInstance = import("echarts").ECharts;

const resolveOverlayHost = (view: any) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

const trimText = (value: unknown) => String(value || "").trim();
const normalizeKind = (value: unknown) => {
  const kind = trimText(value);
  return kind || "diagram";
};
const DEFAULT_TITLES: Record<string, string> = {
  diagram: "Diagram",
  mermaid: "Mermaid",
  mindMap: "Mind Map",
  echarts: "ECharts",
};
const isMermaidKind = (kind: string) =>
  kind === "diagram" || kind === "mermaid" || kind === "mindMap";
const isEchartsKind = (kind: string) => kind === "echarts";
const hasRenderedEmbedContent = (content: HTMLElement, kind: string) => {
  if (isEchartsKind(kind)) {
    return !!content.querySelector("canvas");
  }
  if (isMermaidKind(kind)) {
    return !!content.querySelector("svg");
  }
  return content.childElementCount > 0;
};

let mermaidInitialized = false;
let mermaidModulePromise: Promise<any> | null = null;
let echartsModulePromise: Promise<EChartsModule> | null = null;

const loadMermaid = async () => {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import("mermaid").then((module) => module.default ?? module);
  }
  return mermaidModulePromise;
};

const loadEcharts = async () => {
  if (!echartsModulePromise) {
    echartsModulePromise = import("echarts");
  }
  return echartsModulePromise;
};

const ensureMermaidInitialized = async () => {
  const mermaid = await loadMermaid();
  if (mermaidInitialized) {
    return mermaid;
  }
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "default",
  });
  mermaidInitialized = true;
  return mermaid;
};

const syncNodeViewBlockId = (element: HTMLElement, node: any) => {
  const blockId = node?.attrs?.id;
  if (blockId != null && blockId !== "") {
    element.setAttribute("data-node-view-block-id", String(blockId));
    return;
  }
  element.removeAttribute("data-node-view-block-id");
};
const createFrame = () => {
  const shell = document.createElement("div");
  shell.style.width = "100%";
  shell.style.height = "100%";
  shell.style.background = "#ffffff";
  shell.style.border = "1px solid #cbd5e1";
  shell.style.borderRadius = "10px";
  shell.style.overflow = "hidden";
  shell.style.boxSizing = "border-box";
  shell.style.display = "flex";
  shell.style.flexDirection = "column";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "10px 14px";
  header.style.borderBottom = "1px solid #e2e8f0";
  header.style.background = "#f8fafc";

  const title = document.createElement("div");
  title.style.font = "600 13px Arial";
  title.style.color = "#0f172a";

  const badge = document.createElement("div");
  badge.style.font = "12px Arial";
  badge.style.color = "#475569";

  header.appendChild(title);
  header.appendChild(badge);

  const body = document.createElement("div");
  body.style.position = "relative";
  body.style.flex = "1";
  body.style.minHeight = "0";
  body.style.padding = "8px";
  body.style.background = "#ffffff";

  const content = document.createElement("div");
  content.style.width = "100%";
  content.style.height = "100%";
  content.style.display = "flex";
  content.style.alignItems = "center";
  content.style.justifyContent = "center";
  content.style.overflow = "hidden";
  body.appendChild(content);

  shell.appendChild(header);
  shell.appendChild(body);

  return { shell, header, title, badge, body, content };
};

const showStatus = (
  content: HTMLElement,
  message: string,
  details = "",
  tone: "neutral" | "error" = "neutral"
) => {
  content.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.maxWidth = "100%";
  wrap.style.padding = "12px";
  wrap.style.textAlign = "center";

  const title = document.createElement("div");
  title.textContent = message;
  title.style.font = "600 14px Arial";
  title.style.color = tone === "error" ? "#b91c1c" : "#334155";
  wrap.appendChild(title);

  if (details) {
    const desc = document.createElement("pre");
    desc.textContent = details;
    desc.style.margin = "10px 0 0";
    desc.style.whiteSpace = "pre-wrap";
    desc.style.wordBreak = "break-word";
    desc.style.font = "12px Consolas, 'Courier New', monospace";
    desc.style.color = "#64748b";
    wrap.appendChild(desc);
  }

  content.appendChild(wrap);
};

const renderMermaid = async (content: HTMLElement, source: string, id: string) => {
  const mermaid = await ensureMermaidInitialized();
  const { svg, bindFunctions } = await mermaid.render(`lumenpage-embed-${id}`, source);
  content.innerHTML = svg;
  const svgEl = content.querySelector("svg");
  if (svgEl instanceof SVGElement) {
    svgEl.style.width = "100%";
    svgEl.style.height = "100%";
    svgEl.style.maxWidth = "100%";
    svgEl.style.maxHeight = "100%";
  }
  bindFunctions?.(content);
};

const renderEcharts = async (content: HTMLElement, source: string) => {
  const echarts = await loadEcharts();
  let option: any;
  try {
    option = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid ECharts JSON: ${String((error as Error)?.message || error)}`);
  }

  const chart = echarts.init(content, undefined, { renderer: "canvas" });
  chart.setOption(option, true);
  chart.resize();
  return chart;
};

export const createEmbedPanelNodeView = (node: any, view: any) => {
  const host = resolveOverlayHost(view);
  if (!host) {
    return null;
  }

  const container = document.createElement("div");
  container.className = "lumenpage-embed-panel-overlay";
  container.style.position = "absolute";
  container.style.transform = "translate(0px, 0px)";
  container.style.width = "0";
  container.style.height = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  container.style.outline = "none";
  syncNodeViewBlockId(container, node);
  host.appendChild(container);

  const frame = createFrame();
  frame.shell.style.pointerEvents = "auto";
  container.appendChild(frame.shell);

  let currentNode = node;
  let chart: EChartsInstance | null = null;
  let renderToken = 0;
  let lastRenderKey = "";
  let resizeObserver: ResizeObserver | null = null;

  const getRenderKey = (targetNode: any) =>
    JSON.stringify({
      kind: normalizeKind(targetNode?.attrs?.kind),
      title: trimText(targetNode?.attrs?.title),
      source: trimText(targetNode?.attrs?.source),
      width: Number(targetNode?.attrs?.width) || null,
      height: Number(targetNode?.attrs?.height) || null,
    });

  const syncHeader = () => {
    const kind = normalizeKind(currentNode.attrs?.kind);
    frame.title.textContent = trimText(currentNode.attrs?.title) || DEFAULT_TITLES[kind] || kind;
    frame.badge.textContent = kind;
  };

  const runRender = async () => {
    const nextRenderKey = getRenderKey(currentNode);
    if (nextRenderKey === lastRenderKey) {
      return;
    }
    lastRenderKey = nextRenderKey;
    const token = ++renderToken;
    const kind = normalizeKind(currentNode.attrs?.kind);
    const source = trimText(currentNode.attrs?.source);
    syncHeader();

    if (!source) {
      if (chart) {
        chart.dispose();
        chart = null;
      }
      showStatus(frame.content, "No source");
      return;
    }

    try {
      showStatus(frame.content, "Loading", kind);
      if (isEchartsKind(kind)) {
        if (chart) {
          chart.dispose();
          chart = null;
        }
        frame.content.innerHTML = "";
        const chartHost = document.createElement("div");
        chartHost.style.width = "100%";
        chartHost.style.height = "100%";
        frame.content.appendChild(chartHost);
        const nextChart = await renderEcharts(chartHost, source);
        if (token !== renderToken) {
          nextChart.dispose();
          return;
        }
        chart = nextChart;
        return;
      }

      if (chart) {
        chart.dispose();
        chart = null;
      }
      await renderMermaid(frame.content, source, String(token));
      if (token !== renderToken) {
        return;
      }
    } catch (error) {
      if (chart) {
        chart.dispose();
        chart = null;
      }
      showStatus(
        frame.content,
        "Render failed",
        String((error as Error)?.message || error),
        "error"
      );
    }
  };

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      chart?.resize();
    });
    resizeObserver.observe(frame.content);
  }

  void runRender();

  return {
    update(nextNode: any) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      currentNode = nextNode;
      syncNodeViewBlockId(container, nextNode);
      void runRender();
      return true;
    },
    syncDOM({ x, y, width, height, visible }: any) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        container.style.display = "none";
        return;
      }
      container.style.display = visible ? "block" : "none";
      container.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      container.style.width = `${Math.max(1, Math.round(width))}px`;
      container.style.height = `${Math.max(1, Math.round(height))}px`;
      const kind = normalizeKind(currentNode.attrs?.kind);
      if (visible) {
        if (chart) {
          chart.resize();
        } else if (!hasRenderedEmbedContent(frame.content, kind) && trimText(currentNode.attrs?.source)) {
          lastRenderKey = "";
          void runRender();
        }
      }
    },
    destroy() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      chart?.dispose();
      chart = null;
      container.remove();
    },
    selectNode() {
      frame.shell.style.outline = "2px solid #3b82f6";
    },
    deselectNode() {
      frame.shell.style.outline = "none";
    },
  };
};




