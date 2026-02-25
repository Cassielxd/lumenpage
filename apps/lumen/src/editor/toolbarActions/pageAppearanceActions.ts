import type { PlaygroundLocale } from "../i18n";

type GetView = () => any;

type PageAppearanceState = {
  showLineNumbers: boolean;
  backgroundColor: string | null;
  watermarkText: string;
};

type PageAppearanceRuntime = {
  baseRenderPageBackground: ((args: any) => boolean | void) | null;
  baseRenderPageChrome: ((args: any) => boolean | void) | null;
};

type PageAppearanceTexts = {
  promptBackground: string;
  promptWatermark: string;
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
});

const resolveTexts = (locale: PlaygroundLocale): PageAppearanceTexts =>
  locale === "en-US"
    ? {
        promptBackground:
          "Page background color (CSS color, empty means restore default background)",
        promptWatermark:
          "Watermark text (empty means remove watermark, max 48 chars)",
        alertInvalidColor: "Invalid color value",
        alertWatermarkTooLong: (maxLength) => `Watermark text cannot exceed ${maxLength} chars`,
      }
    : {
        promptBackground: "请输入页面背景色（CSS 颜色值，留空恢复默认背景）",
        promptWatermark: "请输入水印文本（留空移除水印，最多 48 个字符）",
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
  state.showLineNumbers || Boolean(state.backgroundColor) || Boolean(state.watermarkText.trim());

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
  ctx.font = "11px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const y = Number(line?.y) || 0;
    ctx.fillText(String(lineNumberStart + index + 1), x, y);
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
    return true;
  };
};

const refreshPageAppearance = (view: any) => {
  view?._internals?.renderer?.pageCache?.clear?.();
  view?._internals?.scheduleRender?.();
  return true;
};

export const createPageAppearanceActions = ({
  getView,
  getLocaleKey,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
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

  const applyPageBackgroundSetting = () => {
    const payload = getSettingsAndState();
    if (!payload) {
      return false;
    }
    const raw = window.prompt(payload.texts.promptBackground, payload.state.backgroundColor || "");
    if (raw === null) {
      return false;
    }
    const next = String(raw || "").trim();
    if (!next) {
      payload.state.backgroundColor = null;
      applyAppearanceRenderers(payload.settings);
      return refreshPageAppearance(payload.view);
    }
    if (!isValidCssColor(next)) {
      window.alert(payload.texts.alertInvalidColor);
      return false;
    }
    payload.state.backgroundColor = next;
    applyAppearanceRenderers(payload.settings);
    return refreshPageAppearance(payload.view);
  };

  const applyPageWatermarkSetting = () => {
    const payload = getSettingsAndState();
    if (!payload) {
      return false;
    }
    const raw = window.prompt(payload.texts.promptWatermark, payload.state.watermarkText || "");
    if (raw === null) {
      return false;
    }
    const next = String(raw || "").trim();
    if (next.length > WATERMARK_MAX_LENGTH) {
      window.alert(payload.texts.alertWatermarkTooLong(WATERMARK_MAX_LENGTH));
      return false;
    }
    payload.state.watermarkText = next;
    applyAppearanceRenderers(payload.settings);
    return refreshPageAppearance(payload.view);
  };

  return {
    togglePageLineNumbers,
    applyPageBackgroundSetting,
    applyPageWatermarkSetting,
  };
};
