import { NodeSelection, Selection } from "lumenpage-state";
import { sanitizeDocJson } from "lumenpage-link";

import { docPosToTextOffset, textOffsetToDocPos } from "../core";
import { coordsAtPos, posAtCoords } from "./posIndex";
import { destroyView } from "./editorView/lifecycle";
import {
  dispatchViewTransaction,
  focusView,
  forceViewLayout,
  forceViewRender,
  getViewPaginationInfo,
  isEndOfTextblock,
  isViewEditable,
  readSomeProp,
  scrollViewIntoView,
  setViewProps,
  viewCoordsAtPos,
  viewHasFocus,
  viewPosAtCoords,
} from "./editorView/publicApi";
import { setupCanvasEditorView } from "./editorView/setup";
import type { CanvasEditorViewProps } from "./editorView/types";

export class CanvasEditorView {
  dom;
  state;
  commands;
  dispatchTransaction;
  _internals;
  overlayHost;
  composing;

  constructor(place: any, props?: CanvasEditorViewProps) {
    const setup = setupCanvasEditorView({
      view: this,
      place,
      props,
    });
    this.state = setup.state;
    this.dom = setup.domRoot;
    this.overlayHost = setup.overlayHost;
    this.commands = setup.commands;
    this.dispatchTransaction = setup.dispatchTransaction;
    this._internals = setup.internals;
    this.composing = setup.composing;
  }

  updateState(state: any) {
    const prev = this.state;
    this.state = state;

    this._internals.updatePluginViews?.(prev, state);

    const docChanged = prev?.doc !== state?.doc;
    if (docChanged) {
      let immediateLayoutHint = false;
      try {
        immediateLayoutHint = (globalThis as any).__lumenImmediateLayoutHint === true;
        (globalThis as any).__lumenImmediateLayoutHint = false;
      } catch (_error) {
        immediateLayoutHint = false;
      }
      if (immediateLayoutHint) {
        this._internals.updateLayout?.();
      } else {
        this._internals.scheduleLayout?.();
      }
    }
    this._internals.syncNodeViews?.();
    this._internals.syncAfterStateChange();
    this._internals.updateA11yStatus?.();
    this._internals.applyViewAttributes?.(state);
  }

  setProps(props: Partial<CanvasEditorViewProps> = {}) {
    setViewProps(this, props);
  }

  forceRender(options?: {
    clearPageCache?: boolean;
    markLayoutForceRedraw?: boolean;
    syncNodeViews?: boolean;
  }) {
    return forceViewRender(this, options);
  }

  forceLayout(options?: {
    clearLayoutCache?: boolean;
    clearPageCache?: boolean;
    immediate?: boolean;
  }) {
    return forceViewLayout(this, options);
  }

  dispatch(tr: any) {
    dispatchViewTransaction(this, tr);
  }

  someProp(propName: string, f?: (value: any) => any) {
    return readSomeProp(this, propName, f);
  }

  endOfTextblock(dir = "forward", state = undefined) {
    return isEndOfTextblock(this, dir, state);
  }

  coordsAtPos(pos: number) {
    return viewCoordsAtPos(this, pos, docPosToTextOffset, coordsAtPos);
  }

  posAtCoords(coords: any) {
    return viewPosAtCoords(this, coords, textOffsetToDocPos, posAtCoords, NodeSelection);
  }

  scrollIntoView(pos?: number) {
    scrollViewIntoView(this, pos, docPosToTextOffset, coordsAtPos);
  }

  focus() {
    focusView(this);
  }

  hasFocus() {
    return viewHasFocus(this);
  }

  get editable() {
    return isViewEditable(this);
  }

  getPaginationInfo() {
    return getViewPaginationInfo(this);
  }

  getJSON() {
    return this.state?.doc?.toJSON?.() ?? null;
  }

  setJSON(json: any) {
    if (!json || !this.state?.schema?.nodeFromJSON) {
      return false;
    }
    const sanitizedJson = sanitizeDocJson(json, {
      source: "CanvasEditorView.setJSON",
    });
    if (!sanitizedJson) {
      return false;
    }
    let nextDoc = null;
    try {
      nextDoc = this.state.schema.nodeFromJSON(sanitizedJson);
    } catch (_error) {
      return false;
    }
    if (!nextDoc || nextDoc.type?.name !== "doc") {
      return false;
    }
    const tr = this.state.tr.replaceWith(0, this.state.doc.content.size, nextDoc.content);
    const head = Math.min(this.state.selection?.head ?? 0, tr.doc.content.size);
    const selection = Selection.near(tr.doc.resolve(Math.max(0, head)), 1);
    this.dispatch(tr.setSelection(selection).scrollIntoView());
    return true;
  }

  getTextContent() {
    return this?._internals?.getText?.() ?? "";
  }

  destroy() {
    destroyView(this);
  }
}
