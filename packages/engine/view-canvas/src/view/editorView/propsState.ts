// 解析并应用 EditorProps 中的 attributes/editable（含插件 props 合并）。
export const createViewAttributeApplier = ({
  dom,
  getEditorPropsList,
  applyDefaultA11y,
}) => {
  // 合并 attributes（字符串 class 会拼接，其余后者覆盖前者）。
  const resolveAttributes = (state) => {
    const attrs = {};
    const mergedAttrs = attrs as Record<string, any>;
    const propsList = getEditorPropsList?.(state) ?? [];
    for (const props of propsList) {
      let value = props?.attributes;
      if (typeof value === "function") {
        value = value(state);
      }
      if (!value || typeof value !== "object") {
        continue;
      }
      const prevClass = typeof mergedAttrs.class === "string" ? mergedAttrs.class : "";
      Object.assign(mergedAttrs, value);
      if (typeof value.class === "string") {
        mergedAttrs.class = `${prevClass} ${value.class}`.trim();
      }
    }
    return mergedAttrs;
  };

  // 解析 editable（首个非 null 值生效，false 表示只读）。
  const resolveEditable = (state) => {
    const propsList = getEditorPropsList?.(state) ?? [];
    for (const props of propsList) {
      let value = props?.editable;
      if (typeof value === "function") {
        value = value(state);
      }
      if (value != null) {
        return value !== false;
      }
    }
    return true;
  };

  // 将合并结果写回 DOM 与 aria。
  const applyViewAttributes = (state) => {
    const attrs = resolveAttributes(state);
    applyDefaultA11y(dom, attrs);
    const editable = resolveEditable(state);
    dom.input.readOnly = !editable;
    dom.root.setAttribute("aria-readonly", editable ? "false" : "true");
  };

  return {
    resolveAttributes,
    resolveEditable,
    applyViewAttributes,
  };
};
