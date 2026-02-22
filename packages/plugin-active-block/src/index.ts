import { NodeSelection, Plugin } from "lumenpage-state";
import { Decoration, DecorationSet } from "lumenpage-view-canvas";

type ActiveBlockPluginOptions = {
  includeTypes?: string[];
  excludeTypes?: string[];
  borderColor?: string;
  borderWidth?: number;
};

const resolveActiveTopLevelRange = (state: any) => {
  const selection = state?.selection;
  if (!selection || !state?.doc) {
    return null;
  }
  // 和原有行为保持一致：仅光标态 + NodeSelection 显示活动块边框。
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
  const excludeTypes = Array.isArray(options.excludeTypes) ? options.excludeTypes : ["table"];
  const typeName = range.node?.type?.name;

  if (includeTypes && !includeTypes.includes(typeName)) {
    return null;
  }
  if (excludeTypes && excludeTypes.includes(typeName)) {
    return null;
  }

  const borderColor = options.borderColor || "rgba(59, 130, 246, 0.8)";
  const borderWidth = Number.isFinite(options.borderWidth) ? options.borderWidth : 1;

  return DecorationSet.create(state.doc, [
    Decoration.node(
      range.from,
      range.to,
      {
        borderColor,
        borderWidth,
        backgroundColor: undefined,
        blockOutline: true,
      } as any
    ),
  ]);
};

// 活动块高亮插件：以 decorations 扩展“当前块边框”视觉，不耦合核心渲染逻辑。
export const createActiveBlockSelectionPlugin = (options: ActiveBlockPluginOptions = {}) =>
  new Plugin({
    state: {
      init: (_config: any, state: any) => createActiveBlockDecorations(state, options),
      apply: (_tr: any, _value: any, _oldState: any, newState: any) =>
        createActiveBlockDecorations(newState, options),
    },
    props: {
      // 关闭核心内置块高亮，完全由本插件接管活动块视觉。
      blockSelection: false,
      decorations(state: any) {
        return (this as any).getState(state) || null;
      },
    },
  });
