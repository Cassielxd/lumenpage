import { createApp, type App as VueApp } from "vue";
import type { EditorView } from "lumenpage-view-types";
import { DevToolsApp } from "./app.js";
import { createDevToolsController } from "./controller.js";
import { ensureDevToolsStyles } from "./styles.js";
import type { DevToolsOptions } from "./types.js";

const DEVTOOLS_CLASS_NAME = "__lumenpage-dev-tools__";

let activeApp: VueApp<Element> | null = null;
let activeHost: HTMLElement | null = null;
let activeDispose: (() => void) | null = null;

function createHost(mount?: HTMLElement | null) {
  if (mount) {
    return mount;
  }

  let host = document.querySelector<HTMLElement>(`.${DEVTOOLS_CLASS_NAME}`);
  if (!host) {
    host = document.createElement("div");
    host.className = DEVTOOLS_CLASS_NAME;
    document.body.appendChild(host);
  }
  return host;
}

export function applyDevTools(
  editorView: EditorView,
  options: DevToolsOptions = {},
) {
  ensureDevToolsStyles();

  const host = createHost(options.mount ?? null);
  if (activeDispose) {
    activeDispose();
  }
  if (activeApp && activeHost) {
    activeApp.unmount();
    if (activeHost !== host && activeHost.classList.contains(DEVTOOLS_CLASS_NAME)) {
      activeHost.remove();
    } else {
      activeHost.innerHTML = "";
    }
  }

  const controller = createDevToolsController(editorView, options);
  const app = createApp(DevToolsApp, { controller });
  app.mount(host);

  activeApp = app;
  activeHost = host;
  activeDispose = () => {
    controller.destroy();
    app.unmount();
    if (!options.mount && host.classList.contains(DEVTOOLS_CLASS_NAME)) {
      host.remove();
    } else {
      host.innerHTML = "";
    }
    if (activeApp === app) {
      activeApp = null;
      activeHost = null;
      activeDispose = null;
    }
  };

  return activeDispose;
}

type LumenLikeView = {
  state: unknown;
  dispatch: (tr: unknown) => void;
  [key: string]: unknown;
};

export function applyLumenDevTools(
  editorView: LumenLikeView,
  options: DevToolsOptions = {},
) {
  return applyDevTools(editorView as unknown as EditorView, options);
}

export default applyDevTools;
