import type { PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog, ToolbarInputDialogOption } from "./ui/inputDialog";

type RunCommand = (name: string, ...args: unknown[]) => boolean;
type GetView = () => any;

type TextStyleTexts = {
  promptFontFamily: string;
  promptFontSize: string;
  promptTextColor: string;
  promptTextBackground: string;
  clearFontFamily: string;
  clearFontSize: string;
  alertInvalidColor: string;
  alertInvalidFontSize: string;
};

const DEFAULT_HIGHLIGHT_COLOR = "#fff59d";
const FONT_SIZE_PRESETS = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];
const FONT_FAMILY_PRESETS = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
  "Segoe UI",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "SimSun",
  "Noto Sans SC",
  "Noto Serif SC",
];

const resolveTexts = (locale: PlaygroundLocale): TextStyleTexts =>
  locale === "en-US"
    ? {
        promptFontFamily: "Font family",
        promptFontSize: "Font size (px)",
        promptTextColor: "Text color (CSS color, empty to clear)",
        promptTextBackground: "Text background color (CSS color, empty to clear)",
        clearFontFamily: "Clear font family",
        clearFontSize: "Clear font size",
        alertInvalidColor: "Invalid color value",
        alertInvalidFontSize: "Invalid font size",
      }
    : {
        promptFontFamily: "字体",
        promptFontSize: "字号（px）",
        promptTextColor: "文字颜色（CSS 颜色值，留空清除）",
        promptTextBackground: "文字背景色（CSS 颜色值，留空清除）",
        clearFontFamily: "清除字体",
        clearFontSize: "清除字号",
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

const normalizeFontFamilyName = (value: string) =>
  String(value || "")
    .replace(/^["']+|["']+$/g, "")
    .trim()
    .toLowerCase();

const collectRuntimeFontFamilies = () => {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return [] as string[];
  }
  try {
    const set = new Set<string>();
    const fontSet = (document as Document & { fonts: Iterable<{ family?: string }> }).fonts;
    for (const fontFace of fontSet) {
      const family = String(fontFace?.family || "")
        .replace(/^["']+|["']+$/g, "")
        .trim();
      if (family) {
        set.add(family);
      }
    }
    return Array.from(set);
  } catch (_error) {
    return [] as string[];
  }
};

const buildFontFamilyOptions = (
  current: string,
  texts: TextStyleTexts
): ToolbarInputDialogOption[] => {
  const values = new Map<string, string>();
  const append = (family: string) => {
    const value = String(family || "").trim();
    if (!value) {
      return;
    }
    const key = normalizeFontFamilyName(value);
    if (!key || values.has(key)) {
      return;
    }
    values.set(key, value);
  };

  append(current);
  for (const family of FONT_FAMILY_PRESETS) {
    append(family);
  }
  for (const family of collectRuntimeFontFamilies()) {
    append(family);
  }

  const options: ToolbarInputDialogOption[] = [
    { label: texts.clearFontFamily, value: "" },
    ...Array.from(values.values()).map((family) => ({
      label: family,
      value: family,
    })),
  ];
  return options;
};

const buildFontSizeOptions = (current: number, texts: TextStyleTexts): ToolbarInputDialogOption[] => {
  const set = new Set<number>([current, ...FONT_SIZE_PRESETS]);
  const ordered = Array.from(set)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  return [
    { label: texts.clearFontSize, value: "" },
    ...ordered.map((value) => ({ label: `${value}px`, value: String(value) })),
  ];
};

export const createTextStyleActions = ({
  run,
  getView,
  getLocaleKey,
  requestInputDialog,
}: {
  run: RunCommand;
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const getTexts = () => resolveTexts(getLocaleKey());

  const applyFontFamilySetting = async () => {
    const settingsFont = getView()?._internals?.settings?.font;
    const texts = getTexts();
    const current = parseBaseFontFamily(settingsFont);
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Font Family" : "字体",
      fields: [
        {
          key: "value",
          label: texts.promptFontFamily,
          type: "select",
          options: buildFontFamilyOptions(current, texts),
          defaultValue: current,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const value = String(result.value || "").trim();
    if (!value) {
      return run("clearTextFontFamily");
    }
    return run("setTextFontFamily", value);
  };

  const applyFontSizeSetting = async () => {
    const settingsFont = getView()?._internals?.settings?.font;
    const texts = getTexts();
    const currentSize = parseBaseFontSize(settingsFont);
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Font Size" : "字号",
      fields: [
        {
          key: "value",
          label: texts.promptFontSize,
          type: "select",
          options: buildFontSizeOptions(currentSize, texts),
          defaultValue: String(currentSize),
        },
      ],
    });
    if (!result) {
      return false;
    }
    const value = String(result.value || "").trim();
    if (!value) {
      return run("clearTextFontSize");
    }
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) {
      window.alert(texts.alertInvalidFontSize);
      return false;
    }
    return run("setTextFontSize", Math.round(size));
  };

  const applyTextColorSetting = async () => {
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Text Color" : "文字颜色",
      fields: [
        {
          key: "value",
          label: getTexts().promptTextColor,
          defaultValue: "#111827",
        },
      ],
    });
    if (!result) {
      return false;
    }
    const value = String(result.value || "").trim();
    if (!value) {
      return run("clearTextColor");
    }
    if (!isValidCssColor(value)) {
      window.alert(getTexts().alertInvalidColor);
      return false;
    }
    return run("setTextColor", value);
  };

  const applyTextBackgroundSetting = async () => {
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Text Background" : "文字背景",
      fields: [
        {
          key: "value",
          label: getTexts().promptTextBackground,
          defaultValue: DEFAULT_HIGHLIGHT_COLOR,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const value = String(result.value || "").trim();
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
