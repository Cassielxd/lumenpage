import { hasLegacyLayoutCapability } from "./layoutSemanticsLegacy";

export type LayoutCapability =
  | "visual-block"
  | "content-container"
  | "table-cell"
  | "table-structure"
  | "table-root";

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

export const hasLayoutCapability = (target: any, capability: LayoutCapability) => {
  if (!capability || !target) {
    return false;
  }
  if (hasCapabilityInBag(getCapabilityBag(target), capability)) {
    return true;
  }
  return hasLegacyLayoutCapability(target, capability);
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
