import { createSelectionLogger } from "../../core";
import { warnLegacyCanvasConfigUsage } from "./legacyConfigWarnings";

// 运行时通用辅助：页面宽度、文档文本、输入层定位与节点类型判断。
export const createRuntimeHelpers = ({
  dom,
  basePageWidth,
  settings,
  resolveCanvasConfig,
  queryEditorProp,
  getState,
  docToOffsetText,
  getDocTextLength,
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

  const setInputPosition = (x, y) => {
    dom.input.style.left = `${x}px`;
    dom.input.style.top = `${y}px`;
  };

  const isInSpecialStructureAtPos = (state, pos) => {
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

  const shouldAutoAdvanceAfterEnter = (args) => {
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
    setInputPosition,
    isInSpecialStructureAtPos,
    shouldAutoAdvanceAfterEnter,
  };
};

// 调试日志工厂：按配置惰性开启，避免影响正常路径性能。
export const createDebugLoggers = ({ debugConfig, getText, docPosToTextOffset, clampOffset }) => {
  const logSelection = debugConfig?.selection
    ? createSelectionLogger({ getText, docPosToTextOffset, clampOffset })
    : () => {};
  const logDelete = null;
  const debugLog = () => {};

  return {
    logSelection,
    logDelete,
    debugLog,
  };
};
