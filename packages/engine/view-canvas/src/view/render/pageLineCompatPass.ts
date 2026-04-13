import { renderPageCompatRuntimeEntry } from "./pageCompatEntryExecutor.js";
import { collectRunnablePageCompatEntries } from "./pageCompatPassRuntime.js";
import {
  type PageCompatPassPlan,
  type DefaultRender,
} from "./pageRenderTypes.js";
import { type PageFragmentPassRuntime } from "./pageFragmentPassRuntime.js";

export const renderPageLineCompatPass = ({
  ctx,
  layout,
  defaultRender,
  compatPass,
  runtime,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  layout: any;
  defaultRender: DefaultRender;
  compatPass: PageCompatPassPlan;
  runtime: PageFragmentPassRuntime;
}) => {
  const runtimeEntries = collectRunnablePageCompatEntries({
    compatPass,
    renderedLeafTextKeys: runtime.renderedLeafTextKeys,
  });
  for (const runtimeEntry of runtimeEntries) {
    renderPageCompatRuntimeEntry({
      ctx,
      layout,
      defaultRender,
      runtimeEntry,
    });
  }
};
