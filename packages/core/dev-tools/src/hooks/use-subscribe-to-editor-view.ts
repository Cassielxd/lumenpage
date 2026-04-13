import { useSetAtom } from "jotai";
import type { EditorView } from "lumenpage-view-types";
import React from "react";
import { editorStateAtom } from "../state/editor-state.js";
import { editorViewAtom } from "../state/editor-view.js";
import { historyWriteAtom } from "../state/history.js";
import subscribeOnUpdates from "../utils/subscribe-on-updates.js";

export function useSubscribeToEditorView(
  editorView: EditorView,
  diffWorkerInstance?: Worker,
) {
  const setEditorView = useSetAtom(editorViewAtom);
  const historyDispatcher = useSetAtom(historyWriteAtom);
  const setEditorState = useSetAtom(editorStateAtom);
  const diffWorker = diffWorkerInstance
    ? import("../state/json-diff-worker.js").then(
        ({ JsonDiffWorker }) => new JsonDiffWorker(diffWorkerInstance),
      )
    : import("../state/json-diff-main.js").then(
        ({ JsonDiffMain }) => new JsonDiffMain(),
      );

  React.useEffect(() => {
    // set initial editor state
    setEditorState(editorView.state);

    // store editor view reference
    setEditorView(editorView);

    historyDispatcher({ type: "reset", payload: { state: editorView.state } });

    const unsubscribe = subscribeOnUpdates(editorView, (tr, oldState, newState) => {
      setEditorState(newState);

      historyDispatcher({
        type: "update",
        payload: {
          oldState,
          newState,
          tr,
          diffWorker,
        },
      });
    });

    // CanvasEditorView 存在部分内部事务路径不会经过可拦截 dispatch，
    // 这里增加一层兜底同步，保证 State/Selection 面板总能刷新到最新 state。
    let rafId = 0;
    let lastState = editorView.state;
    const syncStateLoop = () => {
      const nextState = editorView.state;
      if (nextState !== lastState) {
        lastState = nextState;
        setEditorState(nextState);
      }
      rafId = window.requestAnimationFrame(syncStateLoop);
    };
    rafId = window.requestAnimationFrame(syncStateLoop);

    return () => {
      unsubscribe?.();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [editorView, diffWorker]);
}

