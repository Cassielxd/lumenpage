export const matchAttributes = (
  attributes: Record<string, unknown> | null | undefined,
  expected: Record<string, unknown> | null | undefined
) => {
  const entries = Object.entries(expected || {});

  if (!entries.length) {
    return true;
  }

  return entries.every(([key, value]) => attributes?.[key] === value);
};
