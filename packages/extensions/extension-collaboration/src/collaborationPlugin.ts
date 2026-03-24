import { Plugin, PluginKey, Selection } from "lumenpage-state";
import type * as Y from "yjs";

import {
  createBindingMeta,
  getRelativeSelection,
  restoreRelativeSelection,
  updateYFragment,
  yXmlFragmentToLumenRootNode,
  type LumenYjsBindingMeta,
} from "./yjsDocument";

export type CollaborationPluginTransactionMeta = {
  isChangeOrigin?: boolean;
  isUndoRedoOperation?: boolean;
  refresh?: boolean;
};

export type CollaborationPluginState = {
  binding: CollaborationBinding;
  fragment: Y.XmlFragment;
  doc: Y.Doc | null;
  undoManager: Y.UndoManager | null;
  addToHistory: boolean;
  isChangeOrigin: boolean;
  isUndoRedoOperation: boolean;
  revision: number;
};

export const CollaborationPluginKey = new PluginKey<CollaborationPluginState>("collaboration");

const docsEqual = (left: any, right: any) => left === right || left?.eq?.(right) === true;

const createFallbackTransactor = () => ({
  transact: (fn: () => void) => {
    fn();
  },
});

type CollaborationBindingOptions = {
  onFirstRender?: (() => void) | null;
  isDisabled?: (() => boolean) | null;
  undoManager?: Y.UndoManager | null;
};

export class CollaborationBinding {
  readonly fragment: Y.XmlFragment;
  readonly localOrigin: object;

  undoManager: Y.UndoManager | null;
  isApplyingRemote: boolean;

  private meta: LumenYjsBindingMeta;
  private view: any | null;
  private hasRendered: boolean;
  private isObserving: boolean;
  private readonly onFirstRender: (() => void) | null;
  private readonly isDisabled: (() => boolean) | null;
  private readonly handleYjsUpdateBound: (events: any[], transaction: any) => void;

  constructor(fragment: Y.XmlFragment, options: CollaborationBindingOptions = {}) {
    this.fragment = fragment;
    this.localOrigin = { name: "lumenpage-collaboration" };
    this.undoManager = options.undoManager ?? null;
    this.isApplyingRemote = false;
    this.meta = createBindingMeta();
    this.view = null;
    this.hasRendered = false;
    this.isObserving = false;
    this.onFirstRender = options.onFirstRender ?? null;
    this.isDisabled = options.isDisabled ?? null;
    this.handleYjsUpdateBound = this.handleYjsUpdate.bind(this);
  }

  get doc() {
    return this.fragment.doc ?? null;
  }

  get mapping() {
    return this.meta.mapping;
  }

  get bindingMeta() {
    return this.meta;
  }

  setUndoManager(undoManager: Y.UndoManager | null) {
    this.undoManager = undoManager;
  }

  createDoc(schema: any) {
    const meta = createBindingMeta();
    const doc = yXmlFragmentToLumenRootNode(this.fragment, schema, meta);
    this.meta = meta;
    return doc;
  }

  syncDocument(doc: any) {
    const owner = (this.doc ?? createFallbackTransactor()) as {
      transact: (fn: () => void, origin?: any) => void;
    };

    updateYFragment(owner, this.fragment, doc, this.meta, this.localOrigin);
  }

  attach(view: any) {
    this.detach();
    this.view = view;
    this.fragment.observeDeep(this.handleYjsUpdateBound);
    this.isObserving = true;

    if (!this.hasRendered) {
      this.onFirstRender?.();
      this.hasRendered = true;
    }
  }

  detach() {
    if (this.isObserving) {
      this.fragment.unobserveDeep(this.handleYjsUpdateBound);
      this.isObserving = false;
    }

    this.view = null;
  }

  destroy() {
    this.detach();
  }

  syncFromView(view: any, prevState: any, pluginState: CollaborationPluginState) {
    if (this.isDisabled?.() === true || this.isApplyingRemote) {
      return;
    }

    const nextState = view?.state;
    if (!nextState?.doc || !prevState?.doc || docsEqual(nextState.doc, prevState.doc)) {
      return;
    }

    this.syncDocument(nextState.doc);

    if (pluginState.addToHistory === false) {
      pluginState.undoManager?.stopCapturing?.();
    }
  }

  private handleYjsUpdate(_events: any[], transaction: any) {
    if (!this.view || this.isDisabled?.() === true || transaction?.origin === this.localOrigin) {
      return;
    }

    const state = this.view.state;
    const schema = state?.schema;

    if (!state || !schema) {
      return;
    }

    const relativeSelection = this.doc
      ? getRelativeSelection(this.fragment, this.meta.mapping, state)
      : null;
    const nextDoc = this.createDoc(schema);

    if (docsEqual(state.doc, nextDoc)) {
      return;
    }

    let tr = state.tr
      .replaceWith(0, state.doc.content.size, nextDoc.content)
      .setMeta("addToHistory", false)
      .setMeta(CollaborationPluginKey, {
        isChangeOrigin: true,
        isUndoRedoOperation: this.undoManager != null && transaction?.origin === this.undoManager,
        refresh: true,
      } satisfies CollaborationPluginTransactionMeta);

    try {
      const nextSelection = this.doc
        ? restoreRelativeSelection(this.doc, this.fragment, this.meta.mapping, tr.doc, relativeSelection)
        : Selection.atEnd(tr.doc);
      tr = tr.setSelection(nextSelection);
    } catch (_error) {
      tr = tr.setSelection(Selection.atEnd(tr.doc));
    }

    this.isApplyingRemote = true;

    try {
      this.view.dispatch?.(tr);
    } finally {
      this.isApplyingRemote = false;
    }
  }
}

const createPluginState = (
  binding: CollaborationBinding,
  undoManager: Y.UndoManager | null
): CollaborationPluginState => ({
  binding,
  fragment: binding.fragment,
  doc: binding.doc,
  undoManager,
  addToHistory: true,
  isChangeOrigin: false,
  isUndoRedoOperation: false,
  revision: 0,
});

export const getCollaborationPluginState = (state: any): CollaborationPluginState | null =>
  CollaborationPluginKey.getState(state) || null;

export const createCollaborationPlugin = ({
  binding,
  undoManager,
}: {
  binding: CollaborationBinding;
  undoManager: Y.UndoManager | null;
}) =>
  new Plugin<CollaborationPluginState>({
    key: CollaborationPluginKey,
    state: {
      init: () => createPluginState(binding, undoManager),
      apply: (transaction: any, pluginState: CollaborationPluginState) => {
        const change =
          (transaction?.getMeta?.(CollaborationPluginKey) as CollaborationPluginTransactionMeta | null) ||
          null;
        const addToHistory = transaction?.getMeta?.("addToHistory") !== false;
        const isChangeOrigin = change?.isChangeOrigin === true;
        const isUndoRedoOperation = change?.isUndoRedoOperation === true;
        const changed =
          transaction?.docChanged === true ||
          change?.refresh === true ||
          addToHistory !== pluginState.addToHistory ||
          isChangeOrigin !== pluginState.isChangeOrigin ||
          isUndoRedoOperation !== pluginState.isUndoRedoOperation;

        if (!changed) {
          return pluginState;
        }

        return {
          ...pluginState,
          doc: binding.doc,
          undoManager,
          addToHistory,
          isChangeOrigin,
          isUndoRedoOperation,
          revision: Number(pluginState.revision || 0) + 1,
        };
      },
    },
    view: (view: any) => {
      binding.attach(view);

      return {
        update: (nextView: any, prevState: any) => {
          const pluginState = getCollaborationPluginState(nextView?.state);
          if (!pluginState) {
            return;
          }

          binding.syncFromView(nextView, prevState, pluginState);
        },
        destroy: () => {
          binding.destroy();
        },
      };
    },
  });
