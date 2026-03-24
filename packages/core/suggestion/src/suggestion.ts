import type { Editor } from "lumenpage-core";
import { Plugin, PluginKey } from "lumenpage-state";
import { Decoration, DecorationSet } from "lumenpage-view-canvas";

import {
  findSuggestionMatch as defaultFindSuggestionMatch,
  type SuggestionMatch,
  type SuggestionMatchTrigger,
  type SuggestionRange,
} from "./findSuggestionMatch";

export interface SuggestionOptions<I = any, TSelected = any> {
  pluginKey?: PluginKey;
  shouldShow?: (props: {
    editor: Editor;
    range: SuggestionRange;
    query: string;
    text: string;
    transaction: any;
  }) => boolean;
  editor: Editor;
  char?: string;
  allowSpaces?: boolean;
  allowToIncludeChar?: boolean;
  allowedPrefixes?: string[] | null;
  startOfLine?: boolean;
  decorationTag?: string;
  decorationClass?: string;
  decorationContent?: string;
  decorationEmptyClass?: string;
  command?: (props: { editor: Editor; range: SuggestionRange; props: TSelected }) => void;
  items?: (props: { query: string; editor: Editor }) => I[] | Promise<I[]>;
  render?: () => SuggestionRenderLifecycle<I, TSelected>;
  allow?: (props: {
    editor: Editor;
    state: any;
    range: SuggestionRange;
    isActive?: boolean;
  }) => boolean;
  findSuggestionMatch?: (config: SuggestionMatchTrigger) => SuggestionMatch;
}

export interface SuggestionProps<I = any, TSelected = any> {
  editor: Editor;
  range: SuggestionRange;
  query: string;
  text: string;
  items: I[];
  command: (props: TSelected) => void;
  decorationNode: null;
  clientRect?: (() => DOMRect | null) | null;
}

export interface SuggestionKeyDownProps {
  view: any;
  event: KeyboardEvent;
  range: SuggestionRange;
}

export type SuggestionRenderLifecycle<I = any, TSelected = any> = {
  onBeforeStart?: (props: SuggestionProps<I, TSelected>) => void;
  onStart?: (props: SuggestionProps<I, TSelected>) => void;
  onBeforeUpdate?: (props: SuggestionProps<I, TSelected>) => void;
  onUpdate?: (props: SuggestionProps<I, TSelected>) => void;
  onExit?: (props: SuggestionProps<I, TSelected>) => void;
  onKeyDown?: (props: SuggestionKeyDownProps) => boolean;
};

export type SuggestionPluginState = {
  active: boolean;
  range: SuggestionRange;
  query: string | null;
  text: string | null;
  composing: boolean;
};

export const SuggestionPluginKey = new PluginKey<SuggestionPluginState>("suggestion");

const EMPTY_RANGE: SuggestionRange = { from: 0, to: 0 };

const toFinite = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const toViewportDomRect = (editor: Editor, rect: any): DOMRect | null => {
  const left = toFinite(rect?.left);
  const right = toFinite(rect?.right);
  const top = toFinite(rect?.top);
  const bottom = toFinite(rect?.bottom);
  if (left == null || right == null || top == null || bottom == null) {
    return null;
  }

  const scrollArea = editor.view?._internals?.dom?.scrollArea;
  let nextLeft = left;
  let nextRight = right;
  let nextTop = top;
  let nextBottom = bottom;

  if (scrollArea && typeof scrollArea.getBoundingClientRect === "function") {
    const hostRect = scrollArea.getBoundingClientRect();
    const hostLeft = toFinite(hostRect?.left);
    const hostTop = toFinite(hostRect?.top);
    if (hostLeft != null && hostTop != null) {
      nextLeft += hostLeft;
      nextRight += hostLeft;
      nextTop += hostTop;
      nextBottom += hostTop;
    }
  }

  const width = Math.max(1, nextRight - nextLeft);
  const height = Math.max(1, nextBottom - nextTop);

  return {
    x: nextLeft,
    y: nextTop,
    left: nextLeft,
    top: nextTop,
    right: nextRight,
    bottom: nextBottom,
    width,
    height,
    toJSON() {
      return {
        x: nextLeft,
        y: nextTop,
        left: nextLeft,
        top: nextTop,
        right: nextRight,
        bottom: nextBottom,
        width,
        height,
      };
    },
  } as DOMRect;
};

const clientRectFor = (editor: Editor, range: SuggestionRange) => () => {
  const view = editor.view;
  const selectionHead = Number(view?.state?.selection?.$anchor?.pos);
  const anchorPos = Number.isFinite(selectionHead)
    ? selectionHead
    : Number.isFinite(range.to)
      ? range.to
      : range.from;
  const raw =
    view?.coordsAtPos?.(anchorPos) ||
    view?.coordsAtPos?.(Math.max(0, anchorPos - 1)) ||
    view?.coordsAtPos?.(range.from);
  return raw ? toViewportDomRect(editor, raw) : null;
};

const dispatchExit = (view: any, pluginKeyRef: PluginKey) => {
  const tr = view.state.tr.setMeta(pluginKeyRef, { exit: true });
  view.dispatch(tr);
};

export const Suggestion = <I = any, TSelected = any>({
  pluginKey = SuggestionPluginKey,
  editor,
  char = "@",
  allowSpaces = false,
  allowToIncludeChar = false,
  allowedPrefixes = [" "],
  startOfLine = false,
  decorationTag = "span",
  decorationClass = "suggestion",
  decorationContent = "",
  decorationEmptyClass = "is-empty",
  command = () => null,
  items = () => [],
  render = () => ({}),
  allow = () => true,
  findSuggestionMatch = defaultFindSuggestionMatch,
  shouldShow,
}: SuggestionOptions<I, TSelected>) => {
  let props: SuggestionProps<I, TSelected> | undefined;
  let requestId = 0;
  const renderer = render?.();

  const plugin = new Plugin<SuggestionPluginState>({
    key: pluginKey,
    view() {
      return {
        update: async (view: any, prevState: any) => {
          const prev = pluginKey.getState(prevState) as SuggestionPluginState;
          const next = pluginKey.getState(view.state) as SuggestionPluginState;

          const moved = !!(prev?.active && next?.active && prev.range.from !== next.range.from);
          const started = !prev?.active && !!next?.active;
          const stopped = !!prev?.active && !next?.active;
          const changed =
            !started &&
            !stopped &&
            (prev?.query !== next?.query || prev?.text !== next?.text || prev?.range.to !== next?.range.to);

          const handleStart = started || (moved && changed);
          const handleChange = changed || moved;
          const handleExit = stopped || (moved && changed);

          if (!handleStart && !handleChange && !handleExit) {
            return;
          }

          const activeState = handleExit && !handleStart ? prev : next;
          if (!activeState) {
            return;
          }

          const nextProps: SuggestionProps<I, TSelected> = {
            editor,
            range: activeState.range,
            query: activeState.query || "",
            text: activeState.text || "",
            items: [],
            command: (commandProps: TSelected) => {
              return command({
                editor,
                range: activeState.range,
                props: commandProps,
              });
            },
            decorationNode: null,
            clientRect: clientRectFor(editor, activeState.range),
          };

          props = nextProps;

          if (handleStart) {
            renderer?.onBeforeStart?.(nextProps);
          }
          if (handleChange) {
            renderer?.onBeforeUpdate?.(nextProps);
          }

          if (handleChange || handleStart) {
            const nextRequest = ++requestId;
            const resolvedItems = await Promise.resolve(
              items({
                editor,
                query: activeState.query || "",
              })
            ).catch(() => []);
            if (nextRequest !== requestId) {
              return;
            }
            nextProps.items = Array.isArray(resolvedItems) ? resolvedItems : [];
          }

          if (handleExit) {
            renderer?.onExit?.(nextProps);
          }
          if (handleChange) {
            renderer?.onUpdate?.(nextProps);
          }
          if (handleStart) {
            renderer?.onStart?.(nextProps);
          }
        },
        destroy: () => {
          requestId += 1;
          if (props) {
            renderer?.onExit?.(props);
          }
        },
      };
    },
    state: {
      init: () => ({
        active: false,
        range: EMPTY_RANGE,
        query: null,
        text: null,
        composing: false,
      }),
      apply: (transaction: any, prev: SuggestionPluginState, _oldState: any, state: any) => {
        const next = { ...prev };
        const meta = transaction.getMeta(pluginKey);
        if (meta?.exit) {
          return {
            active: false,
            range: EMPTY_RANGE,
            query: null,
            text: null,
            composing: false,
          };
        }

        const isEditable = editor.isEditable !== false;
        const composing = editor.view?.composing === true;
        const selection = transaction.selection;
        const empty = selection?.empty === true;
        const from = Number(selection?.from);

        next.composing = composing;

        if (isEditable && (empty || composing)) {
          if (
            prev.active &&
            Number.isFinite(from) &&
            (from < prev.range.from || from > prev.range.to) &&
            !composing &&
            !prev.composing
          ) {
            next.active = false;
          }

          const match = findSuggestionMatch({
            char,
            allowSpaces,
            allowToIncludeChar,
            allowedPrefixes,
            startOfLine,
            $position: selection.$from,
          });

          if (
            match &&
            allow({
              editor,
              state,
              range: match.range,
              isActive: prev.active,
            }) &&
            (!shouldShow ||
              shouldShow({
                editor,
                range: match.range,
                query: match.query,
                text: match.text,
                transaction,
              }))
          ) {
            next.active = true;
            next.range = match.range;
            next.query = match.query;
            next.text = match.text;
          } else {
            next.active = false;
          }
        } else {
          next.active = false;
        }

        if (!next.active) {
          next.range = EMPTY_RANGE;
          next.query = null;
          next.text = null;
        }

        return next;
      },
    },
    props: {
      handleKeyDown(view: any, event: KeyboardEvent) {
        const state = pluginKey.getState(view.state) as SuggestionPluginState;
        if (!state?.active) {
          return false;
        }

        if (event.key === "Escape" || event.key === "Esc") {
          const handledByRenderer = renderer?.onKeyDown?.({
            view,
            event,
            range: state.range,
          });
          if (handledByRenderer) {
            return true;
          }
          dispatchExit(view, pluginKey);
          return true;
        }

        return renderer?.onKeyDown?.({
          view,
          event,
          range: state.range,
        }) === true;
      },
      decorations(state: any) {
        const pluginState = pluginKey.getState(state) as SuggestionPluginState;
        if (!pluginState?.active) {
          return null;
        }
        const isEmpty = !pluginState.query?.length;
        const decorationSpec: Record<string, any> = {
          tag: decorationTag,
          className: decorationClass,
          content: decorationContent,
          emptyClassName: isEmpty ? decorationEmptyClass : "",
        };
        return DecorationSet.create(state.doc, [
          Decoration.inline(pluginState.range.from, pluginState.range.to, decorationSpec as any),
        ]);
      },
    },
  });

  return plugin;
};

export const exitSuggestion = (view: any, pluginKeyRef: PluginKey = SuggestionPluginKey) => {
  dispatchExit(view, pluginKeyRef);
};
