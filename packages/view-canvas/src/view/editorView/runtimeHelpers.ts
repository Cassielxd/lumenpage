import { createSelectionLogger } from "../../core";

// 运行时通用辅助：页面宽度、文档文本、输入层定位与节点类型判断。
export const createRuntimeHelpers = ({
  dom,
  basePageWidth,
  resolveCanvasConfig,
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
    const getTextProp = resolveCanvasConfig("getText");
    const state = getState();
    if (getTextProp) {
      return getTextProp(state.doc);
    }
    if (!state?.doc) {
      return "";
    }
    return docToOffsetText(state.doc);
  };

  const setInputPosition = (x, y) => {
    dom.input.style.left = `${x}px`;
    dom.input.style.top = `${y}px`;
  };

  const isInNodeTypeAtPos = (state, pos, nodeTypeName) => {
    if (!state?.doc || !Number.isFinite(pos) || !nodeTypeName) {
      return false;
    }
    try {
      const $pos = state.doc.resolve(pos);
      for (let depth = $pos.depth; depth >= 0; depth -= 1) {
        if ($pos.node(depth)?.type?.name === nodeTypeName) {
          return true;
        }
      }
    } catch (_error) {
      return false;
    }
    return false;
  };

  const isInSpecialStructureAtPos =
    resolveCanvasConfig("isInSpecialStructureAtPos") ??
    ((state, pos) => isInNodeTypeAtPos(state, pos, "table"));
  const shouldAutoAdvanceAfterEnter = resolveCanvasConfig("shouldAutoAdvanceAfterEnter", null);

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
