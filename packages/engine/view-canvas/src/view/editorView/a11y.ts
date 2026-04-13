import { getLineAtOffset } from "../layoutIndex.js";

// 生成 a11y 状态更新函数，负责播报光标/选区位置。
export const createA11yStatusUpdater = ({
  a11yStatus,
  getState,
  getLayoutIndex,
  docPosToTextOffset,
}) => {
  const normalizeBlockType = (blockType: any) => {
    if (typeof blockType !== "string" || blockType.trim().length === 0) {
      return null;
    }
    return blockType.replace(/_/g, " ");
  };

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
        const page = Number.isFinite(lineInfo.pageIndex) ? lineInfo.pageIndex + 1 : null;
        const lineNumber = Number.isFinite(lineInfo.lineIndex) ? lineInfo.lineIndex + 1 : null;
        const lineStart = Number.isFinite(lineInfo.start) ? Number(lineInfo.start) : 0;
        const column = Math.max(1, offset - lineStart + 1);
        const blockType = normalizeBlockType(lineInfo.line.blockType);
        const blockTypeText = blockType ? `, node ${blockType}` : "";
        if (Number.isFinite(page) && Number.isFinite(lineNumber)) {
          a11yStatus.textContent = `Cursor at page ${page}, line ${lineNumber}, column ${column}${blockTypeText}`;
          return;
        }
        a11yStatus.textContent = `Cursor at line ${lineInfo.lineIndex + 1}, column ${column}${blockTypeText}`;
        return;
      }
      a11yStatus.textContent = `Cursor at offset ${offset}`;
      return;
    }

    // 选区：仅播报长度，避免过长文本。
    const fromOffset = docPosToTextOffset(state.doc, from);
    const toOffset = docPosToTextOffset(state.doc, to);
    const rangeStart = Math.min(fromOffset, toOffset);
    const rangeEnd = Math.max(fromOffset, toOffset);
    const length = Math.max(0, rangeEnd - rangeStart);
    const layoutIndex = getLayoutIndex?.() ?? null;
    const startLineInfo = layoutIndex ? getLineAtOffset(layoutIndex, rangeStart) : null;
    const endLineInfo = layoutIndex ? getLineAtOffset(layoutIndex, rangeEnd) : null;
    if (startLineInfo?.line && endLineInfo?.line) {
      const startLineStart = Number.isFinite(startLineInfo.start) ? Number(startLineInfo.start) : 0;
      const endLineStart = Number.isFinite(endLineInfo.start) ? Number(endLineInfo.start) : 0;
      const startColumn = Math.max(1, rangeStart - startLineStart + 1);
      const endColumn = Math.max(1, rangeEnd - endLineStart + 1);
      const startPage = Number.isFinite(startLineInfo.pageIndex) ? startLineInfo.pageIndex + 1 : null;
      const endPage = Number.isFinite(endLineInfo.pageIndex) ? endLineInfo.pageIndex + 1 : null;
      if (Number.isFinite(startPage) && Number.isFinite(endPage)) {
        a11yStatus.textContent =
          `Selection ${length} characters from page ${startPage}, line ${startLineInfo.lineIndex + 1}, column ${startColumn} ` +
          `to page ${endPage}, line ${endLineInfo.lineIndex + 1}, column ${endColumn}`;
        return;
      }
    }
    a11yStatus.textContent = `Selection ${length} characters`;
  };
};
