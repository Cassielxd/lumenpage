import test from "node:test";
import assert from "node:assert/strict";

import {
  handleDecorationWidgetClick,
  hitTestDecorationWidgetAtCoords,
} from "../dist/view/render/decorationWidgetHitTesting.js";

test("hitTestDecorationWidgetAtCoords prefers the topmost matching widget", () => {
  const widgets = [
    {
      x: 100,
      y: 40,
      width: 18,
      height: 18,
      decoration: { spec: {} },
    },
    {
      x: 100,
      y: 40,
      width: 18,
      height: 18,
      decoration: { spec: {} },
    },
  ];

  const hit = hitTestDecorationWidgetAtCoords({
    widgets,
    coords: { x: 108, y: 48 },
  });

  assert.equal(hit?.widget, widgets[1]);
});

test("handleDecorationWidgetClick invokes widget callbacks only on matching hits", () => {
  const calls = [];
  const widget = {
    x: 120,
    y: 64,
    width: 18,
    height: 18,
    decoration: {
      spec: {
        onClick(args) {
          calls.push(args);
          return true;
        },
      },
    },
  };

  const handled = handleDecorationWidgetClick({
    view: { id: "view" },
    event: { type: "click" },
    coords: { x: 126, y: 72 },
    widgets: [widget],
  });
  const missed = handleDecorationWidgetClick({
    view: { id: "view" },
    event: { type: "click" },
    coords: { x: 10, y: 10 },
    widgets: [widget],
  });

  assert.equal(handled, true);
  assert.equal(missed, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.width, 18);
  assert.equal(calls[0]?.height, 18);
});
