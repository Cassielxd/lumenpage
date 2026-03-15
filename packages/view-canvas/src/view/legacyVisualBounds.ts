const toFiniteNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const resolveLegacyLineVisualBounds = (line: any) => {
  const x = toFiniteNumber(line?.blockAttrs?.codeBlockOuterX);
  const width = toFiniteNumber(line?.blockAttrs?.codeBlockOuterWidth);
  if (x == null && width == null) {
    return null;
  }
  return { x, width };
};
