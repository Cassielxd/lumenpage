// 视图坐标相关辅助：事件坐标换算、偏移钳制、坐标到文档位置映射。
export const createCoordinateHelpers = ({
  dom,
  getLayout,
  getText,
  getState,
  textOffsetToDocPos,
  posAtCoords,
}) => {
  // 将浏览器事件坐标转换为滚动容器内坐标。
  const getEventCoords = (event) => {
    const rect = dom.scrollArea.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  // 文本偏移安全钳制（避免越界）。
  const clampOffset = (offset) => {
    const length = getText().length;
    return Math.max(0, Math.min(offset, length));
  };

  // 局部坐标映射为文档位置。
  const getDocPosFromCoords = (coords) => {
    const layout = getLayout();
    if (!layout) {
      return null;
    }
    const offset = posAtCoords(
      layout,
      coords.x,
      coords.y,
      dom.scrollArea.scrollTop,
      dom.scrollArea.clientWidth,
      getText().length
    );
    if (offset == null) {
      return null;
    }
    return textOffsetToDocPos(getState().doc, offset);
  };

  return {
    getEventCoords,
    clampOffset,
    getDocPosFromCoords,
  };
};
