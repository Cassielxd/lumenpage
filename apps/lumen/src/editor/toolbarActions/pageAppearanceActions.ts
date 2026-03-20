import type { PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import { showToolbarMessage } from "./ui/message";

type GetView = () => any;

type PageAppearanceState = {
  showLineNumbers: boolean;
  backgroundColor: string | null;
  watermarkText: string;
  headerText: string;
  footerText: string;
};

type PageAppearanceRuntime = {
  baseRenderPageBackground: ((args: any) => boolean | void) | null;
  baseRenderPageChrome: ((args: any) => boolean | void) | null;
};

type PageAppearanceTexts = {
  promptBackground: string;
  promptWatermark: string;
  promptHeader: string;
  promptFooter: string;
  alertInvalidColor: string;
  alertWatermarkTooLong: (maxLength: number) => string;
};

const APPEARANCE_STATE_KEY = "__lumenPageAppearanceState";
const APPEARANCE_RUNTIME_KEY = "__lumenPageAppearanceRuntime";
const WATERMARK_MAX_LENGTH = 48;

const createDefaultState = (): PageAppearanceState => ({
  showLineNumbers: false,
  backgroundColor: null,
  watermarkText: "",
  headerText: "",
  footerText: "",
});

const resolveTexts = (locale: PlaygroundLocale): PageAppearanceTexts =>
  locale === "en-US"
    ? {
        promptBackground:
          "Page background color (CSS color, empty means restore default background)",
        promptWatermark: "Watermark text (empty means remove watermark, max 48 chars)",
        promptHeader: "Header text (empty means remove; supports {page} placeholder)",
        promptFooter: "Footer text (empty means remove; supports {page} placeholder)",
        alertInvalidColor: "Invalid color value",
        alertWatermarkTooLong: (maxLength) => `Watermark text cannot exceed ${maxLength} chars`,
      }
    : {
        promptBackground: "请输入页面背景色（CSS 颜色值，留空恢复默认背景）",
        promptWatermark: "请输入水印文本（留空移除水印，最多 48 个字符）",
        promptHeader: "请输入页眉文本（留空移除，可使用 {page} 占位符）",
        promptFooter: "请输入页脚文本（留空移除，可使用 {page} 占位符）",
        alertInvalidColor: "颜色值无效",
        alertWatermarkTooLong: (maxLength) => `水印文本不能超过 ${maxLength} 个字符`,
      };

const ensureAppearanceState = (settings: any): PageAppearanceState => {
  if (!settings[APPEARANCE_STATE_KEY]) {
    settings[APPEARANCE_STATE_KEY] = createDefaultState();
  }
  return settings[APPEARANCE_STATE_KEY] as PageAppearanceState;
};

const ensureAppearanceRuntime = (settings: any): PageAppearanceRuntime => {
  if (!settings[APPEARANCE_RUNTIME_KEY]) {
    settings[APPEARANCE_RUNTIME_KEY] = {
      baseRenderPageBackground:
        typeof settings.renderPageBackground === "function" ? settings.renderPageBackground : null,
      baseRenderPageChrome:
        typeof settings.renderPageChrome === "function" ? settings.renderPageChrome : null,
    } as PageAppearanceRuntime;
  }
  return settings[APPEARANCE_RUNTIME_KEY] as PageAppearanceRuntime;
};

const hasCustomAppearance = (state: PageAppearanceState) =>
  state.showLineNumbers ||
  Boolean(state.backgroundColor) ||
  Boolean(state.watermarkText.trim()) ||
  Boolean(state.headerText.trim()) ||
  Boolean(state.footerText.trim());

const isValidCssColor = (color: string) => {
  const value = color.trim();
  if (!value) {
    return false;
  }
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", value);
  }
  if (typeof document === "undefined") {
    return false;
  }
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = value;
  return probe.style.color !== "";
};

const resolvePageLineNumberOffset = (layout: any, pageIndex: number) => {
  let total = 0;
  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  for (let i = 0; i < pageIndex; i += 1) {
    total += Array.isArray(pages[i]?.lines) ? pages[i].lines.length : 0;
  }
  return total;
};

const drawPageLineNumbers = ({ ctx, pageIndex, layout }: any) => {
  const page = layout?.pages?.[pageIndex];
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  if (lines.length === 0) {
    return;
  }
  const marginLeft = Number(layout?.margin?.left) || 72;
  const lineNumberStart = resolvePageLineNumberOffset(layout, pageIndex);
  const x = Math.max(16, marginLeft - 10);

  ctx.save();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const y = Number(line?.y) || 0;
    const lineHeight =
      Number.isFinite(line?.lineHeight) && Number(line.lineHeight) > 0
        ? Number(line.lineHeight)
        : Number(layout?.lineHeight) || 22;
    ctx.fillText(String(lineNumberStart + index + 1), x, y + lineHeight / 2);
  }
  ctx.restore();
};

const drawPageWatermark = ({ ctx, width, height }: any, text: string) => {
  const value = String(text || "").trim();
  if (!value) {
    return;
  }
  const content = value.slice(0, WATERMARK_MAX_LENGTH);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-20 * Math.PI) / 180);
  ctx.fillStyle = "rgba(148, 163, 184, 0.24)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '600 46px "Times New Roman", "Noto Serif", serif';
  ctx.fillText(content, 0, 0, width * 0.72);
  ctx.restore();
};

const resolvePageLabel = (text: string, pageIndex: number) =>
  String(text || "").replace(/\{page\}/g, String(pageIndex + 1));

const drawPageHeader = ({ ctx, width, pageIndex, layout }: any, text: string) => {
  const value = resolvePageLabel(text, pageIndex).trim();
  if (!value) {
    return;
  }
  const marginLeft = Number(layout?.margin?.left) || 72;
  const marginTop = Number(layout?.margin?.top) || 72;
  ctx.save();
  ctx.fillStyle = "#64748b";
  ctx.font = '12px "Times New Roman", "Noto Serif", serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    value,
    Math.max(16, marginLeft),
    Math.max(12, marginTop * 0.45),
    width - marginLeft * 2
  );
  ctx.restore();
};

const drawPageFooter = ({ ctx, width, height, pageIndex, layout }: any, text: string) => {
  const value = resolvePageLabel(text, pageIndex).trim();
  if (!value) {
    return;
  }
  const marginLeft = Number(layout?.margin?.left) || 72;
  const marginBottom = Number(layout?.margin?.bottom) || 72;
  ctx.save();
  ctx.fillStyle = "#64748b";
  ctx.font = '12px "Times New Roman", "Noto Serif", serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    value,
    Math.max(16, marginLeft),
    Math.max(12, height - marginBottom * 0.45),
    width - marginLeft * 2
  );
  ctx.restore();
};

const applyAppearanceRenderers = (settings: any) => {
  const state = ensureAppearanceState(settings);
  const runtime = ensureAppearanceRuntime(settings);
  if (!hasCustomAppearance(state)) {
    settings.renderPageBackground = runtime.baseRenderPageBackground;
    settings.renderPageChrome = runtime.baseRenderPageChrome;
    return;
  }

  settings.renderPageBackground = (args: any) => {
    let backgroundHandled = false;
    if (typeof runtime.baseRenderPageBackground === "function") {
      backgroundHandled = runtime.baseRenderPageBackground(args) === true;
    }
    if (!backgroundHandled) {
      args.drawDefaultBackground();
    }
    if (state.backgroundColor) {
      args.ctx.save();
      args.ctx.fillStyle = state.backgroundColor;
      args.ctx.fillRect(0, 0, args.width, args.height);
      args.ctx.strokeStyle = "#d1d5db";
      args.ctx.strokeRect(0, 0, args.width, args.height);
      args.ctx.restore();
    }
    return true;
  };

  settings.renderPageChrome = (args: any) => {
    let chromeHandled = false;
    if (typeof runtime.baseRenderPageChrome === "function") {
      chromeHandled = runtime.baseRenderPageChrome(args) === true;
    }
    if (!chromeHandled) {
      args.drawDefaultCornerMarks();
    }
    if (state.showLineNumbers) {
      drawPageLineNumbers(args);
    }
    if (state.watermarkText.trim()) {
      drawPageWatermark(args, state.watermarkText);
    }
    if (state.headerText.trim()) {
      drawPageHeader(args, state.headerText);
    }
    if (state.footerText.trim()) {
      drawPageFooter(args, state.footerText);
    }
    return true;
  };
};

const refreshPageAppearance = (view: any) => {
  if (!view) {
    return false;
  }
  if (typeof view.forceRender === "function") {
    return view.forceRender({
      clearPageCache: true,
      markLayoutForceRedraw: true,
      syncNodeViews: true,
    });
  }
  const internals = view?._internals;
  const layout = internals?.getLayout?.();
  if (layout && typeof layout === "object") {
    layout.__forceRedraw = true;
  }
  internals?.renderer?.pageCache?.clear?.();
  internals?.updateLayout?.();
  internals?.scheduleRender?.();
  return true;
};

export const createPageAppearanceActions = ({
  getView,
  getLocaleKey,
  requestInputDialog,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const getSettingsAndState = () => {
    const view = getView();
    const settings = view?._internals?.settings;
    if (!settings) {
      return null;
    }
    return {
      view,
      settings,
      state: ensureAppearanceState(settings),
      texts: resolveTexts(getLocaleKey()),
    };
  };

  const togglePageLineNumbers = () => {
    const payload = getSettingsAndState();
    if (!payload) {
      return false;
    }
    payload.state.showLineNumbers = !payload.state.showLineNumbers;
    applyAppearanceRenderers(payload.settings);
    return refreshPageAppearance(payload.view);
  };

  const getPageBackgroundColor = () => {
    const payload = getSettingsAndState();
    if (!payload) {
      return null;
    }
    const value = String(payload.state.backgroundColor || "").trim();
    return value || null;
  };

  const setPageBackgroundColor = (color: string | null) => {
    const payload = getSettingsAndState();
    if (!payload) {
      return false;
    }
    const next = String(color || "").trim();
    if (!next) {
      payload.state.backgroundColor = null;
      applyAppearanceRenderers(payload.settings);
      return refreshPageAppearance(payload.view);
    }
    if (!isValidCssColor(next)) {
      showToolbarMessage(payload.texts.alertInvalidColor, "warning");
      return false;
    }
    payload.state.backgroundColor = next;
    applyAppearanceRenderers(payload.settings);
    return refreshPageAppearance(payload.view);
  };

  const applyPageBackgroundSetting = async () => {
    const payload = getSettingsAndState();
    if (!payload) {
      return false;
    }
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Page Background" : "\u9875\u9762\u80cc\u666f",
      fields: [
        {
          key: "value",
          label: payload.texts.promptBackground,
          defaultValue: payload.state.backgroundColor || "",
        },
      ],
    });
    if (!result) {
      return false;
    }
    return setPageBackgroundColor(result.value ?? "");
  };

  const applyPageWatermarkSetting = async () => {
    const payload = getSettingsAndState();
    if (!payload) {
      return false;
    }
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Page Watermark" : "\u6c34\u5370",
      fields: [
        {
          key: "value",
          label: payload.texts.promptWatermark,
          defaultValue: payload.state.watermarkText || "",
        },
      ],
    });
    if (!result) {
      return false;
    }
    const next = String(result.value || "").trim();
    if (next.length > WATERMARK_MAX_LENGTH) {
      showToolbarMessage(payload.texts.alertWatermarkTooLong(WATERMARK_MAX_LENGTH), "warning");
      return false;
    }
    payload.state.watermarkText = next;
    applyAppearanceRenderers(payload.settings);
    return refreshPageAppearance(payload.view);
  };

  const applyPageHeaderSetting = async () => {
    const payload = getSettingsAndState();
    if (!payload) {
      return false;
    }
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Page Header" : "\u9875\u7709",
      fields: [
        {
          key: "value",
          label: payload.texts.promptHeader,
          defaultValue: payload.state.headerText || "",
        },
      ],
    });
    if (!result) {
      return false;
    }
    payload.state.headerText = String(result.value || "").trim();
    applyAppearanceRenderers(payload.settings);
    return refreshPageAppearance(payload.view);
  };

  const applyPageFooterSetting = async () => {
    const payload = getSettingsAndState();
    if (!payload) {
      return false;
    }
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Page Footer" : "\u9875\u811a",
      fields: [
        {
          key: "value",
          label: payload.texts.promptFooter,
          defaultValue: payload.state.footerText || "",
        },
      ],
    });
    if (!result) {
      return false;
    }
    payload.state.footerText = String(result.value || "").trim();
    applyAppearanceRenderers(payload.settings);
    return refreshPageAppearance(payload.view);
  };

  return {
    togglePageLineNumbers,
    getPageBackgroundColor,
    setPageBackgroundColor,
    applyPageBackgroundSetting,
    applyPageWatermarkSetting,
    applyPageHeaderSetting,
    applyPageFooterSetting,
  };
};
