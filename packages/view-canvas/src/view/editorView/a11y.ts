import { getLineAtOffset } from "../layoutIndex";

// 生成 a11y 状态更新函数，负责播报光标/选区位置。
export const createA11yStatusUpdater = ({
  a11yStatus,
  getState,
  getLayoutIndex,
  docPosToTextOffset,
}) => {
  return () => {
    if (!a11yStatus) {
      return;
    }
    const state = getState?.();
    const selection = state?.selection;
    if (!selection || !state?.doc) {
      a11yStatus.textContent = "";
      return;
    }
    const from = selection.from;
    const to = selection.to;
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return;
    }

    // 单点光标：优先输出行/列信息。
    if (from === to) {
      const offset = docPosToTextOffset(state.doc, from);
      const layoutIndex = getLayoutIndex?.() ?? null;
      const lineInfo = layoutIndex ? getLineAtOffset(layoutIndex, offset) : null;
      if (lineInfo?.line) {
        const column = Math.max(1, offset - lineInfo.line.start + 1);
        a11yStatus.textContent = `Cursor at line ${lineInfo.lineIndex + 1}, column ${column}`;
        return;
      }
      a11yStatus.textContent = `Cursor at offset ${offset}`;
      return;
    }

    // 选区：仅播报长度，避免过长文本。
    const length = Math.abs(to - from);
    a11yStatus.textContent = `Selection ${length} characters`;
  };
};
