export type LayoutCapabilityFlags = Record<string, boolean>;

export type LayoutPageRuntimeMeta = {
  reused?: boolean;
  sourcePageIndex?: number | null;
  pageOffsetDelta?: number | null;
  signature?: number | null;
  signatureVersion?: number | null;
  layoutVersionToken?: number | null;
};

export type LayoutResultRuntimeMeta = {
  layoutVersion?: number | null;
  progressiveApplied?: boolean;
  progressiveTruncated?: boolean;
  paginationDiagnostics?: unknown;
  ghostTrace?: unknown[] | null;
  changeSummary?: unknown;
  forceRedraw?: boolean;
  layoutPerfSummary?: LayoutPerfSummary | null;
  workerDebug?: LayoutWorkerDebugInfo | null;
  transportPerf?: LayoutTransportPerf | null;
};

export type LayoutPerfSummary = Record<string, unknown> & {
  reusedPages?: number | null;
  reuseReason?: string | null;
  disablePageReuse?: boolean | null;
  maybeSyncReason?: string | null;
  syncAfterIndex?: number | null;
  syncFromIndex?: number | null;
  reusedPrefixPages?: number | null;
  reusedPrefixLines?: number | null;
};

export type LayoutWorkerDebugInfo = Record<string, unknown> & {
  clientHadSeedLayout?: boolean | null;
  clientSentSeedLayout?: boolean | null;
  clientSettingsChanged?: boolean | null;
  clientPrevPages?: number | null;
  workerHadPreviousLayoutState?: boolean | null;
  workerPrevPagesBeforeSeed?: number | null;
  workerPrevPagesAfterSeed?: number | null;
  workerNextPages?: number | null;
};

export type LayoutTransportPerf = Record<string, number>;

export type LayoutSettingsPerfState = Record<string, unknown> & {
  layout?: LayoutPerfSummary | null;
};

export type LayoutSettingsRuntimeState = {
  perf?: LayoutSettingsPerfState | null;
};

export type LayoutLineFragmentOwner = {
  meta?: {
    layoutCapabilities?: LayoutCapabilityFlags | null;
  } | null;
};

export type LayoutLineBlockAttrs = {
  layoutCapabilities?: LayoutCapabilityFlags | null;
  sliceFromPrev?: boolean | null;
  sliceHasNext?: boolean | null;
  sliceRowSplit?: boolean | null;
};

export type LayoutLine = {
  start?: number | null;
  end?: number | null;
  blockType?: string | null;
  blockId?: string | null;
  rootIndex?: number | null;
  blockSignature?: number | null;
  blockStart?: number | null;
  containers?: unknown;
  blockAttrs?: LayoutLineBlockAttrs | null;
  fragmentOwners?: LayoutLineFragmentOwner[] | null;
};

export type LayoutPage = {
  lines: LayoutLine[];
  boxes?: any[];
  fragments?: any[];
  rootIndexMin?: number | null;
  rootIndexMax?: number | null;
  runtimeMeta?: LayoutPageRuntimeMeta | null;
  __pageOffsetDelta?: number | null;
};

export type LayoutPositionRange = {
  from?: number | null;
  to?: number | null;
};

export type LayoutBlockIndexRange = {
  fromIndex?: number | null;
  toIndex?: number | null;
};

/**
 * 描述一次文档变更影响范围，供增量分页与页复用判断使用。
 */
export type LayoutChangeSummary = {
  docChanged?: boolean;
  oldRange?: LayoutPositionRange;
  newRange?: LayoutPositionRange;
  blocks?: {
    before?: LayoutBlockIndexRange;
    after?: LayoutBlockIndexRange;
  };
};

export type LayoutSettingsMargin = {
  left?: number | null;
  right?: number | null;
  top?: number | null;
  bottom?: number | null;
};

export type LayoutSettingsLike = {
  pageWidth?: number | null;
  pageHeight?: number | null;
  pageGap?: number | null;
  margin?: LayoutSettingsMargin | null;
  lineHeight?: number | null;
  font?: string | null;
  codeFont?: string | null;
  wrapTolerance?: number | null;
  minLineWidth?: number | null;
  blockSpacing?: number | null;
  paragraphSpacingBefore?: number | null;
  paragraphSpacingAfter?: number | null;
  listIndent?: number | null;
  listMarkerGap?: number | null;
  listMarkerFont?: string | null;
  codeBlockPadding?: number | null;
  textLocale?: string | null;
  segmentText?: boolean | null;
  disablePageReuse?: boolean | null;
  runtimeState?: LayoutSettingsRuntimeState | null;
};

export type TopLevelIndexableDoc = {
  childCount?: number | null;
  child?: (index: number) => unknown;
};

/**
 * 描述整次布局的最终结果，包含页面集合与分页基础参数。
 */
export type LayoutResult = {
  pages: LayoutPage[];
  pageHeight: number;
  pageWidth: number;
  pageGap: number;
  margin: { left: number; right: number; top: number; bottom: number };
  lineHeight: number;
  font: string;
  totalHeight: number;
  runtimeMeta?: LayoutResultRuntimeMeta | null;
};

/**
 * 描述从编辑文档重新布局时可选的上下文参数。
 */
export type LayoutFromDocOptions = {
  previousLayout?: LayoutResult | null;
  changeSummary?: LayoutChangeSummary | null;
  docPosToTextOffset?: (doc: TopLevelIndexableDoc | null | undefined, pos: number) => number;
  layoutSettingsOverride?: Record<string, any> | null;
  cascadePagination?: boolean;
  cascadeFromPageIndex?: number | null;
};
