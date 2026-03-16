import { warnLegacyCanvasConfigUsage } from "../legacyConfigWarnings";

export const createEditorTextRuntime = ({
  dom,
  basePageWidth,
  settings,
  resolveCanvasConfig,
  queryEditorProp,
  getState,
  docToOffsetText,
  getDocTextLength,
}: {
  dom: any;
  basePageWidth: number;
  settings: any;
  resolveCanvasConfig: (key: string, fallback?: any) => any;
  queryEditorProp: (name: any, ...args: any[]) => any;
  getState: () => any;
  docToOffsetText: (doc: any) => string;
  getDocTextLength: (doc: any) => number;
}) => {
  const strictLegacy = resolveCanvasConfig("legacyPolicy", null)?.strict === true;

  const resolvePageWidth = () => {
    const configuredPageWidth =
      Number.isFinite(settings?.pageWidth) && Number(settings.pageWidth) > 0
        ? Number(settings.pageWidth)
        : basePageWidth;
    const width = dom.scrollArea?.clientWidth ?? 0;
    if (!Number.isFinite(width) || width <= 0) {
      return configuredPageWidth;
    }
    return Math.min(configuredPageWidth, width);
  };

  const getText = () => {
    const state = getState();
    if (!state?.doc) {
      return "";
    }
    const getTextProp = queryEditorProp?.("getText", state?.doc);
    if (typeof getTextProp === "string") {
      return getTextProp;
    }
    const getTextFromConfig = resolveCanvasConfig("getText");
    if (typeof getTextFromConfig === "function") {
      warnLegacyCanvasConfigUsage("getText", "EditorProps.getText", strictLegacy);
      return getTextFromConfig(state.doc);
    }
    return docToOffsetText(state.doc);
  };

  const getTextLength = () => {
    const state = getState();
    if (!state?.doc) {
      return 0;
    }
    const getTextLengthProp = queryEditorProp?.("getTextLength", state.doc);
    if (Number.isFinite(getTextLengthProp) && Number(getTextLengthProp) >= 0) {
      return Number(getTextLengthProp);
    }
    const getTextProp = queryEditorProp?.("getText", state.doc);
    if (typeof getTextProp === "string") {
      return getTextProp.length;
    }
    const getTextLengthFromConfig = resolveCanvasConfig("getTextLength");
    if (typeof getTextLengthFromConfig === "function") {
      warnLegacyCanvasConfigUsage("getTextLength", "EditorProps.getTextLength", strictLegacy);
      const configuredLength = getTextLengthFromConfig(state.doc);
      if (Number.isFinite(configuredLength) && Number(configuredLength) >= 0) {
        return Number(configuredLength);
      }
    }
    const getTextFromConfig = resolveCanvasConfig("getText");
    if (typeof getTextFromConfig === "function") {
      warnLegacyCanvasConfigUsage("getText", "EditorProps.getText", strictLegacy);
      return getTextFromConfig(state.doc).length;
    }
    return getDocTextLength(state.doc);
  };

  const isInSpecialStructureAtPos = (state: any, pos: number) => {
    const fromProps = queryEditorProp?.("isInSpecialStructureAtPos", state, pos);
    if (typeof fromProps === "boolean") {
      return fromProps;
    }
    const fromConfig = resolveCanvasConfig("isInSpecialStructureAtPos");
    if (typeof fromConfig === "function") {
      warnLegacyCanvasConfigUsage(
        "isInSpecialStructureAtPos",
        "EditorProps.isInSpecialStructureAtPos",
        strictLegacy
      );
      return fromConfig(state, pos);
    }
    return false;
  };

  const shouldAutoAdvanceAfterEnter = (args: any) => {
    const fromProps = queryEditorProp?.("shouldAutoAdvanceAfterEnter", args);
    if (typeof fromProps === "boolean") {
      return fromProps;
    }
    const fromConfig = resolveCanvasConfig("shouldAutoAdvanceAfterEnter", null);
    if (typeof fromConfig === "function") {
      warnLegacyCanvasConfigUsage(
        "shouldAutoAdvanceAfterEnter",
        "EditorProps.shouldAutoAdvanceAfterEnter",
        strictLegacy
      );
      return fromConfig(args);
    }
    return null;
  };

  return {
    resolvePageWidth,
    getText,
    getTextLength,
    isInSpecialStructureAtPos,
    shouldAutoAdvanceAfterEnter,
  };
};
