import { createUnsplittableBlockPagination } from "../modernUnsplittable.js";

const buildPageBreakLayout = (ctx: any) => {
  const settings = ctx?.settings || {};
  const marginLeft = Number.isFinite(settings?.margin?.left) ? Number(settings.margin.left) : 0;
  return {
    width: 0,
    height: 0,
    line: {
      text: "",
      start: 0,
      end: 1,
      width: 0,
      runs: [],
      x: marginLeft,
      blockType: "pageBreak",
      blockAttrs: {
        lineHeight: 0,
        layoutCapabilities: {
          "page-break": true,
        },
      },
    },
    blockAttrs: {
      lineHeight: 0,
      layoutCapabilities: {
        "page-break": true,
      },
    },
    length: 1,
  };
};

export const pageBreakRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("pageBreak", buildPageBreakLayout),
};
