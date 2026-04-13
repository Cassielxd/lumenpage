import { readSliceContinuation } from "./continuation.js";

type SplitResultPayload = {
  lines: any[];
  length: number;
  height: number;
  overflow?:
    | {
        lines: any[];
        length: number;
        height: number;
      }
    | undefined;
};

export const buildSplitResultWithFragments = ({
  lines: visibleLines,
  length,
  height,
  overflow,
}: SplitResultPayload) => {
  const visible = {
    lines: Array.isArray(visibleLines) ? visibleLines : [],
    length: Number.isFinite(length) ? Math.max(0, length) : 0,
    height: Number.isFinite(height) ? Math.max(0, height) : 0,
  };
  const normalizedOverflow =
    overflow &&
    (Array.isArray(overflow.lines) ||
      Number.isFinite(overflow.length) ||
      Number.isFinite(overflow.height))
      ? {
          lines: Array.isArray(overflow.lines) ? overflow.lines : [],
          length: Number.isFinite(overflow.length) ? Math.max(0, overflow.length) : 0,
          height: Number.isFinite(overflow.height) ? Math.max(0, overflow.height) : 0,
        }
      : undefined;

  const fragments = [
    {
      kind: "visible",
      ...visible,
      continuation: readSliceContinuation(visible.lines, {
        hasNext: !!normalizedOverflow && normalizedOverflow.lines.length > 0,
      }),
    },
  ];

  if (normalizedOverflow) {
    fragments.push({
      kind: "overflow",
      ...normalizedOverflow,
      continuation: readSliceContinuation(normalizedOverflow.lines, {
        fromPrev: true,
      }),
    });
  }

  const result: any = {
    ...visible,
    fragments,
  };
  if (normalizedOverflow) {
    result.overflow = normalizedOverflow;
  }
  return result;
};
