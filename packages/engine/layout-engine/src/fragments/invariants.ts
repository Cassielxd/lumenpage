import type { NormalizedSplitFragments } from "./normalize.js";

export type SplitFragmentValidation = {
  ok: boolean;
  reason: string | null;
  totalLength: number;
};

export const validateNormalizedSplitFragments = (
  fragments: NormalizedSplitFragments | null | undefined,
  expectedLength?: number | null
): SplitFragmentValidation => {
  if (!fragments?.visible) {
    return {
      ok: false,
      reason: "missing-visible-fragment",
      totalLength: 0,
    };
  }

  const visible = fragments.visible;
  const overflow = fragments.overflow;
  const visibleLength = Number.isFinite(visible.length) ? Math.max(0, Number(visible.length)) : 0;
  const overflowLength =
    overflow && Number.isFinite(overflow.length) ? Math.max(0, Number(overflow.length)) : 0;
  const totalLength = visibleLength + overflowLength;

  if (visibleLength < 0 || overflowLength < 0) {
    return {
      ok: false,
      reason: "negative-fragment-length",
      totalLength,
    };
  }

  if (
    (!Array.isArray(visible.lines) || visible.lines.length === 0) &&
    (!Array.isArray(overflow?.lines) || overflow?.lines.length === 0)
  ) {
    return {
      ok: false,
      reason: "empty-fragments",
      totalLength,
    };
  }

  if (Number.isFinite(expectedLength) && Number(expectedLength) >= 0) {
    const expected = Number(expectedLength);
    if (totalLength > expected) {
      return {
        ok: false,
        reason: "fragment-length-overflow",
        totalLength,
      };
    }
  }

  return {
    ok: true,
    reason: null,
    totalLength,
  };
};
