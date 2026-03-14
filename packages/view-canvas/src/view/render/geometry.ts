const CONTENT_OWNER_ROLES = new Set(["list-item", "table-cell"]);

const toFiniteNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const getLayoutContentWidth = (layout: any) => {
  const pageWidth = toFiniteNumber(layout?.pageWidth);
  const marginLeft = toFiniteNumber(layout?.margin?.left) ?? 0;
  const marginRight = toFiniteNumber(layout?.margin?.right) ?? 0;
  if (pageWidth == null) {
    return 0;
  }
  return Math.max(0, pageWidth - marginLeft - marginRight);
};

export const getNearestContentOwner = (line: any) => {
  const owners = Array.isArray(line?.fragmentOwners) ? line.fragmentOwners : [];
  for (let index = owners.length - 1; index >= 0; index -= 1) {
    const owner = owners[index];
    if (CONTENT_OWNER_ROLES.has(owner?.role)) {
      return owner;
    }
  }
  return null;
};

export const resolveLineContentBox = (line: any, layout: any) => {
  const owner = getNearestContentOwner(line);
  const lineX = toFiniteNumber(line?.x) ?? toFiniteNumber(layout?.margin?.left) ?? 0;
  const blockOuterX = toFiniteNumber(line?.blockAttrs?.codeBlockOuterX);
  const blockOuterWidth = toFiniteNumber(line?.blockAttrs?.codeBlockOuterWidth);

  let x = blockOuterX ?? toFiniteNumber(owner?.x) ?? lineX;
  let width = blockOuterWidth ?? toFiniteNumber(owner?.width) ?? getLayoutContentWidth(layout);

  if (!(width > 0)) {
    const lineWidth = toFiniteNumber(line?.width);
    width = lineWidth ?? 0;
  }

  return {
    owner,
    x,
    width: Math.max(0, width || 0),
  };
};

export const resolveLineVisualBox = (line: any, layout: any) => {
  const contentBox = resolveLineContentBox(line, layout);
  const lineX = toFiniteNumber(line?.x) ?? contentBox.x;
  const lineWidth = Math.max(0, toFiniteNumber(line?.width) ?? 0);
  const outerX = toFiniteNumber(line?.blockAttrs?.codeBlockOuterX) ?? lineX;
  let outerWidth = toFiniteNumber(line?.blockAttrs?.codeBlockOuterWidth);

  if (!(outerWidth > 0)) {
    outerWidth = lineWidth > 0 ? lineWidth : contentBox.width;
  }

  return {
    owner: contentBox.owner,
    lineX,
    lineWidth,
    contentX: contentBox.x,
    contentWidth: contentBox.width,
    outerX,
    outerWidth: Math.max(0, outerWidth || 0),
  };
};

export const resolveEmptyLineWidth = (line: any, layout: any) => {
  const box = resolveLineVisualBox(line, layout);
  const startX = box.lineX;
  const right = Math.max(box.contentX + box.contentWidth, box.outerX + box.outerWidth, startX);
  return Math.max(0, right - startX);
};
