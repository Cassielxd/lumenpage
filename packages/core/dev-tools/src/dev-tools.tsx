import React from "react";
import { useAtom, useAtomValue } from "jotai";
import type { EditorView } from "lumenpage-view-types";
import { devToolsOpenedAtom, devToolsSizeAtom } from "./state/global.js";
import DevToolsCollapsed from "./dev-tools-collapsed.js";
import DevToolsExpanded from "./dev-tools-expanded.js";
import { useResizeDocument } from "./hooks/use-resize-document.js";
import { useSubscribeToEditorView } from "./hooks/use-subscribe-to-editor-view.js";
import { useRollbackHistory } from "./hooks/use-rollback-history.js";

export default function DevTools(props: DevToolsProps) {
  const [isOpen, setIsOpen] = useAtom(devToolsOpenedAtom);
  const defaultSize = useAtomValue(devToolsSizeAtom);
  const editorView = props.editorView;
  const toggleOpen = React.useCallback(() => setIsOpen(!isOpen), [isOpen]);

  useResizeDocument(isOpen, defaultSize);
  useSubscribeToEditorView(editorView, props.diffWorker);

  const rollbackHistory = useRollbackHistory(editorView);

  if (isOpen) {
    return <DevToolsExpanded rollbackHistory={rollbackHistory} />;
  }

  return <DevToolsCollapsed onClick={toggleOpen} />;
}

type DevToolsProps = {
  editorView: EditorView;
  diffWorker?: Worker;
};

