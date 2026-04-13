import type { PageCompatPassPlan } from "./pageRenderTypes.js";
import { getRendererLinePaintEntriesSignature } from "./pageLineEntrySignature.js";

export const getRendererCompatPassSignature = ({
  compatPass,
}: {
  compatPass: PageCompatPassPlan;
}) => {
  if (!Array.isArray(compatPass.lineEntries) || compatPass.lineEntries.length === 0) {
    return 0;
  }
  return getRendererLinePaintEntriesSignature(compatPass.lineEntries);
};
