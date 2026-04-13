import type { LayoutBox, LayoutFragment } from "./nodeRegistry.js";
import { buildPageBoxesFromLines } from "./pageBoxes.js";

const sortFragmentsByPosition = <T extends { x?: number; y?: number }>(fragments: T[]) =>
  fragments.sort((a, b) => {
    const aY = Number.isFinite(a?.y) ? Number(a.y) : 0;
    const bY = Number.isFinite(b?.y) ? Number(b.y) : 0;
    if (aY !== bY) {
      return aY - bY;
    }
    const aX = Number.isFinite(a?.x) ? Number(a.x) : 0;
    const bX = Number.isFinite(b?.x) ? Number(b.x) : 0;
    return aX - bX;
  });

const boxToFragment = (box: LayoutBox): LayoutFragment => {
  const children: LayoutFragment[] = Array.isArray(box?.children)
    ? sortFragmentsByPosition<LayoutFragment>(box.children.map((child) => boxToFragment(child)))
    : [];

  const next: LayoutFragment = {
    key: box.key,
    type: box.type,
    role: box.role,
    nodeId: box.nodeId ?? null,
    blockId: box.blockId ?? null,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    start: box.start ?? null,
    end: box.end ?? null,
    fixedBounds: box.fixedBounds === true,
    meta: box.meta ? { ...box.meta } : null,
    children,
  };

  if (children.length === 0) {
    delete next.children;
  }

  return next;
};

export const buildPageFragmentsFromBoxes = (boxes: LayoutBox[]) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return [];
  }

  return sortFragmentsByPosition<LayoutFragment>(boxes.map((box) => boxToFragment(box)));
};

export const buildPageFragmentsFromLines = (lines: any[]) =>
  buildPageFragmentsFromBoxes(buildPageBoxesFromLines(lines));
