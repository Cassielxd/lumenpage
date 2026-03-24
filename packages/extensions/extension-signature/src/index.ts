import { Node } from "lumenpage-core";
import { signatureRenderer } from "./renderer";
import { serializeSignatureToText, signatureNodeSpec } from "./signature";
import { createDefaultSignatureNodeView } from "./nodeView";

export { signatureNodeSpec, serializeSignatureToText } from "./signature";
export { signatureRenderer } from "./renderer";
export { createDefaultSignatureNodeView };

const insertSignatureCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.signature;
    if (!type) {
      return false;
    }
    const signer = String(attrs?.signer || attrs?.name || "").trim() || "Signer";
    const signedAt = String(attrs?.signedAt || new Date().toISOString().slice(0, 10)).trim();
    const src = String(attrs?.src || "").trim();
    if (!src) {
      return false;
    }
    const width = Number(attrs?.width) || undefined;
    const height = Number(attrs?.height) || undefined;
    const node = type.create({
      signer,
      signedAt,
      src,
      width,
      height,
      strokeWidth: Number(attrs?.strokeWidth) || undefined,
      strokeColor: String(attrs?.strokeColor || "#0f172a"),
      backgroundColor: String(attrs?.backgroundColor || "#ffffff"),
    });
    if (!node) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const Signature = Node.create({
  name: "signature",
  priority: 100,
  schema: signatureNodeSpec,
  layout() {
    return {
      renderer: signatureRenderer,
    };
  },
  addCommands() {
    return {
      insertSignature: (attrs?: Record<string, unknown>) => insertSignatureCommand(attrs),
    };
  },
  addNodeView() {
    return createDefaultSignatureNodeView;
  },
  canvas() {
    return {
      nodeSelectionTypes: ["signature"],
    };
  },
});

export default Signature;
