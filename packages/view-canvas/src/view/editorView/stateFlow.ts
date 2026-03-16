import { createSelectionOffsetUpdater } from "./stateFlow/selectionOffsets";
import { createTransactionDispatcher } from "./stateFlow/transactionDispatch";

// 状态流封装：统一 dispatchTransaction 与文本偏移选区更新逻辑。
export const createStateFlow = ({
  view,
  getEditorProps,
  getEditorPropsList,
  applyTransaction,
  createChangeEvent,
  onBeforeTransaction,
  layoutPipeline,
  onChange,
  setPendingChangeSummary,
  setPendingSteps,
  setPendingPreferredUpdate,
  textOffsetToDocPos,
  debugLog,
  strictLegacy = false,
}) => {
  const { dispatchTransaction, dispatchTransactionBase } = createTransactionDispatcher({
    view,
    getEditorProps,
    getEditorPropsList,
    applyTransaction,
    createChangeEvent,
    onBeforeTransaction,
    layoutPipeline,
    onChange,
    setPendingChangeSummary,
    setPendingSteps,
    strictLegacy,
  });

  const { setSelectionOffsets } = createSelectionOffsetUpdater({
    view,
    textOffsetToDocPos,
    setPendingPreferredUpdate,
    debugLog,
  });

  return {
    dispatchTransaction,
    dispatchTransactionBase,
    setSelectionOffsets,
  };
};

