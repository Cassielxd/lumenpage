import { Node } from "lumenpage-core";
import { signatureRenderer } from "./renderer";
import { signatureNodeSpec } from "./signature";

export { signatureNodeSpec, serializeSignatureToText } from "./signature";
export { signatureRenderer } from "./renderer";

const insertSignatureCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.signature;
    if (!type) {
      return false;
    }
    const signer = String(attrs?.signer || attrs?.name || "").trim();
    if (!signer) {
      return false;
    }
    const node = type.create({
      signer,
      signedAt: String(attrs?.signedAt || "").trim(),
    });
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
  canvas() {
    return {
      nodeSelectionTypes: ["signature"],
    };
  },
});

export default Signature;
