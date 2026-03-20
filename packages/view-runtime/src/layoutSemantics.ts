export type LayoutCapability =
  | "visual-block"
  | "content-container"
  | "table-cell"
  | "table-structure"
  | "table-root";

const FALLBACK_ROLE_CAPABILITIES: Record<string, LayoutCapability[]> = {
  list: [],
  "list-item": ["content-container"],
  table: ["table-root", "table-structure"],
  "table-cell": ["content-container", "table-cell", "table-structure"],
};

const FALLBACK_TYPE_CAPABILITIES: Record<string, LayoutCapability[]> = {
  image: ["visual-block"],
  video: ["visual-block"],
  horizontalRule: ["visual-block"],
  table: ["table-root", "table-structure"],
  tableCell: ["table-cell", "table-structure"],
  tableHeader: ["table-cell", "table-structure"],
};

const getCapabilityBag = (target: any) => {
  if (!target || typeof target !== "object") {
    return null;
  }
  return (
    target.layoutCapabilities ??
    target.capabilities ??
    target.blockAttrs?.layoutCapabilities ??
    target.blockAttrs?.capabilities ??
    target.meta?.layoutCapabilities ??
    target.meta?.capabilities ??
    null
  );
};

const hasCapabilityInBag = (bag: any, capability: LayoutCapability) => {
  if (!bag) {
    return false;
  }
  if (Array.isArray(bag)) {
    return bag.includes(capability);
  }
  if (typeof bag === "object") {
    return bag[capability] === true;
  }
  return false;
};

const hasFallbackRoleCapability = (target: any, capability: LayoutCapability) => {
  const role = String(target?.role || "");
  if (!role) {
    return false;
  }
  return FALLBACK_ROLE_CAPABILITIES[role]?.includes(capability) === true;
};

const hasFallbackTypeCapability = (target: any, capability: LayoutCapability) => {
  const candidates = [String(target?.type || ""), String(target?.blockType || "")].filter(Boolean);
  return candidates.some((type) => FALLBACK_TYPE_CAPABILITIES[type]?.includes(capability) === true);
};

const hasFallbackLineCapability = (line: any, capability: LayoutCapability) => {
  if (!line || typeof line !== "object") {
    return false;
  }
  if (capability === "visual-block") {
    return !!line.imageMeta || !!line.videoMeta;
  }
  if (capability === "table-structure" || capability === "table-cell") {
    if (line.tableMeta || line.tableOwnerMeta) {
      return true;
    }
    const attrs = line.blockAttrs || {};
    return (
      Number.isFinite(attrs?.rowIndex) &&
      Number.isFinite(attrs?.colIndex) &&
      (attrs?.sliceGroup === "table" ||
        Number.isFinite(attrs?.tableWidth) ||
        Number.isFinite(attrs?.colWidth))
    );
  }
  return false;
};

const hasFallbackLayoutCapability = (target: any, capability: LayoutCapability) =>
  hasFallbackRoleCapability(target, capability) ||
  hasFallbackTypeCapability(target, capability) ||
  hasFallbackLineCapability(target, capability);

export const hasLayoutCapability = (target: any, capability: LayoutCapability) => {
  if (!capability || !target) {
    return false;
  }
  if (hasCapabilityInBag(getCapabilityBag(target), capability)) {
    return true;
  }
  return hasFallbackLayoutCapability(target, capability);
};

export const findNearestLineOwnerWithCapability = (line: any, capability: LayoutCapability) => {
  const owners = Array.isArray(line?.fragmentOwners) ? line.fragmentOwners : [];
  for (let index = owners.length - 1; index >= 0; index -= 1) {
    const owner = owners[index];
    if (hasLayoutCapability(owner, capability)) {
      return owner;
    }
  }
  return null;
};

export const hasLineLayoutCapability = (line: any, capability: LayoutCapability) =>
  hasLayoutCapability(line, capability) || !!findNearestLineOwnerWithCapability(line, capability);

export const isLineVisualBlock = (line: any) => hasLineLayoutCapability(line, "visual-block");

export const isTableLayoutLine = (line: any) => hasLineLayoutCapability(line, "table-structure");

export const getNearestContentOwner = (line: any) =>
  findNearestLineOwnerWithCapability(line, "content-container");
