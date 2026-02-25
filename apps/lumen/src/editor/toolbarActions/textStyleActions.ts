import type { PlaygroundLocale } from "../i18n";

type RunCommand = (name: string, ...args: unknown[]) => boolean;
type GetView = () => any;

type TextStyleTexts = {
  promptFontFamily: string;
  promptFontSize: string;
  promptTextColor: string;
  promptTextBackground: string;
  alertInvalidColor: string;
  alertInvalidFontSize: string;
};

const DEFAULT_HIGHLIGHT_COLOR = "#fff59d";

const resolveTexts = (locale: PlaygroundLocale): TextStyleTexts =>
  locale === "en-US"
    ? {
        promptFontFamily: "Font family (empty to clear)",
        promptFontSize: "Font size in px (empty to clear)",
        promptTextColor: "Text color (CSS color, empty to clear)",
        promptTextBackground: "Text background color (CSS color, empty to clear)",
        alertInvalidColor: "Invalid color value",
        alertInvalidFontSize: "Invalid font size",
      }
    : {
        promptFontFamily: "请输入字体（留空清除）",
        promptFontSize: "请输入字号（像素，留空清除）",
        promptTextColor: "请输入文字颜色（CSS 颜色值，留空清除）",
        promptTextBackground: "请输入文字背景色（CSS 颜色值，留空清除）",
        alertInvalidColor: "颜色值无效",
        alertInvalidFontSize: "字号无效",
      };

const parseBaseFontFamily = (fontSpec: string | null | undefined) => {
  const source = String(fontSpec || "").trim();
  const match = /(?:\d+(?:\.\d+)?)px\s+(.+)/.exec(source);
  if (!match) {
    return "Arial";
  }
  const family = String(match[1] || "").trim();
  return family || "Arial";
};

const parseBaseFontSize = (fontSpec: string | null | undefined) => {
  const source = String(fontSpec || "").trim();
  const match = /(\d+(?:\.\d+)?)px/.exec(source);
  if (!match) {
    return 16;
  }
  const size = Number.parseFloat(match[1]);
  if (!Number.isFinite(size) || size <= 0) {
    return 16;
  }
  return Math.round(size);
};

const isValidCssColor = (value: string) => {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", text);
  }
  if (typeof document === "undefined") {
    return false;
  }
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = text;
  return probe.style.color !== "";
};

export const createTextStyleActions = ({
  run,
  getView,
  getLocaleKey,
}: {
  run: RunCommand;
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
}) => {
  const getTexts = () => resolveTexts(getLocaleKey());

  const applyFontFamilySetting = () => {
    const settingsFont = getView()?._internals?.settings?.font;
    const raw = window.prompt(getTexts().promptFontFamily, parseBaseFontFamily(settingsFont));
    if (raw == null) {
      return false;
    }
    const value = String(raw || "").trim();
    if (!value) {
      return run("clearTextFontFamily");
    }
    return run("setTextFontFamily", value);
  };

  const applyFontSizeSetting = () => {
    const settingsFont = getView()?._internals?.settings?.font;
    const raw = window.prompt(getTexts().promptFontSize, String(parseBaseFontSize(settingsFont)));
    if (raw == null) {
      return false;
    }
    const value = String(raw || "").trim();
    if (!value) {
      return run("clearTextFontSize");
    }
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) {
      window.alert(getTexts().alertInvalidFontSize);
      return false;
    }
    return run("setTextFontSize", Math.round(size));
  };

  const applyTextColorSetting = () => {
    const raw = window.prompt(getTexts().promptTextColor, "#111827");
    if (raw == null) {
      return false;
    }
    const value = String(raw || "").trim();
    if (!value) {
      return run("clearTextColor");
    }
    if (!isValidCssColor(value)) {
      window.alert(getTexts().alertInvalidColor);
      return false;
    }
    return run("setTextColor", value);
  };

  const applyTextBackgroundSetting = () => {
    const raw = window.prompt(getTexts().promptTextBackground, DEFAULT_HIGHLIGHT_COLOR);
    if (raw == null) {
      return false;
    }
    const value = String(raw || "").trim();
    if (!value) {
      return run("clearTextBackground");
    }
    if (!isValidCssColor(value)) {
      window.alert(getTexts().alertInvalidColor);
      return false;
    }
    return run("setTextBackground", value);
  };

  const highlightSelection = () => run("setTextBackground", DEFAULT_HIGHLIGHT_COLOR);

  return {
    applyFontFamilySetting,
    applyFontSizeSetting,
    applyTextColorSetting,
    applyTextBackgroundSetting,
    highlightSelection,
  };
};
