import { NodeSelection, Selection, TextSelection } from "lumenpage-state";
import { warnLegacyCanvasConfigUsage } from "./legacyConfigWarnings";

// 状态流封装：统一 dispatchTransaction 与文本偏移选区更新逻辑。
export const createStateFlow = ({
  view,
  getEditorProps,
  getEditorPropsList,
  applyTransaction,
  createChangeEvent,
  layoutPipeline,
  onChange,
  setPendingChangeSummary,
  setPendingSteps,
  setPendingPreferredUpdate,
  textOffsetToDocPos,
  debugLog,
  strictLegacy = false,
}) => {
  const dispatchTransaction = (tr) => {
    try {
      if (getEditorProps()?.dispatchTransaction) {
        getEditorProps().dispatchTransaction(tr);
        return;
      }
      const prevState = view.state;
      const nextState = applyTransaction(prevState, tr);
      const shouldScroll = tr?.scrolledIntoView;
      const changeEvent = createChangeEvent(tr, prevState, nextState);
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
    } catch (error) {
      console.error("[state-flow] dispatchTransaction fatal", error);
      try {
        view?._internals?.scheduleRender?.();
      } catch (_innerError) {
        // ignore
      }
    }
  };

  const setSelectionOffsets = (anchorOffset, headOffset, updatePreferred, forceText = false) => {
    if (!Number.isFinite(anchorOffset) || !Number.isFinite(headOffset)) {
      return;
    }

    const currentSelection = view.state.selection;
    if (!forceText && currentSelection instanceof NodeSelection) {
      const anchorPos = textOffsetToDocPos(view.state.doc, anchorOffset);
      const headPos = textOffsetToDocPos(view.state.doc, headOffset);
      if (anchorPos === currentSelection.anchor && headPos === currentSelection.head) {
        return;
      }
    }

    setPendingPreferredUpdate(updatePreferred);

    const anchorPos = textOffsetToDocPos(view.state.doc, anchorOffset);
    const headPos = textOffsetToDocPos(view.state.doc, headOffset);
    if (!Number.isFinite(anchorPos) || !Number.isFinite(headPos)) {
      return;
    }

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
    setSelectionOffsets,
  };
};

