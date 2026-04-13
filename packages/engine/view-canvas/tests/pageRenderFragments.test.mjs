import test from "node:test";
import assert from "node:assert/strict";

import {
  getRendererPageFragments,
  getTextLineFragmentKey,
  isTextLineFragment,
} from "../dist/view/render/pageRenderFragments.js";

test("getTextLineFragmentKey prefers explicit line keys before structural fallback", () => {
  assert.equal(getTextLineFragmentKey({ __textLineFragmentKey: "explicit" }), "explicit");
  assert.equal(getTextLineFragmentKey({ meta: { lineKey: "meta" } }), "meta");
  assert.equal(getTextLineFragmentKey({ role: "text-line", key: "fragment" }), "fragment");
  assert.equal(getTextLineFragmentKey({ type: "text-line", key: "typed-fragment" }), "typed-fragment");
  assert.equal(getTextLineFragmentKey({ role: "paragraph", key: "ignored" }), null);
});

test("isTextLineFragment only matches text-line role or type", () => {
  assert.equal(isTextLineFragment({ role: "text-line" }), true);
  assert.equal(isTextLineFragment({ type: "text-line" }), true);
  assert.equal(isTextLineFragment({ role: "paragraph" }), false);
  assert.equal(isTextLineFragment(null), false);
});

test("getRendererPageFragments returns fragment arrays and falls back to empty arrays", () => {
  const fragments = [{ key: "a" }];
  assert.equal(getRendererPageFragments({ fragments }), fragments);
  assert.deepEqual(getRendererPageFragments({ fragments: null }), []);
  assert.deepEqual(getRendererPageFragments(null), []);
});
