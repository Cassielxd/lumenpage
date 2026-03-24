import { Node } from "lumenpage-core";
import { textBoxRenderer } from "./renderer";
import { textBoxNodeSpec } from "./textBox";

export { textBoxNodeSpec, serializeTextBoxToText } from "./textBox";
export { textBoxRenderer } from "./renderer";

const insertTextBoxCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.textBox;
    if (!type) {
      return false;
    }
    const text = String(attrs?.text || "").trim();
    if (!text) {
      return false;
    }
    const node = type.create({
      title: String(attrs?.title || "").trim(),
      text,
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const TextBox = Node.create({
  name: "textBox",
  priority: 100,
  schema: textBoxNodeSpec,
  layout() {
    return {
      renderer: textBoxRenderer,
    };
  },
  addCommands() {
    return {
      insertTextBox: (attrs?: Record<string, unknown>) => insertTextBoxCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["textBox"],
    };
  },
});

export default TextBox;
