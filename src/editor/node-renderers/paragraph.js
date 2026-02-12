/*
 * 文件说明：段落节点渲染器。
 * 主要职责：将段落文本转为 runs，并走默认行渲染逻辑。
 */

import { textblockToRuns } from "../../layout/textRuns.js";

export const paragraphRenderer = {
  toRuns(node, settings) {
    return textblockToRuns(node, settings, node.type.name, null, node.attrs);
  },
  renderLine({ defaultRender, line, pageX, pageTop, layout }) {
    defaultRender(line, pageX, pageTop, layout);
  },
};
