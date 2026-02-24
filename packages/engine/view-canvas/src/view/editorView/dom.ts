import { measureTextWidth } from "../measure";

// 视图默认配置，集中维护以便复用与覆盖。
export const DEFAULT_SETTINGS = {
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
  scrollMargin: 24,
  font: "16px Arial",
  codeFont: "13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
  codeBackground: "#f3f4f6",
  linkColor: "#2563eb",
  blockquoteIndent: 24,
  blockquoteBorderColor: "#9ca3af",
  blockquoteBorderWidth: 3,
  codeBlockPadding: 12,
  codeBlockBackground: "#f3f4f6",
  codeBlockBorderColor: "#e5e7eb",
  wrapTolerance: 2,
  pageBuffer: 1,
  maxPageCache: 16,
  selectionStyle: {
    fill: "rgba(191, 219, 254, 0.4)",
    stroke: "rgba(59, 130, 246, 0.8)",
    strokeWidth: 1,
    radius: 2,
    inset: 0,
  },
  blockSpacing: 8,
  paragraphSpacingBefore: 0,
  paragraphSpacingAfter: 8,
  dropCursor: {
    color: "#2563eb",
    width: 2,
  },
  collaboration: {
    selectionOpacity: 0.25,
    cursorWidth: 2,
    labelFont: "12px Arial",
  },
  // 可选：自定义每页背景绘制（返回 true 表示已完全接管背景与边框）。
  renderPageBackground: null,
  // 可选：自定义每页纸张外观绘制（返回 true 表示已完全接管）。
  renderPageChrome: null,
  // 可选：自定义每页 canvas 的 DOM 样式（阴影/圆角/CSS 滤镜等）。
  onPageCanvasStyle: null,
  touch: {
    longPressDelay: 450,
    tapMoveThreshold: 12,
  },
  debugPerf: false,
  measureTextWidth,
};

// 构建默认 DOM 结构（根节点、滚动层、画布层、输入层）。
export const createDefaultDom = () => {
  const root = document.createElement("div");
  root.className = "lumenpage-editor";

  const viewport = document.createElement("div");
  viewport.className = "lumenpage-viewport";

  const scrollArea = document.createElement("div");
  scrollArea.className = "lumenpage-scroll-area";
  // 画布编辑器使用虚拟选区，开启 draggable 以触发原生 dragstart 事件，
  // 再由内部拖拽管线接管数据写入与移动/复制语义。
  scrollArea.draggable = true;

  const spacer = document.createElement("div");
  spacer.className = "lumenpage-spacer";
  scrollArea.appendChild(spacer);

  const pageLayer = document.createElement("div");
  pageLayer.className = "lumenpage-page-layer";

  const overlayHost = document.createElement("div");
  overlayHost.className = "lumenpage-overlay-host";

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.className = "lumenpage-overlay";

  const inputHost = document.createElement("div");
  inputHost.className = "lumenpage-input-host";

  const input = document.createElement("textarea");
  input.className = "lumenpage-input";
  input.spellcheck = false;
  inputHost.appendChild(input);

  viewport.append(scrollArea, pageLayer, overlayHost, overlayCanvas, inputHost);
  root.appendChild(viewport);

  return { root, viewport, scrollArea, spacer, pageLayer, overlayHost, overlayCanvas, inputHost, input };
};

// 应用默认样式，确保层级与输入行为一致。
export const applyDefaultStyles = (dom, settings) => {
  dom.root.style.position = "relative";
  dom.root.style.width = "100%";
  dom.root.style.height = "100%";
  dom.root.style.overflow = "hidden";

  dom.viewport.style.position = "relative";
  dom.viewport.style.width = "100%";
  dom.viewport.style.height = "100%";
  dom.viewport.style.overflow = "hidden";

  dom.scrollArea.style.position = "absolute";
  dom.scrollArea.style.inset = "0";
  dom.scrollArea.style.overflow = "auto";

  dom.pageLayer.style.position = "absolute";
  dom.pageLayer.style.inset = "0";
  dom.pageLayer.style.pointerEvents = "none";

  dom.overlayHost.style.position = "absolute";
  dom.overlayHost.style.inset = "0";
  dom.overlayHost.style.pointerEvents = "none";

  dom.overlayCanvas.style.position = "absolute";
  dom.overlayCanvas.style.inset = "0";
  dom.overlayCanvas.style.width = "100%";
  dom.overlayCanvas.style.height = "100%";
  dom.overlayCanvas.style.pointerEvents = "none";

  dom.inputHost.style.position = "absolute";
  dom.inputHost.style.inset = "0";
  dom.inputHost.style.pointerEvents = "none";

  dom.input.style.position = "absolute";
  dom.input.style.width = "2px";
  dom.input.style.height = `${settings.lineHeight}px`;
  dom.input.style.padding = "0";
  dom.input.style.margin = "0";
  dom.input.style.border = "none";
  dom.input.style.outline = "none";
  dom.input.style.resize = "none";
  dom.input.style.overflow = "hidden";
  dom.input.style.background = "transparent";
  dom.input.style.color = "transparent";
  dom.input.style.caretColor = "#111827";
  dom.input.style.font = settings.font;
  dom.input.style.lineHeight = `${settings.lineHeight}px`;
};

// 设置基础 ARIA 属性，提供可访问性与焦点能力。
export const applyDefaultA11y = (dom, attributes: Record<string, any> | null = {}) => {
  const attrs = attributes && typeof attributes === "object" ? attributes : {};
  const label = attrs["aria-label"] || "LumenPage editor";
  const labelledBy = attrs["aria-labelledby"];
  const describedBy = attrs["aria-describedby"];
  const lang = typeof attrs.lang === "string" ? attrs.lang.trim() : "";
  const contrast = typeof attrs["data-contrast"] === "string" ? attrs["data-contrast"].trim() : "";
  const role = attrs.role || "textbox";
  const multiline = attrs["aria-multiline"] ?? "true";
  const tabIndex = Number.isFinite(attrs.tabIndex)
    ? attrs.tabIndex
    : Number.isFinite(attrs.tabindex)
      ? attrs.tabindex
      : 0;

  dom.root.setAttribute("role", role);
  dom.root.setAttribute("aria-multiline", String(multiline));
  dom.root.setAttribute("aria-label", label);
  if (labelledBy) {
    dom.root.setAttribute("aria-labelledby", labelledBy);
  }
  if (describedBy) {
    dom.root.setAttribute("aria-describedby", describedBy);
  }
  if (lang) {
    dom.root.setAttribute("lang", lang);
  } else {
    dom.root.removeAttribute("lang");
  }
  if (contrast) {
    dom.root.setAttribute("data-contrast", contrast);
  } else {
    dom.root.removeAttribute("data-contrast");
  }
  dom.root.tabIndex = tabIndex;

  dom.input.setAttribute("role", role);
  dom.input.setAttribute("aria-multiline", String(multiline));
  dom.input.setAttribute("aria-label", label);
  if (labelledBy) {
    dom.input.setAttribute("aria-labelledby", labelledBy);
  }
  if (describedBy) {
    dom.input.setAttribute("aria-describedby", describedBy);
  }
  if (lang) {
    dom.input.setAttribute("lang", lang);
  } else {
    dom.input.removeAttribute("lang");
  }
  if (contrast) {
    dom.input.setAttribute("data-contrast", contrast);
  } else {
    dom.input.removeAttribute("data-contrast");
  }
};

export const createA11yStatusElement = (root) => {
  const a11yStatus = document.createElement("div");
  a11yStatus.className = "lumenpage-a11y-status";
  a11yStatus.setAttribute("role", "status");
  a11yStatus.setAttribute("aria-live", "polite");
  a11yStatus.style.position = "absolute";
  a11yStatus.style.left = "-10000px";
  a11yStatus.style.top = "0";
  a11yStatus.style.width = "1px";
  a11yStatus.style.height = "1px";
  a11yStatus.style.overflow = "hidden";
  root.appendChild(a11yStatus);
  return a11yStatus;
};
