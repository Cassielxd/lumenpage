export const shiftFragmentOwners = (owners, deltaX = 0, deltaY = 0) => {
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

    if (Number.isFinite(next.x)) {
      next.x = Number(next.x) + deltaX;
    }
    if (Number.isFinite(next.y)) {
      next.y = Number(next.y) + deltaY;
    }

    return next;
  });
};
