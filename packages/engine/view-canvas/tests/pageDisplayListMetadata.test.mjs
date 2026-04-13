import test from "node:test";
import assert from "node:assert/strict";

import { syncRendererPageDisplayListMetadata } from "../dist/view/render/pageDisplayListMetadata.js";

test("syncRendererPageDisplayListMetadata writes signature and layout version when page exists", () => {
  const calls = [];
  const page = {};

  syncRendererPageDisplayListMetadata({
    page,
    displayList: {
      signature: 12345,
    },
    getPageLayoutVersionToken() {
      return 8;
    },
    setPageRenderSignature(target, signature) {
      calls.push(["signature", target, signature]);
    },
    setPageRenderSignatureVersion(target, version) {
      calls.push(["version", target, version]);
    },
  });

  assert.deepEqual(calls, [
    ["signature", page, 12345],
    ["version", page, 8],
  ]);
});

test("syncRendererPageDisplayListMetadata skips writes when page is absent", () => {
  let callCount = 0;

  syncRendererPageDisplayListMetadata({
    page: null,
    displayList: {
      signature: 99,
    },
    getPageLayoutVersionToken() {
      callCount += 1;
      return 1;
    },
    setPageRenderSignature() {
      callCount += 1;
    },
    setPageRenderSignatureVersion() {
      callCount += 1;
    },
  });

  assert.equal(callCount, 0);
});
