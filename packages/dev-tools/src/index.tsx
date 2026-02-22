import React from "react";
import type { EditorView } from "lumenpage-view-types";
import DevTools from "./dev-tools";
import { createRoot, Root } from "react-dom/client";

const DEVTOOLS_CLASS_NAME = "__prosemirror-dev-tools__";
let root: Root;

function createPlace() {
  let place = document.querySelector(`.${DEVTOOLS_CLASS_NAME}`);

  if (!place) {
    place = document.createElement("div");
    place.className = DEVTOOLS_CLASS_NAME;
    document.body.appendChild(place);
  } else {
    // eslint-disable-next-line react/no-deprecated
    root.unmount();
    place.innerHTML = "";
  }

  return place;
}

type DevToolsProps = { diffWorker?: Worker };
function applyDevTools(editorView: EditorView, props: DevToolsProps) {
  const place = createPlace();
  root = createRoot(place);
  root.render(
    <DevTools editorView={editorView} diffWorker={props?.diffWorker} />,
  );

  return () => {
    root.unmount();
  };
}

type LumenLikeView = {
  state: unknown;
  dispatch: (tr: unknown) => void;
  [key: string]: unknown;
};

export function applyLumenDevTools(editorView: LumenLikeView, props: DevToolsProps = {}) {
  return applyDevTools(editorView as unknown as EditorView, props);
}

export default applyDevTools;
export { applyDevTools };

