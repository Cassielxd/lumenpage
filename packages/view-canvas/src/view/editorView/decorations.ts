import { DecorationSet } from "../decorations";
import { createRemoteSelectionDecorations } from "../collaboration";

// 统一推入装饰数据（DecorationSet 或数组）。
const pushDecorations = (target, decorations) => {
  if (!decorations) {
    return;
  }
  if (decorations instanceof DecorationSet) {
    target.push(...decorations.decorations);
    return;
  }
  if (Array.isArray(decorations)) {
    target.push(...decorations);
  }
};

// 支持函数/静态两种装饰来源。
const resolveDecorations = (value, state) => {
  if (typeof value === "function") {
    return value(state);
  }
  return value;
};

// 组合 props/plugin/拖拽光标/协作光标等装饰来源。
export const createDecorationResolver = ({
  viewProps,
  collaborationConfig,
  remoteSelections,
  settings,
  getEditorPropsList,
  getDropDecoration,
  getState,
}) => {
  const resolveRemoteSelections = (state) => {
    const config = collaborationConfig || {};
    if (config?.enabled === false) {
      return [];
    }
    const selections = config?.selections ?? remoteSelections ?? [];
    if (!Array.isArray(selections) || selections.length === 0) {
      return [];
    }
    return createRemoteSelectionDecorations(selections, {
      lineHeight: settings.lineHeight,
      selectionOpacity: config.selectionOpacity ?? settings?.collaboration?.selectionOpacity,
      cursorWidth: config.cursorWidth ?? settings?.collaboration?.cursorWidth,
      labelFont: config.labelFont ?? settings?.collaboration?.labelFont,
    });
  };

  const getDecorations = () => {
    const state = getState?.();
    const items = [];
    pushDecorations(items, resolveDecorations(viewProps?.decorations, state));

    // 插件级装饰合并。
    const propSources = getEditorPropsList?.(state) ?? [];
    for (const prop of propSources) {
      if (prop?.decorations) {
        pushDecorations(items, resolveDecorations(prop.decorations, state));
      }
    }

    // 拖拽落点光标。
    const dropDecoration = getDropDecoration?.();
    if (dropDecoration) {
      items.push(dropDecoration);
    }

    // 协作光标与选区。
    const remoteDecorations = resolveRemoteSelections(state);
    if (remoteDecorations.length > 0) {
      items.push(...remoteDecorations);
    }

    return items.length > 0 ? items : null;
  };

  return { getDecorations };
};
