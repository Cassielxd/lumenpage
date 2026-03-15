import type { LayoutCapability } from "./layoutSemantics";

const LEGACY_ROLE_CAPABILITIES: Record<string, LayoutCapability[]> = {
  list: [],
  "list-item": ["content-container"],
  table: ["table-root", "table-structure"],
  "table-cell": ["content-container", "table-cell", "table-structure"],
};

const LEGACY_TYPE_CAPABILITIES: Record<string, LayoutCapability[]> = {
  image: ["visual-block"],
  video: ["visual-block"],
  horizontalRule: ["visual-block"],
  table: ["table-root", "table-structure"],
  tableCell: ["table-cell", "table-structure"],
  tableHeader: ["table-cell", "table-structure"],
};

const hasLegacyRoleCapability = (target: any, capability: LayoutCapability) => {
  const role = String(target?.role || "");
  if (!role) {
    return false;
  }
  return LEGACY_ROLE_CAPABILITIES[role]?.includes(capability) === true;
};

const hasLegacyTypeCapability = (target: any, capability: LayoutCapability) => {
  const candidates = [String(target?.type || ""), String(target?.blockType || "")].filter(Boolean);
  return candidates.some((type) => LEGACY_TYPE_CAPABILITIES[type]?.includes(capability) === true);
};

const hasLegacyLineCapability = (line: any, capability: LayoutCapability) => {
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

export const hasLegacyLayoutCapability = (target: any, capability: LayoutCapability) =>
  hasLegacyRoleCapability(target, capability) ||
  hasLegacyTypeCapability(target, capability) ||
  hasLegacyLineCapability(target, capability);
