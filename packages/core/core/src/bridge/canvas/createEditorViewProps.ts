import type { Transaction } from "lumenpage-state";
import type { CanvasEditorViewProps } from "lumenpage-view-canvas";

import type { Editor } from "../../Editor";

export const createEditorViewProps = ({
  editor,
  editorProps,
  dispatchTransaction,
}: {
  editor: Editor;
  editorProps: Partial<CanvasEditorViewProps>;
  dispatchTransaction: NonNullable<CanvasEditorViewProps["dispatchTransaction"]>;
}): CanvasEditorViewProps => {
  const baseOnChange = typeof editorProps.onChange === "function" ? editorProps.onChange : null;
  const baseHandleDOMEvents = editorProps.handleDOMEvents || {};
  const baseTransformCopied =
    typeof editorProps.transformCopied === "function"
      ? ((
          slice: Parameters<NonNullable<CanvasEditorViewProps["transformCopied"]>>[1],
          view?: Parameters<NonNullable<CanvasEditorViewProps["transformCopied"]>>[0]
        ) => editorProps.transformCopied?.(view, slice) ?? slice)
      : undefined;
  const transformCopied = editor.extensionManager.transformCopied(baseTransformCopied);
  const baseTransformCopiedHTML =
    typeof editorProps.transformCopiedHTML === "function"
      ? ((
          html: string,
          slice?: Parameters<NonNullable<CanvasEditorViewProps["transformCopiedHTML"]>>[2],
          view?: Parameters<NonNullable<CanvasEditorViewProps["transformCopiedHTML"]>>[0]
        ) => editorProps.transformCopiedHTML?.(view, html, slice) ?? html)
      : undefined;
  const transformCopiedHTML = editor.extensionManager.transformCopiedHTML(baseTransformCopiedHTML);
  const baseClipboardTextSerializer =
    typeof editorProps.clipboardTextSerializer === "function"
      ? ((
          slice: Parameters<NonNullable<CanvasEditorViewProps["clipboardTextSerializer"]>>[1],
          view?: Parameters<NonNullable<CanvasEditorViewProps["clipboardTextSerializer"]>>[0]
        ) => editorProps.clipboardTextSerializer?.(view, slice) ?? null)
      : undefined;
  const clipboardTextSerializer = editor.extensionManager.clipboardTextSerializer(
    baseClipboardTextSerializer
  );
  const baseClipboardTextParser =
    typeof editorProps.clipboardTextParser === "function"
      ? ((
          text: string,
          context?: Parameters<NonNullable<CanvasEditorViewProps["clipboardTextParser"]>>[2],
          plain?: boolean,
          view?: Parameters<NonNullable<CanvasEditorViewProps["clipboardTextParser"]>>[0]
        ) => editorProps.clipboardTextParser?.(view, text, context, plain) ?? null)
      : undefined;
  const clipboardTextParser = editor.extensionManager.clipboardTextParser(baseClipboardTextParser);
  const clipboardParser = editor.extensionManager.clipboardParser(editorProps.clipboardParser ?? null);
  const clipboardSerializer = editor.extensionManager.clipboardSerializer(
    editorProps.clipboardSerializer ?? null
  );
  const baseTransformPasted =
    typeof editorProps.transformPasted === "function"
      ? ((
          slice: Parameters<NonNullable<CanvasEditorViewProps["transformPasted"]>>[1],
          view?: Parameters<NonNullable<CanvasEditorViewProps["transformPasted"]>>[0]
        ) => editorProps.transformPasted?.(view, slice) ?? slice)
      : undefined;
  const transformPasted = editor.extensionManager.transformPasted(baseTransformPasted);
  const baseTransformPastedText =
    typeof editorProps.transformPastedText === "function"
      ? ((
          text: string,
          plain: boolean,
          view?: Parameters<NonNullable<CanvasEditorViewProps["transformPastedText"]>>[0]
        ) => editorProps.transformPastedText?.(view, text, plain) ?? text)
      : undefined;
  const transformPastedText = editor.extensionManager.transformPastedText(baseTransformPastedText);
  const baseTransformPastedHTML =
    typeof editorProps.transformPastedHTML === "function"
      ? ((html: string, view?: Parameters<NonNullable<CanvasEditorViewProps["transformPastedHTML"]>>[0]) =>
          editorProps.transformPastedHTML?.(view, html) ?? html)
      : undefined;
  const transformPastedHTML = editor.extensionManager.transformPastedHTML(baseTransformPastedHTML);
  const resolvedCanvasViewConfig = {
    ...(editorProps.canvasViewConfig || {}),
    nodeRegistry: editorProps.canvasViewConfig?.nodeRegistry || editor.nodeRegistry,
  };

  return {
    ...editorProps,
    state: editor.state,
    editable: editor.options.editable,
    canvasViewConfig: resolvedCanvasViewConfig,
    dispatchTransaction,
    onChange: (view, event) => {
      const oldState = event?.oldState ?? editor.state;
      const nextState = event?.state ?? view?.state ?? oldState;
      editor.state = nextState ?? editor.state;
      baseOnChange?.(view, event);

      const transaction = event?.transaction;

      if (!transaction) {
        return;
      }

      const payload = {
        editor,
        transaction,
        state: nextState,
        oldState,
        appendedTransactions: event?.appendedTransactions || [],
      };

      editor.emit("transaction", payload);

      if (event?.selectionChanged === true) {
        editor.emit("selectionUpdate", payload);
      }

      const transactions = [transaction, ...(event?.appendedTransactions || [])].filter(Boolean);
      const focusTransaction = [...transactions].reverse().find((tr: Transaction) => {
        return tr?.getMeta?.("focus") || tr?.getMeta?.("blur");
      });
      const focusMeta = focusTransaction?.getMeta?.("focus");
      const blurMeta = focusTransaction?.getMeta?.("blur");

      if (focusMeta) {
        editor.emit("focus", { editor, event: focusMeta.event, transaction: focusTransaction, view });
      }

      if (blurMeta) {
        editor.emit("blur", { editor, event: blurMeta.event, transaction: focusTransaction, view });
      }

      if (event?.docChanged) {
        editor.emit("update", payload);
      }
    },
    handleDOMEvents: {
      ...baseHandleDOMEvents,
    },
    selectionGeometry: editorProps.selectionGeometry || editor.selectionGeometry || undefined,
    nodeSelectionTypes:
      editorProps.nodeSelectionTypes ||
      (editor.nodeSelectionTypes.length ? editor.nodeSelectionTypes : undefined),
    transformCopied: (view, slice) => transformCopied(slice, view),
    transformCopiedHTML: (view, html, slice) => transformCopiedHTML(html, slice, view),
    transformPasted: (view, slice) => transformPasted(slice, view),
    transformPastedText: (view, text, plain) => transformPastedText(text, plain, view),
    transformPastedHTML: (view, html) => transformPastedHTML(html, view),
    clipboardTextSerializer: (view, slice) => clipboardTextSerializer(slice, view),
    clipboardTextParser: (view, text, context, plain) =>
      clipboardTextParser(text, context, plain, view),
    clipboardParser,
    clipboardSerializer,
  };
};
