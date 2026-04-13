import { DecorationSet } from "../decorations.js";

// ͳһ����װ�����ݣ�DecorationSet �����飩��
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

// ֧�ֺ���/��̬����װ����Դ��
const resolveDecorations = (value, state) => {
  if (typeof value === "function") {
    return value(state);
  }
  return value;
};

// ��� props/plugin/��ק����װ����Դ��
export const createDecorationResolver = ({
  viewProps,
  getEditorPropsList,
  getDropDecoration,
  getState,
}) => {
  const getDecorations = () => {
    const state = getState?.();
    const items = [];

    // �����װ�κϲ���
    const propSources = getEditorPropsList?.(state) ?? [];
    for (const prop of propSources) {
      if (prop?.decorations) {
        pushDecorations(items, resolveDecorations(prop.decorations, state));
      }
    }

    // ��ק����ꡣ
    const dropDecoration = getDropDecoration?.();
    if (dropDecoration) {
      items.push(dropDecoration);
    }

    return items.length > 0 ? items : null;
  };

  return { getDecorations };
};

