import { createPlaygroundI18n, type PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog, ToolbarInputDialogOption } from "./ui/inputDialog";
import { showToolbarMessage } from "./ui/message";
import type { GetEditorCommandMap } from "./commandUtils";
import { invokeCommand } from "./commandUtils";

type GetView = () => any;

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
  texts: ReturnType<typeof createPlaygroundI18n>["textStyleActions"]
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

const buildFontSizeOptions = (
  current: number,
  texts: ReturnType<typeof createPlaygroundI18n>["textStyleActions"]
): ToolbarInputDialogOption[] => {
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
  getEditorCommands,
  getView,
  getLocaleKey,
  requestInputDialog,
}: {
  getEditorCommands: GetEditorCommandMap;
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const getTexts = () => createPlaygroundI18n(getLocaleKey()).textStyleActions;

  const applyFontFamilySetting = async () => {
    const settingsFont = getView()?._internals?.settings?.font;
    const texts = getTexts();
    const current = parseBaseFontFamily(settingsFont);
    const result = await requestInputDialog({
      title: texts.titleFontFamily,
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
      return invokeCommand(getEditorCommands()?.clearTextFontFamily);
    }
    return invokeCommand(getEditorCommands()?.setTextFontFamily, value);
  };

  const applyFontSizeSetting = async () => {
    const settingsFont = getView()?._internals?.settings?.font;
    const texts = getTexts();
    const currentSize = parseBaseFontSize(settingsFont);
    const result = await requestInputDialog({
      title: texts.titleFontSize,
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
      return invokeCommand(getEditorCommands()?.clearTextFontSize);
    }
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) {
      showToolbarMessage(texts.alertInvalidFontSize, "warning");
      return false;
    }
    return invokeCommand(getEditorCommands()?.setTextFontSize, Math.round(size));
  };

  const applyTextColorSetting = async () => {
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleTextColor,
      fields: [
        {
          key: "value",
          label: texts.promptTextColor,
          defaultValue: "#111827",
        },
      ],
    });
    if (!result) {
      return false;
    }
    const value = String(result.value || "").trim();
    if (!value) {
      return invokeCommand(getEditorCommands()?.clearTextColor);
    }
    if (!isValidCssColor(value)) {
      showToolbarMessage(texts.alertInvalidColor, "warning");
      return false;
    }
    return invokeCommand(getEditorCommands()?.setTextColor, value);
  };

  const applyTextBackgroundSetting = async () => {
    const texts = getTexts();
    const result = await requestInputDialog({
      title: texts.titleTextBackground,
      fields: [
        {
          key: "value",
          label: texts.promptTextBackground,
          defaultValue: DEFAULT_HIGHLIGHT_COLOR,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const value = String(result.value || "").trim();
    if (!value) {
      return invokeCommand(getEditorCommands()?.clearTextBackground);
    }
    if (!isValidCssColor(value)) {
      showToolbarMessage(texts.alertInvalidColor, "warning");
      return false;
    }
    return invokeCommand(getEditorCommands()?.setTextBackground, value);
  };

  const highlightSelection = () =>
    invokeCommand(getEditorCommands()?.setTextBackground, DEFAULT_HIGHLIGHT_COLOR);

  return {
    applyFontFamilySetting,
    applyFontSizeSetting,
    applyTextColorSetting,
    applyTextBackgroundSetting,
    highlightSelection,
  };
};
