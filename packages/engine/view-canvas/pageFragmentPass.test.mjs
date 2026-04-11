import test from "node:test";
import assert from "node:assert/strict";

import {
  createPageFragmentPassRuntime,
  resetPageFragmentPassRuntime,
} from "./dist/view/render/pageFragmentPassRuntime.js";

test("page fragment pass runtime resets rendered fragment-owned text keys", () => {
  const runtime = createPageFragmentPassRuntime();
  runtime.renderedLeafTextKeys.add("line-1");
  runtime.renderedLeafTextKeys.add("line-2");

  resetPageFragmentPassRuntime(runtime);

  assert.deepEqual(Array.from(runtime.renderedLeafTextKeys), []);
});
