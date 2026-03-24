import { Node } from "lumenpage-core";
import { sanitizeAudioSrc } from "lumenpage-link";
import { createDefaultAudioNodeView } from "./nodeView";
import { audioRenderer } from "./renderer";
import { audioNodeSpec } from "./audio";

export { audioNodeSpec, serializeAudioToText } from "./audio";
export { audioRenderer } from "./renderer";

const insertAudioCommand =
  (attrs: Record<string, unknown> | null | undefined = {}) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = state?.schema?.nodes?.audio;
    if (!type) {
      return false;
    }
    const src = sanitizeAudioSrc(attrs?.src || "");
    if (!src) {
      return false;
    }
    const node = type.create({
      src,
      title: String(attrs?.title || "").trim(),
      width: Number.isFinite(attrs?.width) ? Number(attrs.width) : null,
    });
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };

export const Audio = Node.create({
  name: "audio",
  priority: 100,
  schema: audioNodeSpec,
  addNodeView() {
    return createDefaultAudioNodeView;
  },
  layout() {
    return {
      renderer: audioRenderer,
    };
  },
  addCommands() {
    return {
      insertAudio: (attrs?: Record<string, unknown>) => insertAudioCommand(attrs),
    };
  },
  canvas() {
    return {
      nodeSelectionTypes: ["audio"],
    };
  },
});

export default Audio;
