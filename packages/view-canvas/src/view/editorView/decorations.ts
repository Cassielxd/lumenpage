import { DecorationSet } from "../decorations";

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

// 组合 props/plugin/拖拽光标等装饰来源。
export const createDecorationResolver = ({
  viewProps,
  getEditorPropsList,
  getDropDecoration,
  getState,
}) => {
  const getDecorations = () => {
    const state = getState?.();
    const items = [];

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

    return items.length > 0 ? items : null;
  };

  return { getDecorations };
};

