import { resolveNodeRendererRenderCapabilities } from "lumenpage-render-engine";
import { type PageCompatPassPlan, type PageFragmentPassPlan } from "./pageRenderTypes.js";
import { getRendererFragmentTreePaintSignature } from "./pageFragmentSignature.js";
import { getRendererLinePaintEntriesSignature } from "./pageLineEntrySignature.js";

const hashNumber = (hash: number, value: unknown) => {
  const num = Number.isFinite(value) ? Math.round(Number(value)) : 0;

  return (hash * 31 + num) | 0;
};

export const getRendererPageShellSignature = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => {
  let hash = 17;
  hash = hashNumber(hash, width);
  hash = hashNumber(hash, height);
  return hash >>> 0;
};

export const getRendererFragmentPassSignature = ({
  fragmentPass,
  registry,
}: {
  fragmentPass: PageFragmentPassPlan;
  registry: any;
}) => {
  let hash = getRendererFragmentTreePaintSignature({
    nodes: fragmentPass.pageFragments || null,
    registry,
    hasVisualSelf: (node, targetRegistry) => {
      const fragmentRenderer = node?.type ? targetRegistry?.get(node.type) : null;
      const render = resolveNodeRendererRenderCapabilities(fragmentRenderer);
      return typeof render.renderFragment === "function";
    },
  });
  if (fragmentPass.fragmentOwnedTextLineEntries.length > 0) {
    hash = hashNumber(
      hash,
      getRendererLinePaintEntriesSignature(fragmentPass.fragmentOwnedTextLineEntries)
    );
  }
  return hash >>> 0;
};

export const getRendererLineCompatPassSignature = ({
  compatPass,
}: {
  compatPass: PageCompatPassPlan;
}) => {
  if (!Array.isArray(compatPass.lineEntries) || compatPass.lineEntries.length === 0) {
    return 0;
  }
  return getRendererLinePaintEntriesSignature(compatPass.lineEntries);
};
