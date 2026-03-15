import { buildPageBoxesFromLines } from "./pageBoxes";
import { buildPageFragmentsFromBoxes } from "./pageFragments";

const pageHasFragmentOwners = (page: any) =>
  Array.isArray(page?.lines) &&
  page.lines.some(
    (line: any) => Array.isArray(line?.fragmentOwners) && line.fragmentOwners.length > 0
  );

export const materializePageGeometry = (
  page: any,
  options: {
    force?: boolean;
  } = {}
) => {
  if (!page || typeof page !== "object") {
    return page;
  }

  const force = options?.force === true;

  const lines = Array.isArray(page.lines) ? page.lines : [];
  if (lines.length === 0) {
    page.boxes = [];
    page.fragments = [];
    return page;
  }

  const hasOwners = pageHasFragmentOwners(page);
  const boxes =
    !force && Array.isArray(page.boxes) && page.boxes.length > 0
      ? page.boxes
      : hasOwners
        ? buildPageBoxesFromLines(lines)
        : [];
  page.boxes = boxes;

  const fragments =
    !force && Array.isArray(page.fragments) && page.fragments.length > 0
      ? page.fragments
      : boxes.length > 0
        ? buildPageFragmentsFromBoxes(boxes)
        : [];
  page.fragments = fragments;

  return page;
};

export const materializeLayoutGeometry = (
  layout: any,
  options: {
    force?: boolean;
  } = {}
) => {
  if (!layout?.pages?.length) {
    return layout;
  }
  for (const page of layout.pages) {
    materializePageGeometry(page, options);
  }
  return layout;
};
