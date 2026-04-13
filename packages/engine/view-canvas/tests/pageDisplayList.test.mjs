import test from "node:test";
import assert from "node:assert/strict";

import { getRendererPageDisplayListSignature } from "../dist/view/render/pageDisplayListSignature.js";

test("renderer page display-list signature depends on item kind and signature only", () => {
  const first = getRendererPageDisplayListSignature([
    {
      kind: "page-shell",
      signature: 101,
    },
    {
      kind: "fragment-pass",
      signature: 202,
    },
  ]);

  const second = getRendererPageDisplayListSignature([
    {
      kind: "page-shell",
      signature: 101,
      extra: "ignored",
    },
    {
      kind: "fragment-pass",
      signature: 202,
      context: { ignored: true },
    },
  ]);

  assert.equal(first, second);
});

test("renderer page display-list signature returns null for empty item lists", () => {
  assert.equal(getRendererPageDisplayListSignature([]), null);
});
