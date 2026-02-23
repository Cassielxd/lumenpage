import { createSelectionLogger } from "../../core";

// 运行时通用辅助：页面宽度、文档文本、输入层定位与节点类型判断。
export const createRuntimeHelpers = ({
  dom,
  basePageWidth,
  resolveCanvasConfig,
  queryEditorProp,
  getState,
  docToOffsetText,
}) => {
  const resolvePageWidth = () => {
    const width = dom.scrollArea?.clientWidth ?? 0;
    if (!Number.isFinite(width) || width <= 0) {
      return basePageWidth;
    }
    return Math.min(basePageWidth, width);
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
      return getTextFromConfig(state.doc);
    }
    return docToOffsetText(state.doc);
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
      return fromConfig(args);
    }
    return null;
  };

  return {
    resolvePageWidth,
    getText,
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
  const logDelete = debugConfig?.delete
    ? (phase, payload) => {
        console.log("[delete]", phase, payload);
      }
    : () => {};
  const debugLog = debugConfig?.selection
    ? (label, payload) => console.log(`[selection:${label}]`, payload)
    : () => {};

  return {
    logSelection,
    logDelete,
    debugLog,
  };
};
