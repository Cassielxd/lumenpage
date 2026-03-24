import { Node } from "lumenpage-core";
import { embedPanelRenderer } from "./renderer";
import { embedPanelNodeSpec, resolveEmbedPanelDefaultSize } from "./embedPanel";

export { embedPanelNodeSpec, resolveEmbedPanelDefaultSize, serializeEmbedPanelToText } from "./embedPanel";
export { embedPanelRenderer } from "./renderer";

const resolvePositiveDimension = (value: unknown) => {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const insertEmbedPanelCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.embedPanel;
    if (!type) {
      return false;
    }
    const source = String(attrs?.source || "").trim();
    if (!source) {
      return false;
    }
    const kind = String(attrs?.kind || "diagram").trim() || "diagram";
    const defaultSize = resolveEmbedPanelDefaultSize(kind);
    const node = type.create({
      kind,
      title: String(attrs?.title || "").trim(),
      source,
      width: resolvePositiveDimension(attrs?.width) ?? defaultSize.width,
      height: resolvePositiveDimension(attrs?.height) ?? defaultSize.height,
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const EmbedPanel = Node.create({
  name: "embedPanel",
  priority: 100,
  schema: embedPanelNodeSpec,
  layout() {
    return {
      renderer: embedPanelRenderer,
    };
  },
  addCommands() {
    return {
      insertEmbedPanel: (attrs?: Record<string, unknown>) => insertEmbedPanelCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["embedPanel"],
    };
  },
});

export default EmbedPanel;
