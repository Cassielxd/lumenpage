import { NodeSelection, Selection, TextSelection } from "lumenpage-state";
import { warnLegacyCanvasConfigUsage } from "./legacyConfigWarnings";

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
  const applyDispatchedTransaction = (tr) => {
      const prevState = view.state;
      const applied =
        typeof prevState?.applyTransaction === "function"
          ? prevState.applyTransaction(tr)
          : { state: applyTransaction(prevState, tr), transactions: [tr] };
    const nextState = applied?.state ?? prevState;
    const transactions = Array.isArray(applied?.transactions) ? applied.transactions : [tr];

    if (typeof onBeforeTransaction === "function") {
      onBeforeTransaction({
        transaction: tr,
        nextState,
      });
    }

    if (transactions.length === 0) {
      return;
    }
      const shouldScroll = tr?.scrolledIntoView;
      const changeEvent = createChangeEvent(tr, prevState, nextState, {
        transactions,
        appendedTransactions: transactions.slice(1),
      });
      if (changeEvent?.summary?.blocks?.ids?.length) {
        layoutPipeline.invalidateBlocks(changeEvent.summary.blocks.ids);
      }
      const propsList =
        typeof getEditorPropsList === "function" ? getEditorPropsList(nextState) : [];
      let handledByProps = false;
      for (const props of propsList) {
        const onChangeFromProps = props?.onChange;
        if (typeof onChangeFromProps === "function") {
          handledByProps = true;
          try {
            onChangeFromProps(view, changeEvent);
          } catch (error) {
            console.error("[state-flow] onChange prop error", error);
          }
        }
      }
      if (!handledByProps && onChange) {
        warnLegacyCanvasConfigUsage(
          "onChange",
          "EditorProps.onChange / Plugin props.onChange",
          strictLegacy
        );
        try {
          onChange(changeEvent);
        } catch (error) {
          console.error("[state-flow] legacy onChange error", error);
        }
      }
      setPendingChangeSummary(changeEvent.summary || null);
      setPendingSteps(changeEvent.steps || null);
      view.updateState(nextState);
      if (shouldScroll) {
        const targetPos = Number.isFinite(nextState?.selection?.head)
          ? Number(nextState.selection.head)
          : undefined;
        const requestScrollIntoView = view?._internals?.renderSync?.requestScrollIntoView;
        if (changeEvent?.docChanged === true && typeof requestScrollIntoView === "function") {
          requestScrollIntoView(targetPos);
        } else {
          view.scrollIntoView(targetPos);
        }
      }
  };

  const dispatchTransactionBase = (tr) => {
    try {
      applyDispatchedTransaction(tr);
    } catch (error) {
      console.error("[state-flow] dispatchTransaction fatal", error);
      try {
        view?._internals?.scheduleRender?.();
      } catch (_innerError) {
        // ignore
      }
    }
  };

  const dispatchTransaction = (tr) => {
    const externalDispatch = getEditorProps()?.dispatchTransaction;
    if (typeof externalDispatch === "function") {
      externalDispatch(tr);
      return;
    }

    dispatchTransactionBase(tr);
  };

  const setSelectionOffsets = (anchorOffset, headOffset, updatePreferred, forceText = false) => {
    if (!Number.isFinite(anchorOffset) || !Number.isFinite(headOffset)) {
      return;
    }

    const currentSelection = view.state.selection;
    const anchorPos = textOffsetToDocPos(view.state.doc, anchorOffset);
    const headPos = textOffsetToDocPos(view.state.doc, headOffset);
    if (!Number.isFinite(anchorPos) || !Number.isFinite(headPos)) {
      return;
    }

    const selectionUnchanged =
      anchorPos === currentSelection.anchor && headPos === currentSelection.head;
    if (selectionUnchanged) {
      if (currentSelection instanceof TextSelection) {
        return;
      }
      if (!forceText && currentSelection instanceof NodeSelection) {
        return;
      }
    }

    setPendingPreferredUpdate(updatePreferred);

    let selection;
    try {
      selection = TextSelection.create(view.state.doc, anchorPos, headPos);
    } catch (error) {
      selection = Selection.near(view.state.doc.resolve(headPos), headPos < anchorPos ? -1 : 1);
    }
    const tr = view.state.tr.setSelection(selection);
    debugLog("setSelectionOffsets", {
      anchorOffset,
      headOffset,
      anchorPos,
      headPos,
    });
    view.dispatch(tr);
  };

  return {
    dispatchTransaction,
    dispatchTransactionBase,
    setSelectionOffsets,
  };
};

