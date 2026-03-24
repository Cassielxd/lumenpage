import { materializePageGeometry } from "../pageGeometry";

/**
 * 创建一个新的页面对象，并初始化布局所需的基础字段。
 */
export function newPage(index: number) {
  return { index, lines: [], boxes: [], fragments: [], rootIndexMin: null, rootIndexMax: null };
}

/**
 * 统一补齐页面派生几何，确保 `boxes` 和 `fragments` 与 `lines` 同步。
 */
export function populatePageDerivedState(page: any, options: { force?: boolean } | undefined = undefined) {
  return materializePageGeometry(page, options);
}

/**
 * 批量标记复用页面，便于后续命中缓存与调试跟踪。
 */
export function markReusedPages<T>(pages: T[]) {
  if (!Array.isArray(pages)) {
    return pages;
  }
  for (const page of pages) {
    if (page) {
      (page as any).__reused = true;
    }
  }
  return pages;
}
