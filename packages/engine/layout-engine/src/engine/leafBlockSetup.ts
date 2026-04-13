import { resolveSettingsWithIndent } from "./lineLayout.js";

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
 * ΪҶ�ӿ�׼�� renderer��������Ĳ��������Լ���ǰ���ࡣ
 * ��ǰ������Ҫ�� leaf renderer ֱ�ӱ�¶ modern ��ҳЭ�顣
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
 * ���������ִ�ê��ָ�ʱ���ѵ�ǰ��������ê���Ӧ�ó��ֵ�λ�á�
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
