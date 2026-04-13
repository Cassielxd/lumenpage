const hashNumber = (hash: number, value: unknown) => {
  const num = Number.isFinite(value) ? Math.round(Number(value)) : 0;

  return (hash * 31 + num) | 0;
};

export const getRendererPageShellSignature = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => {
  let hash = 17;
  hash = hashNumber(hash, width);
  hash = hashNumber(hash, height);
  return hash >>> 0;
};
