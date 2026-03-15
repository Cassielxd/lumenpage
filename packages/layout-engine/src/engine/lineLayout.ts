/**
 * 复制单条布局行，并补齐容器与 fragment owner 的浅拷贝。
 */
export function cloneLine(line: any) {
  return {
    ...line,
    runs: line.runs,
    containers: Array.isArray(line?.containers)
      ? line.containers.map((container: any) => ({ ...container }))
      : line.containers,
    fragmentOwners: Array.isArray(line?.fragmentOwners)
      ? line.fragmentOwners.map((owner: any) => ({
          ...owner,
          meta:
            owner?.meta && typeof owner.meta === "object"
              ? { ...owner.meta }
              : owner?.meta ?? null,
        }))
      : line.fragmentOwners,
  };
}

/**
 * 计算单条布局行的最终绘制横坐标，包含对齐与首行缩进。
 */
export function computeLineX(line: any, settings: any) {
  const { pageWidth, margin } = settings;
  const maxWidth = pageWidth - margin.left - margin.right;
  const align = line.blockAttrs?.align || "left";
  const indent = line.blockAttrs?.indent || 0;
  let x = margin.left;

  if (align === "center") {
    x += Math.max(0, (maxWidth - line.width) / 2);
  } else if (align === "right") {
    x += Math.max(0, maxWidth - line.width);
  }

  if (indent && line.blockStart === line.start) {
    x += indent;
  }

  return x;
}

/**
 * 把相对 block 的文本偏移转换成文档绝对偏移。
 */
export function adjustLineOffsets(line: any, blockStart: number) {
  if (typeof line.start === "number") {
    line.start += blockStart;
  }

  if (typeof line.end === "number") {
    line.end += blockStart;
  }

  if (Number.isFinite(blockStart) && Number(blockStart) !== 0) {
    const baseDelta = Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0;
    line.__offsetDelta = baseDelta + Number(blockStart);
  }

  if (Number.isFinite(blockStart) && Number.isFinite(line?.blockStart)) {
    line.blockStart += blockStart;
  } else if (line.blockStart == null) {
    line.blockStart = blockStart;
  }

  return line;
}

/**
 * 把 fragment owner 的局部位置转换成 block 绝对位置。
 */
export function adjustFragmentOwners(owners: any[], blockStart: number, blockY: number) {
  if (!Array.isArray(owners) || owners.length === 0) {
    return owners;
  }
  return owners.map((owner) => {
    if (!owner || typeof owner !== "object") {
      return owner;
    }
    const next = {
      ...owner,
      meta:
        owner?.meta && typeof owner.meta === "object" ? { ...owner.meta } : owner?.meta ?? null,
    };
    if (typeof next.key === "string" && next.key.length > 0) {
      next.key = `${next.key}@${blockStart}`;
    }
    if (Number.isFinite(next.start)) {
      next.start = Number(next.start) + blockStart;
    }
    if (Number.isFinite(next.end)) {
      next.end = Number(next.end) + blockStart;
    }
    if (Number.isFinite(next.anchorOffset)) {
      next.anchorOffset = Number(next.anchorOffset) + blockStart;
    }
    if (Number.isFinite(next.y)) {
      next.y = Number(next.y) + blockY;
    }
    return next;
  });
}

/**
 * 在不修改原设置对象的前提下，为当前缩进层级生成新的布局设置。
 */
export function resolveSettingsWithIndent(settings: any, indent: number) {
  if (!indent) {
    return settings;
  }
  return {
    ...settings,
    margin: {
      ...settings.margin,
      left: settings.margin.left + indent,
    },
  };
}

/**
 * 读取单行的最终行高，缺失时回退到默认行高。
 */
export function resolveLineHeight(line: any, fallback: number) {
  return Number.isFinite(line?.lineHeight) && Number(line.lineHeight) > 0
    ? Number(line.lineHeight)
    : Math.max(1, Number(fallback) || 1);
}

/**
 * 统计一组布局行的总高度，兼容显式 `relativeY` 的情况。
 */
export function measureLinesHeight(lines: any[], fallbackLineHeight: number) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let usedRelativeY = false;
  let maxBottom = 0;
  let cursor = 0;
  for (const line of lines) {
    const lineHeight = resolveLineHeight(line, fallbackLineHeight);
    if (Number.isFinite(line?.relativeY)) {
      usedRelativeY = true;
      maxBottom = Math.max(maxBottom, Number(line.relativeY) + lineHeight);
      continue;
    }
    cursor += lineHeight;
  }
  return usedRelativeY ? maxBottom : cursor;
}

/**
 * 计算在给定可用高度内最多可以容纳多少行。
 */
export function getFittableLineCount(lines: any[], availableHeight: number, fallbackLineHeight: number) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  const limit = Number(availableHeight);
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }
  let consumed = 0;
  let count = 0;
  for (const line of lines) {
    const lineHeight = resolveLineHeight(line, fallbackLineHeight);
    if (count > 0 && consumed + lineHeight > limit) {
      break;
    }
    if (count === 0 && lineHeight > limit) {
      return 0;
    }
    consumed += lineHeight;
    count += 1;
  }
  return count;
}

/**
 * 把切片后的 `relativeY` 归一化到局部坐标系，保证续页从顶部开始布局。
 */
export function normalizeChunkRelativeY(lines: any[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return lines;
  }
  let base = null;
  for (const line of lines) {
    if (Number.isFinite(line?.relativeY)) {
      base = Number(line.relativeY);
      break;
    }
  }
  if (!Number.isFinite(base) || Number(base) === 0) {
    return lines;
  }
  return lines.map((line) => {
    if (!line || !Number.isFinite(line.relativeY)) {
      return line;
    }
    return {
      ...line,
      relativeY: Number(line.relativeY) - Number(base),
    };
  });
}
