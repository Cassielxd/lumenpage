import type { NodeLayoutResult, NodeLayoutSplitFragment, NodeRenderer } from "./node";

export type RendererFragmentModel = "none" | "continuation";

export const resolveRendererFragmentModel = (
  renderer: Pick<NodeRenderer, "pagination" | "splitBlock"> | null | undefined
): RendererFragmentModel =>
  renderer?.pagination?.fragmentModel || (renderer?.splitBlock ? "continuation" : "none");

const toSplitFragment = (
  fragment: Partial<NodeLayoutSplitFragment> | null | undefined,
  kind: "visible" | "overflow"
): NodeLayoutSplitFragment => ({
  kind,
  lines: Array.isArray(fragment?.lines) ? fragment.lines : [],
  length: Number.isFinite(fragment?.length) ? Math.max(0, Number(fragment.length)) : 0,
  height: Number.isFinite(fragment?.height) ? Math.max(0, Number(fragment.height)) : 0,
  continuation:
    fragment?.continuation && typeof fragment.continuation === "object"
      ? fragment.continuation
      : undefined,
});

export const resolveNodeSplitFragments = (
  splitResult: NodeLayoutResult | null | undefined
): {
  visible: NodeLayoutSplitFragment | null;
  overflow: NodeLayoutSplitFragment | null;
} => {
  if (!splitResult || typeof splitResult !== "object") {
    return { visible: null, overflow: null };
  }

  const explicitFragments = Array.isArray(splitResult.fragments) ? splitResult.fragments : null;
  if (explicitFragments && explicitFragments.length > 0) {
    const visible =
      explicitFragments.find((fragment) => fragment?.kind === "visible") || explicitFragments[0];
    const overflow = explicitFragments.find((fragment) => fragment?.kind === "overflow") || null;
    return {
      visible: visible ? toSplitFragment(visible, "visible") : null,
      overflow: overflow ? toSplitFragment(overflow, "overflow") : null,
    };
  }

  const visible = Array.isArray(splitResult.lines)
    ? toSplitFragment(
        {
          kind: "visible",
          lines: splitResult.lines,
          length: splitResult.length,
          height: splitResult.height,
          continuation: splitResult.continuation,
        },
        "visible"
      )
    : null;

  const overflow =
    splitResult.overflow &&
    (Array.isArray(splitResult.overflow.lines) ||
      Number.isFinite(splitResult.overflow.length) ||
      Number.isFinite(splitResult.overflow.height))
      ? toSplitFragment(splitResult.overflow, "overflow")
      : null;

  return {
    visible,
    overflow,
  };
};
