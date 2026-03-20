const readPositiveDimension = (value: unknown) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) && nextValue > 0 ? Math.round(nextValue) : null;
};

export const resolveImageDimensions = (src: string) =>
  new Promise<{ width: number; height: number } | null>((resolve) => {
    const image = new Image();
    let settled = false;
    let timeoutId: number | null = null;

    const finish = (value: { width: number; height: number } | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      resolve(value);
    };

    image.onload = () => {
      const width = readPositiveDimension(image.naturalWidth);
      const height = readPositiveDimension(image.naturalHeight);
      finish(width && height ? { width, height } : null);
    };

    image.onerror = () => {
      finish(null);
    };

    timeoutId = window.setTimeout(() => {
      const width = readPositiveDimension(image.naturalWidth);
      const height = readPositiveDimension(image.naturalHeight);
      finish(width && height ? { width, height } : null);
    }, 4000);

    image.src = src;
    const width = readPositiveDimension(image.naturalWidth);
    const height = readPositiveDimension(image.naturalHeight);
    if (image.complete && width && height) {
      finish({ width, height });
    }
  });

export const resolveImageInsertAttrs = async (attrs: Record<string, unknown>) => {
  const src = String(attrs?.src || "").trim();
  if (!src) {
    return attrs;
  }
  const width = readPositiveDimension(attrs?.width);
  const height = readPositiveDimension(attrs?.height);
  if (width && height) {
    return attrs;
  }
  const resolved = await resolveImageDimensions(src);
  if (!resolved) {
    return attrs;
  }
  return {
    ...attrs,
    width: width ?? resolved.width,
    height: height ?? resolved.height,
  };
};
