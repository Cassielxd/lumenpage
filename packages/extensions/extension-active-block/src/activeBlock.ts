import { NodeSelection, Plugin } from "lumenpage-state";
import { Decoration, DecorationSet } from "lumenpage-view-canvas";

export type ActiveBlockPluginOptions = {
  includeTypes?: string[];
  excludeTypes?: string[];
  backgroundColor?: string | null;
  borderColor?: string;
  borderWidth?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
};

const DEFAULT_ACTIVE_BLOCK_BACKGROUND = "rgba(59, 230, 246, 0.12)";
const DEFAULT_ACTIVE_BLOCK_BORDER_COLOR = "rgba(59, 230, 246, 0.8)";

const resolveOptionalNumber = (value: unknown) =>
  Number.isFinite(value) ? Number(value) : undefined;

const resolveOptionalColor = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveActiveTopLevelRange = (state: any) => {
  const selection = state?.selection;
  if (!selection || !state?.doc) {
    return null;
  }
  // Keep previous behavior: only collapsed selection and NodeSelection show active block outline.
  if (!(selection instanceof NodeSelection) && !selection.empty) {
    return null;
  }

  let $pos = selection.$from;
  if (selection instanceof NodeSelection) {
    const probePos = Math.min(state.doc.content.size, selection.from + 1);
    try {
      $pos = state.doc.resolve(probePos);
    } catch (_error) {
      return null;
    }
  }

  if (!$pos || $pos.depth < 1) {
    return null;
  }

  const node = $pos.node(1);
  if (!node) {
    return null;
  }

  const from = $pos.start(1) - 1;
  const to = from + node.nodeSize;
  return { node, from, to };
};

const createActiveBlockDecorations = (state: any, options: ActiveBlockPluginOptions) => {
  const range = resolveActiveTopLevelRange(state);
  if (!range) {
    return null;
  }

  const includeTypes = Array.isArray(options.includeTypes) ? options.includeTypes : null;
  const excludeTypes = Array.isArray(options.excludeTypes)
    ? options.excludeTypes
    : ["table", "image", "video", "audio", "embedPanel", "file", "bookmark", "signature", "webPage"];
  const typeName = range.node?.type?.name;

  if (includeTypes && !includeTypes.includes(typeName)) {
    return null;
  }
  if (excludeTypes && excludeTypes.includes(typeName)) {
    return null;
  }

  const backgroundColor =
    options.backgroundColor === null
      ? undefined
      : resolveOptionalColor(options.backgroundColor) ?? DEFAULT_ACTIVE_BLOCK_BACKGROUND;
  const borderWidth = resolveOptionalNumber(options.borderWidth);
  const borderTopWidth = resolveOptionalNumber(options.borderTopWidth) ?? borderWidth;
  const borderRightWidth = resolveOptionalNumber(options.borderRightWidth) ?? borderWidth;
  const borderBottomWidth = resolveOptionalNumber(options.borderBottomWidth) ?? borderWidth;
  const borderLeftWidth = resolveOptionalNumber(options.borderLeftWidth) ?? borderWidth;
  const hasBorder =
    borderTopWidth != null ||
    borderRightWidth != null ||
    borderBottomWidth != null ||
    borderLeftWidth != null;
  const borderColor = hasBorder
    ? resolveOptionalColor(options.borderColor) ?? DEFAULT_ACTIVE_BLOCK_BORDER_COLOR
    : undefined;
  const blockId =
    range.node?.attrs && typeof range.node.attrs === "object" && range.node.attrs.id != null
      ? String(range.node.attrs.id)
      : null;
  const nodeType = typeof typeName === "string" && typeName.length > 0 ? typeName : null;

  return DecorationSet.create(state.doc, [
    Decoration.node(
      range.from,
      range.to,
      {
        backgroundColor,
        borderColor,
        borderWidth: borderWidth ?? undefined,
        borderTopWidth,
        borderRightWidth,
        borderBottomWidth,
        borderLeftWidth,
        blockId,
        nodeType,
        blockOutline: true,
      } as any
    ),
  ]);
};

// Active block outline plugin. Visual behavior is fully driven by decorations.
export const createActiveBlockSelectionPlugin = (options: ActiveBlockPluginOptions = {}) =>
  new Plugin({
    state: {
      init: (_config: any, state: any) => createActiveBlockDecorations(state, options),
      apply: (_tr: any, _value: any, _oldState: any, newState: any) =>
        createActiveBlockDecorations(newState, options),
    },
    props: {
      decorations(state: any) {
        return (this as any).getState(state) || null;
      },
    },
  });
