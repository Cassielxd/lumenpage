/*
 * 文件说明：标题节点渲染器。
 * 主要职责：根据标题级别调整字体与行高，并生成 runs。
 */

import { textblockToRuns } from "../../layout/textRuns.js";

const getHeadingStyle = (level, baseFont) => {
  const match = /(\d+(?:\.\d+)?)px\s+(.*)/.exec(baseFont);
  const baseSize = match ? Number.parseFloat(match[1]) : 16;
  const family = match ? match[2] : "Arial";
  const scale = level === 1 ? 1.6 : level === 2 ? 1.35 : 1.2;
  const size = Math.max(12, Math.round(baseSize * scale));
  return {
    font: `bold ${size}px ${family}`,
    lineHeight: Math.max(size + 8, size * 1.2),
  };
};

export const headingRenderer = {
  toRuns(node, settings) {
    const level = Math.max(1, Math.min(3, Number(node.attrs?.level) || 1));
    const { font, lineHeight } = getHeadingStyle(level, settings.font);
    const runs = textblockToRuns(node, { ...settings, font }, node.type.name, null, node.attrs);
    return { ...runs, blockAttrs: { ...node.attrs, lineHeight } };
  },
  renderLine({ defaultRender, line, pageX, pageTop, layout }) {
    defaultRender(line, pageX, pageTop, layout);
  },
};
