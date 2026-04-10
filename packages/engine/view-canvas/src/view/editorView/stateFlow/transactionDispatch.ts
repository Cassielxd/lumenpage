import { warnLegacyCanvasConfigUsage } from "../legacyConfigWarnings";
import { getEditorInternalsSections } from "../internals";

export const createTransactionDispatcher = ({
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
  strictLegacy = false,
}: {
  view: any;
  getEditorProps: () => any;
  getEditorPropsList: (state: any) => any[];
  applyTransaction: (state: any, tr: any) => any;
  createChangeEvent: (tr: any, prevState: any, nextState: any, meta: any) => any;
  onBeforeTransaction?: (args: any) => void;
  layoutPipeline: any;
  onChange?: ((event: any) => void) | null;
  setPendingChangeSummary: (value: any) => void;
  setPendingSteps: (value: any) => void;
  strictLegacy?: boolean;
}) => {
  const applyDispatchedTransaction = (tr: any) => {
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
    const propsList = typeof getEditorPropsList === "function" ? getEditorPropsList(nextState) : [];
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
      const { core } = getEditorInternalsSections(view);
      const requestScrollIntoView = core?.renderSync?.requestScrollIntoView;
      if (changeEvent?.docChanged === true && typeof requestScrollIntoView === "function") {
        requestScrollIntoView(targetPos);
      } else {
        view.scrollIntoView(targetPos);
      }
    }
  };

  const dispatchTransactionBase = (tr: any) => {
    try {
      applyDispatchedTransaction(tr);
    } catch (error) {
      console.error("[state-flow] dispatchTransaction fatal", error);
      try {
        const { viewSync } = getEditorInternalsSections(view);
        viewSync?.scheduleRender?.();
      } catch (_innerError) {
        // ignore
      }
    }
  };

  const dispatchTransaction = (tr: any) => {
    const externalDispatch = getEditorProps()?.dispatchTransaction;
    if (typeof externalDispatch === "function") {
      externalDispatch(tr);
      return;
    }

    dispatchTransactionBase(tr);
  };

  return {
    dispatchTransaction,
    dispatchTransactionBase,
  };
};
