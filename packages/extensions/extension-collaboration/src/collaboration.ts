import { Extension } from "lumenpage-core";
import { Selection } from "lumenpage-state";
import * as Y from "yjs";

import {
  CollaborationPluginKey,
  CollaborationBinding,
  createCollaborationPlugin,
  getCollaborationPluginState,
} from "./collaborationPlugin";
import { isYXmlFragmentEmpty } from "./yjsDocument";

export interface CollaborationStorage {
  isDisabled: boolean;
  binding: CollaborationBinding | null;
  undoManager: Y.UndoManager | null;
  fragment: Y.XmlFragment | null;
}

export interface CollaborationOptions {
  document?: Y.Doc | null;
  field?: string;
  fragment?: Y.XmlFragment | null;
  provider?: any | null;
  onFirstRender?: (() => void) | null;
}

type CollaborationCommandMethods<ReturnType> = {
  undo: () => ReturnType;
  redo: () => ReturnType;
  disableCollaboration: () => ReturnType;
  enableCollaboration: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    collaboration: CollaborationCommandMethods<ReturnType>;
  }
}

const createUndoManager = (fragment: Y.XmlFragment, binding: CollaborationBinding) => {
  const undoManager = new Y.UndoManager(fragment, {
    trackedOrigins: new Set([binding.localOrigin]),
  });

  undoManager.trackedOrigins.add(undoManager);

  return undoManager;
};

const ensureCollaborationRuntime = (
  storage: CollaborationStorage,
  options: CollaborationOptions
) => {
  const fragment = resolveCollaborationFragment(options);

  if (!fragment) {
    return null;
  }

  storage.fragment = fragment;

  if (!storage.binding || storage.binding.fragment !== fragment) {
    storage.binding = new CollaborationBinding(fragment, {
      onFirstRender: options.onFirstRender,
      isDisabled: () => storage.isDisabled,
      undoManager: storage.undoManager,
    });
  }

  if (!storage.undoManager && fragment.doc) {
    storage.undoManager = createUndoManager(fragment, storage.binding);
  }

  storage.binding.setUndoManager(storage.undoManager);

  return {
    binding: storage.binding,
    fragment,
    undoManager: storage.undoManager,
  };
};

const runUndoManagerCommand = (state: any, dispatch: ((tr: any) => void) | undefined, action: "undo" | "redo") => {
  const undoManager = getCollaborationPluginState(state)?.undoManager || null;
  const stack = action === "undo" ? undoManager?.undoStack : undoManager?.redoStack;

  if (!undoManager || !Array.isArray(stack) || stack.length === 0) {
    return false;
  }

  if (!dispatch) {
    return true;
  }

  state?.tr?.setMeta?.("preventDispatch", true);
  undoManager[action]();

  return true;
};

export const resolveCollaborationFragment = (options: CollaborationOptions) =>
  options.fragment ?? options.document?.getXmlFragment(options.field || "default") ?? null;

export const Collaboration = Extension.create<CollaborationOptions, CollaborationStorage>({
  name: "collaboration",
  priority: 1000,
  addOptions() {
    return {
      document: null,
      field: "default",
      fragment: null,
      provider: null,
      onFirstRender: null,
    };
  },
  addStorage() {
    return {
      isDisabled: false,
      binding: null,
      undoManager: null,
      fragment: null,
    };
  },
  onCreate() {
    if (this.editor?.extensionManager?.extensions?.find((extension: any) => extension.name === "undoRedo")) {
      console.warn(
        '[lumenpage warn]: "lumenpage-extension-collaboration" is intended to own collaborative history and should not be combined with "lumenpage-extension-undo-redo".',
      );
    }
  },
  addCommands() {
    return {
      undo:
        () =>
        (state: any, dispatch?: (tr: any) => void) => runUndoManagerCommand(state, dispatch, "undo"),
      redo:
        () =>
        (state: any, dispatch?: (tr: any) => void) => runUndoManagerCommand(state, dispatch, "redo"),
      disableCollaboration:
        () =>
        () => {
          this.storage.isDisabled = true;
          return true;
        },
      enableCollaboration:
        () =>
        () => {
          this.storage.isDisabled = false;

          const runtime = ensureCollaborationRuntime(this.storage, this.options);
          const state = this.editor?.view?.state || this.editor?.state;
          const binding = runtime?.binding;

          if (binding && state?.doc && !isYXmlFragmentEmpty(runtime?.fragment)) {
            const nextDoc = binding.createDoc(state.schema);

            if (state.doc?.eq?.(nextDoc) !== true) {
              const tr = state.tr
                .replaceWith(0, state.doc.content.size, nextDoc.content)
                .setMeta("addToHistory", false)
                .setMeta(CollaborationPluginKey, { refresh: true });
              tr.setSelection(Selection.atEnd(tr.doc));

              this.editor?.view?.dispatch?.(tr);
            }
          }

          return true;
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-z": () => this.editor?.commands.undo?.() === true,
      "Mod-y": () => this.editor?.commands.redo?.() === true,
      "Shift-Mod-z": () => this.editor?.commands.redo?.() === true,
    };
  },
  addPlugins() {
    const runtime = ensureCollaborationRuntime(this.storage, this.options);

    if (!runtime) {
      return [];
    }

    return [
      createCollaborationPlugin({
        binding: runtime.binding,
        undoManager: runtime.undoManager,
      }),
    ];
  },
  extendState() {
    return (state: any) => {
      const runtime = ensureCollaborationRuntime(this.storage, this.options);

      if (!runtime || !state?.doc || !state?.schema) {
        return state;
      }

      if (isYXmlFragmentEmpty(runtime.fragment)) {
        runtime.binding.syncDocument(state.doc);
        return state;
      }

      const nextDoc = runtime.binding.createDoc(state.schema);

      if (state.doc?.eq?.(nextDoc) === true) {
        return state;
      }

      const tr = state.tr
        .replaceWith(0, state.doc.content.size, nextDoc.content)
        .setMeta("addToHistory", false)
        .setMeta(CollaborationPluginKey, { refresh: true });
      tr.setSelection(Selection.atEnd(tr.doc));
      return state.apply(tr);
    };
  },
});

export {
  CollaborationBinding,
  CollaborationPluginKey,
  createCollaborationPlugin,
  getCollaborationPluginState,
};

export default Collaboration;
