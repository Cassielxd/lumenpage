/**
 * 描述一次文档变更影响范围，供增量分页与页复用判断使用。
 */
export type LayoutChangeSummary = {
  docChanged?: boolean;
  oldRange?: { from?: number | null; to?: number | null };
  newRange?: { from?: number | null; to?: number | null };
  blocks?: {
    before?: { fromIndex?: number | null; toIndex?: number | null };
    after?: { fromIndex?: number | null; toIndex?: number | null };
  };
};

/**
 * 描述整次布局的最终结果，包含页面集合与分页基础参数。
 */
export type LayoutResult = {
  pages: Array<{ lines: any[]; boxes?: any[]; fragments?: any[] }>;
  pageHeight: number;
  pageWidth: number;
  pageGap: number;
  margin: { left: number; right: number; top: number; bottom: number };
  lineHeight: number;
  font: string;
  totalHeight: number;
};

/**
 * 描述从 ProseMirror 文档重新布局时可选的上下文参数。
 */
export type LayoutFromDocOptions = {
  previousLayout?: LayoutResult | null;
  changeSummary?: LayoutChangeSummary | null;
  docPosToTextOffset?: (doc: any, pos: number) => number;
  layoutSettingsOverride?: Record<string, any> | null;
  cascadePagination?: boolean;
  cascadeFromPageIndex?: number | null;
};
