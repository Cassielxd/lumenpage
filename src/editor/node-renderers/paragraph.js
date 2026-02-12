import { textblockToRuns } from "../../layout/textRuns.js";

export const paragraphRenderer = {
  toRuns(node, settings) {
    return textblockToRuns(node, settings, node.type.name, null, node.attrs);
  },
  renderLine({ defaultRender, line, pageX, pageTop, layout }) {
    defaultRender(line, pageX, pageTop, layout);
  },
};
