import type { EditorState, Transaction } from "lumenpage-state";
import type { EditorView } from "lumenpage-view-types";

type subsctibeCallback = (
  tr: Transaction,
  oldState: EditorState,
  newState: EditorState,
) => void;

export default function subscribeOnUpdates(
  editorView: EditorView,
  callback: subsctibeCallback,
) {
  const viewAny = editorView as any;
  const install = (getOriginal: () => ((tr: Transaction) => void) | null, setHandler: (fn: any) => void) => {
    const original = getOriginal();
    if (typeof original !== "function") {
      return null;
    }
    const dispatch = original.bind(editorView);
    const handler = (tr: Transaction) => {
      const oldState = editorView.state as EditorState;
      dispatch(tr);
      callback(tr, oldState, editorView.state as EditorState);
    };
    setHandler(handler);
    return () => {
      if (getOriginal() === handler) {
        setHandler(original);
      }
    };
  };

  return (
    install(
      () =>
        typeof viewAny?.dispatchTransaction === "function"
          ? viewAny.dispatchTransaction
          : null,
      (fn) => {
        viewAny.dispatchTransaction = fn;
      },
    ) ||
    install(
      () =>
        typeof viewAny?._internals?.dispatchTransaction === "function"
          ? viewAny._internals.dispatchTransaction
          : null,
      (fn) => {
        viewAny._internals.dispatchTransaction = fn;
      },
    ) ||
    install(
      () =>
        viewAny?._props && typeof viewAny._props.dispatchTransaction === "function"
          ? viewAny._props.dispatchTransaction
          : null,
      (fn) => {
        viewAny._props.dispatchTransaction = fn;
      },
    ) ||
    install(
      () => (typeof viewAny?.dispatch === "function" ? viewAny.dispatch : null),
      (fn) => {
        viewAny.dispatch = fn;
      },
    ) ||
    (() => {})
  );
}
