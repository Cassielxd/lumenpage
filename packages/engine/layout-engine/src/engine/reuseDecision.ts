import { resolveRendererReusePolicy } from "../paginationPolicy";
import { shouldDisableReuseForSensitiveChange } from "./sensitiveReuse";

export const resolveDisablePageReuse = ({
  doc,
  baseSettingsRaw,
  previousLayout,
  changeSummary,
  registry,
}: {
  doc: any;
  baseSettingsRaw: any;
  previousLayout: any;
  changeSummary: any;
  registry: any;
}) => {
  let disablePageReuse = !!baseSettingsRaw?.disablePageReuse;
  if (disablePageReuse) {
    return true;
  }

  const isSensitiveNodeByRenderer = (node: any) => {
    const typeName = node?.type?.name;
    if (!typeName || !registry?.get) {
      return false;
    }
    const renderer = registry.get(typeName);
    return resolveRendererReusePolicy(renderer) === "always-sensitive";
  };
  const isSensitiveLineByRenderer = (line: any) => {
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
    previousLayout,
    registry
      ? {
          isSensitiveNode: isSensitiveNodeByRenderer,
          isSensitiveLine: isSensitiveLineByRenderer,
        }
      : undefined
  );
  const customGuard = baseSettingsRaw?.shouldDisablePageReuseForChange;
  if (typeof customGuard !== "function") {
    return defaultDecision;
  }

  try {
    const customDecision = customGuard({
      doc,
      changeSummary,
      previousLayout,
      defaultDecision,
      shouldDisableReuseForSensitiveChange,
    });
    if (customDecision === true || customDecision === false) {
      disablePageReuse = customDecision;
    } else {
      disablePageReuse = defaultDecision;
    }
  } catch (_error) {
    disablePageReuse = defaultDecision;
  }

  return disablePageReuse;
};
