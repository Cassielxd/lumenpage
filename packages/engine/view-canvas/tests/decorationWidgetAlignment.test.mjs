import test from "node:test";
import assert from "node:assert/strict";

import { Decoration } from "../dist/view/decorations.js";
import { buildDecorationDrawData } from "../dist/view/render/decorations.js";

const render = () => {};

const createDrawData = (decoration) =>
  buildDecorationDrawData({
    layout: {
      pageWidth: 200,
      pageHeight: 300,
      pageGap: 24,
      margin: { left: 24, right: 24 },
      pages: [],
    },
    layoutIndex: null,
    doc: {},
    decorations: [decoration],
    scrollTop: 0,
    viewportWidth: 320,
    textLength: 100,
    docPosToTextOffset: (_doc, pos) => pos,
    coordsAtPos: () => ({ x: 32, y: 40, height: 18 }),
  });

test("widget decorations keep anchor x by default", () => {
  const drawData = createDrawData(Decoration.widget(5, render));

  assert.equal(drawData?.widgets?.length, 1);
  assert.equal(drawData?.widgets?.[0]?.x, 32);
  assert.equal(drawData?.widgets?.[0]?.y, 40);
});

test("page-right widget decorations align to the page right edge", () => {
  const drawData = createDrawData(
    Decoration.widget(5, render, {
      widgetAlignment: "page-right",
      widgetWidth: 14,
      widgetRightInset: 8,
    })
  );

  assert.equal(drawData?.widgets?.length, 1);
  assert.equal(drawData?.widgets?.[0]?.x, 238);
  assert.equal(drawData?.widgets?.[0]?.y, 40);
});
