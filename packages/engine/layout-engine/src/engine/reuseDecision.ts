import { resolveRendererReusePolicy } from "../paginationPolicy.js";
import { shouldDisableReuseForSensitiveChange } from "./sensitiveReuse.js";
import type {
  LayoutChangeSummary,
  LayoutLine,
  LayoutResult,
  LayoutSettingsLike,
  TopLevelIndexableDoc,
} from "./types.js";

type RendererRegistryLike = {
  get?: (typeName: string) => unknown;
};

type PageReuseSettings = LayoutSettingsLike & {
  shouldDisablePageReuseForChange?:
    | ((args: {
        doc: TopLevelIndexableDoc | null | undefined;
        changeSummary: LayoutChangeSummary | null | undefined;
        previousLayout: LayoutResult | null | undefined;
        defaultDecision: boolean;
        shouldDisableReuseForSensitiveChange: typeof shouldDisableReuseForSensitiveChange;
      }) => boolean | void)
    | null;
};

type NodeWithTypeName = {
  type?: {
    name?: string | null;
  } | null;
};

export const resolveDisablePageReuse = ({
  doc,
  baseSettingsRaw,
  previousLayout,
  changeSummary,
  registry,
}: {
  doc: TopLevelIndexableDoc | null | undefined;
  baseSettingsRaw: PageReuseSettings | null | undefined;
  previousLayout: LayoutResult | null | undefined;
  changeSummary: LayoutChangeSummary | null | undefined;
  registry: RendererRegistryLike | null | undefined;
}) => {
  let disablePageReuse = !!baseSettingsRaw?.disablePageReuse;
  if (disablePageReuse) {
    return true;
  }

  const isSensitiveNodeByRenderer = (node: NodeWithTypeName | null | undefined) => {
    const typeName = node?.type?.name;
    if (!typeName || !registry?.get) {
      return false;
    }
    const renderer = registry.get(typeName);
    return resolveRendererReusePolicy(renderer) === "always-sensitive";
  };
  const isSensitiveLineByRenderer = (line: LayoutLine | null | undefined) => {
    const blockType = line?.blockType;
    if (!blockType || !registry?.get) {
      return false;
    }
    const renderer = registry.get(blockType);
    return resolveRendererReusePolicy(renderer) === "always-sensitive";
  };

  const defaultDecision = shouldDisableReuseForSensitiveChange(
    doc,
    changeSummary,
    previousLayout
  );
  const rendererDecision = registry
    ? shouldDisableReuseForSensitiveChange(doc, changeSummary, previousLayout, {
        isSensitiveNode: isSensitiveNodeByRenderer,
        isSensitiveLine: isSensitiveLineByRenderer,
      })
    : false;
  const combinedDefaultDecision = defaultDecision || rendererDecision;
  const customGuard = baseSettingsRaw?.shouldDisablePageReuseForChange;
  if (typeof customGuard !== "function") {
    return combinedDefaultDecision;
  }

  try {
    const customDecision = customGuard({
      doc,
      changeSummary,
      previousLayout,
      defaultDecision: combinedDefaultDecision,
      shouldDisableReuseForSensitiveChange,
    });
    if (customDecision === true || customDecision === false) {
      disablePageReuse = customDecision;
    } else {
      disablePageReuse = combinedDefaultDecision;
    }
  } catch (_error) {
    disablePageReuse = combinedDefaultDecision;
  }

  return disablePageReuse;
};