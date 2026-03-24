import { Plugin, PluginKey } from "lumenpage-state";
import { Decoration, DecorationSet } from "lumenpage-view-canvas";
import {
  getCollaborationPluginState,
  getRelativeSelection,
  relativePositionToAbsolutePosition,
  relativeSelectionFromJSON,
  relativeSelectionToJSON,
} from "lumenpage-extension-collaboration";

const docsEqual = (left: any, right: any) => left === right || left?.eq?.(right) === true;

const withAlpha = (color: string | null | undefined, alpha: number, fallback: string) => {
  const value = String(color || "").trim();

  if (!value) {
    return fallback;
  }

  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const normalized =
      raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => Number(part));

    if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }

  return fallback;
};

const resolveUserColor = (user: Record<string, any>) => String(user?.color || "#2563eb");

const awarenessStatesToArray = (states: Map<number, Record<string, any>> | null | undefined) =>
  Array.from(states?.entries() || []).map(([clientId, value]) => ({
    clientId,
    ...(value?.user || {}),
  }));

const createDefaultCaretRenderer = (user: Record<string, any>) => {
  const color = resolveUserColor(user);
  const label = String(user?.name || `User ${user?.clientId ?? "?"}`);

  return (ctx: CanvasRenderingContext2D, x: number, y: number, height = 16) => {
    const caretHeight = Math.max(12, Number.isFinite(height) ? Number(height) : 16);
    const labelHeight = 16;
    const labelPaddingX = 4;
    const labelPaddingY = 2;
    const labelX = x + 4;
    const labelY = Math.max(0, y - labelHeight - 4);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y);
    ctx.lineTo(x + 0.5, y + caretHeight);
    ctx.stroke();

    ctx.font = "12px sans-serif";
    const labelWidth = ctx.measureText(label).width + labelPaddingX * 2;
    ctx.fillStyle = color;
    ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX + labelPaddingX, labelY + labelHeight / 2 + labelPaddingY / 2);
    ctx.restore();
  };
};

const resolveSelectionSpec = (user: Record<string, any>, options: any) => ({
  backgroundColor: withAlpha(resolveUserColor(user), 0.18, "rgba(37, 99, 235, 0.18)"),
  ...(options.selectionRender?.(user) || {}),
});

const resolveCaretRender = (user: Record<string, any>, options: any) => {
  const rendered = options.render?.(user);

  if (typeof rendered === "function") {
    return {
      render: rendered,
      spec: {},
    };
  }

  if (rendered && typeof rendered === "object" && typeof rendered.render === "function") {
    const { render, ...spec } = rendered;
    return {
      render,
      spec,
    };
  }

  return {
    render: createDefaultCaretRenderer(user),
    spec: {},
  };
};

const createRemoteSelectionDecorations = (state: any, awareness: any, options: any) => {
  const collaborationState = getCollaborationPluginState(state);
  const binding = collaborationState?.binding;
  const fragment = collaborationState?.fragment;
  const doc = collaborationState?.doc;

  if (!binding || !fragment || !doc || !awareness?.states) {
    return null;
  }

  const localClientId = Number(awareness?.clientID);
  const decorations: any[] = [];

  for (const [clientId, value] of awareness.states.entries()) {
    if (Number(clientId) === localClientId) {
      continue;
    }

    const user = {
      clientId,
      ...(value?.user || {}),
    };
    const relativeSelection = relativeSelectionFromJSON(value?.selection);

    if (!relativeSelection) {
      continue;
    }

    if (relativeSelection.type === "all") {
      decorations.push(Decoration.inline(0, state.doc.content.size, resolveSelectionSpec(user, options)));
      continue;
    }

    const anchor =
      relativeSelection.anchor == null
        ? null
        : relativePositionToAbsolutePosition(doc, fragment, relativeSelection.anchor, binding.mapping);
    const head =
      relativeSelection.head == null
        ? anchor
        : relativePositionToAbsolutePosition(doc, fragment, relativeSelection.head, binding.mapping);

    if (!Number.isFinite(anchor) || !Number.isFinite(head)) {
      continue;
    }

    const caret = resolveCaretRender(user, options);
    const selectionSpec = resolveSelectionSpec(user, options);
    const caretPos = Number(head);

    if (relativeSelection.type === "node") {
      const node = state.doc.nodeAt(Number(anchor));

      if (node) {
        decorations.push(
          Decoration.node(Number(anchor), Number(anchor) + node.nodeSize, {
            borderColor: resolveUserColor(user),
            borderWidth: 1,
            ...selectionSpec,
          })
        );
      }

      decorations.push(Decoration.widget(caretPos, caret.render, { side: 1, ...caret.spec }));
      continue;
    }

    const from = Math.min(Number(anchor), Number(head));
    const to = Math.max(Number(anchor), Number(head));

    if (to > from) {
      decorations.push(Decoration.inline(from, to, selectionSpec));
    }

    decorations.push(
      Decoration.widget(caretPos, caret.render, {
        side: Number(head) >= Number(anchor) ? 1 : -1,
        ...caret.spec,
      })
    );
  }

  return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : null;
};

export type CollaborationCaretPluginState = {
  revision: number;
  decorations: DecorationSet | null;
  users: Array<Record<string, any>>;
};

export const CollaborationCaretPluginKey = new PluginKey<CollaborationCaretPluginState>(
  "collaborationCaret"
);

const createPluginState = (state: any, awareness: any, options: any, revision = 0): CollaborationCaretPluginState => ({
  revision,
  decorations: createRemoteSelectionDecorations(state, awareness, options),
  users: awarenessStatesToArray(awareness?.states),
});

export const createCollaborationCaretPlugin = ({
  awareness,
  storage,
  options,
}: {
  awareness: any;
  storage: { users: Array<Record<string, any>> };
  options: any;
}) =>
  new Plugin<CollaborationCaretPluginState>({
    key: CollaborationCaretPluginKey,
    state: {
      init: (_config: any, state: any) => createPluginState(state, awareness, options),
      apply: (transaction: any, pluginState: CollaborationCaretPluginState, _oldState: any, newState: any) => {
        const shouldRefresh =
          transaction?.docChanged === true ||
          transaction?.selectionSet === true ||
          transaction?.getMeta?.(CollaborationCaretPluginKey) != null;

        if (!shouldRefresh) {
          return pluginState;
        }

        return createPluginState(newState, awareness, options, Number(pluginState?.revision || 0) + 1);
      },
    },
    props: {
      decorations(state: any) {
        return (this as any).getState(state)?.decorations || null;
      },
    },
    view: (view: any) => {
      let lastSelectionJson = "";
      let lastUserJson = "";

      const syncUsers = () => {
        storage.users = awarenessStatesToArray(awareness?.states);
        options.onUpdate?.(storage.users);
      };

      const dispatchRefresh = () => {
        const transaction = view?.state?.tr
          ?.setMeta(CollaborationCaretPluginKey, { refresh: true })
          ?.setMeta("addToHistory", false);

        if (transaction) {
          view.dispatch?.(transaction);
        }
      };

      const syncLocalSelection = (nextView: any) => {
        const state = nextView?.state;
        const collaborationState = getCollaborationPluginState(state);
        const binding = collaborationState?.binding;
        const fragment = collaborationState?.fragment;
        const doc = collaborationState?.doc;

        if (!binding || !fragment || !doc) {
          if (lastSelectionJson !== "null") {
            lastSelectionJson = "null";
            awareness?.setLocalStateField?.("selection", null);
          }
          return;
        }

        const relativeSelection = getRelativeSelection(fragment, binding.mapping, state);
        const selectionJson = relativeSelectionToJSON(relativeSelection);
        const serialized = JSON.stringify(selectionJson);

        if (serialized === lastSelectionJson) {
          return;
        }

        lastSelectionJson = serialized;
        awareness?.setLocalStateField?.("selection", selectionJson);
      };

      const handleAwarenessUpdate = () => {
        const nextUsers = awarenessStatesToArray(awareness?.states);
        const serialized = JSON.stringify(nextUsers);

        if (serialized !== lastUserJson) {
          lastUserJson = serialized;
          syncUsers();
        }

        dispatchRefresh();
      };

      awareness?.setLocalStateField?.("user", options.user || {});
      syncUsers();
      syncLocalSelection(view);
      awareness?.on?.("update", handleAwarenessUpdate);

      return {
        update: (nextView: any, prevState: any) => {
          if (!docsEqual(nextView?.state?.doc, prevState?.doc) || nextView?.state?.selection !== prevState?.selection) {
            syncLocalSelection(nextView);
          }
        },
        destroy: () => {
          awareness?.off?.("update", handleAwarenessUpdate);
          awareness?.setLocalStateField?.("selection", null);
        },
      };
    },
  });
