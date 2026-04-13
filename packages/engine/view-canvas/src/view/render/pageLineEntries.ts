import {
  collectLineCompatContainerPassEntries,
  type LineCompatContainerPassEntry,
} from "./lineCompatContainerPass.js";
import { resolveLineRenderPlan } from "./lineRenderPlan.js";
import { getTextLineFragmentKey } from "./pageRenderFragments.js";

export type PageLineEntry = {
  line: any;
  nodeView: any;
  renderer: any;
  renderPlan: ReturnType<typeof resolveLineRenderPlan>;
  textLineKey: string | null;
  containerCompatEntries: LineCompatContainerPassEntry[];
};

export type PageCompatLineEntry = PageLineEntry & {
  fragmentOwnsLeafText: boolean;
};

export const collectPageLineEntries = ({
  page,
  registry,
  nodeViewProvider,
}: {
  page: any;
  registry: any;
  nodeViewProvider: ((line: any) => any) | null;
}) => {
  const pageLines = Array.isArray(page?.lines) ? page.lines : [];
  return pageLines.map((line): PageLineEntry => {
    const nodeView = nodeViewProvider?.(line);
    const renderer = registry?.get(line.blockType);
    const containerCompatEntries = collectLineCompatContainerPassEntries({
      line,
      registry,
    });
    const renderPlan = resolveLineRenderPlan(line, renderer, {
      hasNodeViewRender: !!nodeView?.render,
      hasContainerCompatWork: containerCompatEntries.length > 0,
    });
    return {
      line,
      nodeView,
      renderer,
      renderPlan,
      textLineKey: getTextLineFragmentKey(line),
      containerCompatEntries,
    };
  });
};

export const buildLeafTextLineEntryMap = (lineEntries: PageLineEntry[]) => {
  const leafTextLineEntries = new Map<string, PageLineEntry>();
  for (const entry of lineEntries) {
    if (typeof entry.textLineKey !== "string" || entry.textLineKey.length === 0) {
      continue;
    }
    if (!entry.renderPlan.hasTextPayload) {
      continue;
    }
    leafTextLineEntries.set(entry.textLineKey, entry);
  }
  return leafTextLineEntries;
};

export const isLeafTextExpectedFromFragment = (entry: PageLineEntry) =>
  typeof entry.textLineKey === "string" &&
  entry.textLineKey.length > 0 &&
  entry.renderPlan.hasFragmentRenderer &&
  entry.renderPlan.hasFragmentOwner &&
  entry.renderPlan.hasTextPayload &&
  !entry.renderPlan.shouldRunNodeViewPass &&
  entry.renderPlan.usesDefaultTextLineRenderer;

export const buildPageCompatLineEntries = (lineEntries: PageLineEntry[]) =>
  lineEntries
    .map((entry): PageCompatLineEntry => {
      const fragmentOwnsLeafText = isLeafTextExpectedFromFragment(entry);
      return {
        ...entry,
        fragmentOwnsLeafText,
      };
    })
    .filter((entry) => {
      const hasContainerCompatWork =
        Array.isArray(entry.containerCompatEntries) && entry.containerCompatEntries.length > 0;
      const hasRendererCompatWork =
        entry.renderPlan.shouldRunRendererLinePass && !entry.fragmentOwnsLeafText;
      const hasLeafTextCompatWork =
        entry.renderPlan.shouldRunLeafTextPass && !entry.fragmentOwnsLeafText;

      return (
        hasContainerCompatWork ||
        entry.renderPlan.shouldRunListMarkerPass ||
        entry.renderPlan.shouldRunNodeViewPass ||
        hasRendererCompatWork ||
        hasLeafTextCompatWork
      );
    });

export const resolveCompatLineEntryRenderPlan = (
  entry: PageCompatLineEntry,
  renderedLeafTextKeys: Set<string>
) =>
  resolveLineRenderPlan(entry.line, entry.renderer, {
    hasNodeViewRender: !!entry.nodeView?.render,
    hasContainerCompatWork:
      Array.isArray(entry.containerCompatEntries) && entry.containerCompatEntries.length > 0,
    hasLeafTextFragment:
      entry.fragmentOwnsLeafText &&
      typeof entry.textLineKey === "string" &&
      renderedLeafTextKeys.has(entry.textLineKey),
  });
