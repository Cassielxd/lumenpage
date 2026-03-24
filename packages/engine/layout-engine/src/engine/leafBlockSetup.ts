import { resolveSettingsWithIndent } from "./lineLayout";

type ResolveLeafBlockSetupOptions = {
  block: any;
  registry: any;
  baseSettings: any;
  indent: number;
  blockSpacing: number;
  containerStack: any[];
};

const hasModernPaginationProtocol = (renderer: any) =>
  typeof renderer?.measureBlock === "function" || typeof renderer?.paginateBlock === "function";

/**
 * 为叶子块准备 renderer、缩进后的布局设置以及块前后间距。
 * 当前运行链要求 leaf renderer 直接暴露 modern 分页协议。
 */
export function resolveLeafBlockSetup({
  block,
  registry,
  baseSettings,
  indent,
  blockSpacing,
  containerStack,
}: ResolveLeafBlockSetupOptions) {
  const renderer = registry?.get(block.type.name);

  if (renderer && !hasModernPaginationProtocol(renderer)) {
    throw new Error(
      `[pagination-modernization] Leaf renderer \"${block.type?.name || "unknown"}\" must implement measureBlock/paginateBlock.`,
    );
  }

  const blockSettings = resolveSettingsWithIndent(baseSettings, indent);
  const blockTypeName = block.type?.name;
  const isTopLevel = !containerStack || containerStack.length === 0;
  const rendererSpacing =
    typeof renderer?.getBlockSpacing === "function"
      ? renderer.getBlockSpacing({
          node: block,
          settings: blockSettings,
          registry,
          indent,
          isTopLevel,
          containerStack: containerStack || [],
        })
      : null;

  const blockAttrs = block.attrs || null;
  const spacingBefore = Number.isFinite(blockAttrs?.spacingBefore)
    ? blockAttrs.spacingBefore
    : Number.isFinite(rendererSpacing?.before)
      ? Number(rendererSpacing.before)
      : blockSpacing;
  const spacingAfter = Number.isFinite(blockAttrs?.spacingAfter)
    ? blockAttrs.spacingAfter
    : Number.isFinite(rendererSpacing?.after)
      ? Number(rendererSpacing.after)
      : blockSpacing;

  return {
    blockId: block.attrs?.id ?? null,
    blockTypeName,
    renderer,
    blockSettings,
    blockAttrs,
    spacingBefore,
    spacingAfter,
  };
}

/**
 * 当增量布局从锚点恢复时，把当前光标纠正到锚点块应该出现的位置。
 */
export function applyResumeAnchorToLeafBlock(options: {
  resumeFromAnchor: boolean;
  resumeAnchorApplied: boolean;
  rootIndex: number | null | undefined;
  startBlockIndex: number;
  resumeAnchorTargetY: { y: number; relativeY: number } | null;
  spacingBefore: number;
  marginTop: number;
  cursorY: number;
}) {
  if (
    !options.resumeFromAnchor ||
    options.resumeAnchorApplied ||
    options.rootIndex !== options.startBlockIndex
  ) {
    return {
      cursorY: options.cursorY,
      resumeAnchorApplied: options.resumeAnchorApplied,
    };
  }

  if (!options.resumeAnchorTargetY || !Number.isFinite(options.resumeAnchorTargetY.y)) {
    return {
      cursorY: options.cursorY,
      resumeAnchorApplied: options.resumeAnchorApplied,
    };
  }

  const relativeY = Number.isFinite(options.resumeAnchorTargetY.relativeY)
    ? options.resumeAnchorTargetY.relativeY
    : 0;
  return {
    cursorY: Math.max(options.marginTop, options.resumeAnchorTargetY.y - options.spacingBefore - relativeY),
    resumeAnchorApplied: true,
  };
}
