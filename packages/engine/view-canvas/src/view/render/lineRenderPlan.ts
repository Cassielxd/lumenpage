import {
  resolveNodeRendererCompatCapabilities,
  resolveNodeRendererRenderCapabilities,
} from "lumenpage-render-engine";

const lineHasTextPayload = (line: any) => {
  if (typeof line?.text === "string" && line.text.length > 0) {
    return true;
  }
  if (!Array.isArray(line?.runs) || line.runs.length === 0) {
    return false;
  }
  return line.runs.some((run: any) => typeof run?.text === "string" && run.text.length > 0);
};

const lineHasAuxiliaryVisualPass = ({
  hasNodeViewRender = false,
  hasContainerCompatWork = false,
  hasListMarkerCompatWork = false,
}: {
  hasNodeViewRender?: boolean;
  hasContainerCompatWork?: boolean;
  hasListMarkerCompatWork?: boolean;
}) => {
  if (hasNodeViewRender) {
    return true;
  }
  if (hasContainerCompatWork) {
    return true;
  }
  return hasListMarkerCompatWork;
};

const rendererHandlesListMarkerInFragment = (renderer: any) =>
  resolveNodeRendererCompatCapabilities(renderer).listMarkerRenderMode === "fragment";

export type LineRenderPlan = {
  hasTextPayload: boolean;
  hasAuxiliaryPass: boolean;
  hasFragmentRenderer: boolean;
  hasFragmentOwner: boolean;
  hasLeafTextFragment: boolean;
  usesDefaultTextLineRenderer: boolean;
  shouldRunContainerPass: boolean;
  shouldRunListMarkerPass: boolean;
  shouldRunNodeViewPass: boolean;
  shouldRunRendererLinePass: boolean;
  shouldRunLeafTextPass: boolean;
  shouldRunDefaultTextPass: boolean;
  shouldSkipBodyPassAfterFragment: boolean;
  shouldRunCompatPass: boolean;
};

export const resolveLineRenderPlan = (
  line: any,
  renderer: any,
  options: {
    hasNodeViewRender?: boolean;
    hasLeafTextFragment?: boolean;
    hasContainerCompatWork?: boolean;
  } = {}
): LineRenderPlan => {
  const render = resolveNodeRendererRenderCapabilities(renderer);
  const compat = resolveNodeRendererCompatCapabilities(renderer);
  const hasTextPayload = lineHasTextPayload(line);
  const hasFragmentRenderer = typeof render.renderFragment === "function";
  const hasFragmentOwner =
    Array.isArray(line?.fragmentOwners) && line.fragmentOwners.length > 0;
  const hasLeafTextFragment = options.hasLeafTextFragment === true;
  const usesDefaultTextLineRenderer = compat.lineBodyMode === "default-text";
  const fragmentHandlesListMarker = rendererHandlesListMarkerInFragment(renderer);
  const hasContainerCompatWork =
    options.hasContainerCompatWork === true ||
    (options.hasContainerCompatWork !== false &&
      Array.isArray(line?.containers) &&
      line.containers.length > 0);
  const shouldRunContainerPass = hasContainerCompatWork;
  const shouldRunListMarkerPass =
    !(
      fragmentHandlesListMarker &&
      hasFragmentRenderer &&
      hasFragmentOwner
    ) &&
    !!(
      line?.listMarker ||
      line?.blockAttrs?.listOwnerMarkerText ||
      line?.blockAttrs?.markerText
    );
  const hasAuxiliaryPass = lineHasAuxiliaryVisualPass({
    hasNodeViewRender: options.hasNodeViewRender === true,
    hasContainerCompatWork,
    hasListMarkerCompatWork: shouldRunListMarkerPass,
  });
  const shouldRunNodeViewPass = options.hasNodeViewRender === true;
  const shouldSkipBodyPassAfterFragment =
    hasFragmentRenderer && hasFragmentOwner && !hasAuxiliaryPass && !hasTextPayload;
  const shouldRunRendererLinePass =
    !shouldRunNodeViewPass &&
    !shouldSkipBodyPassAfterFragment &&
    typeof compat.renderLine === "function" &&
    !(usesDefaultTextLineRenderer && !hasTextPayload) &&
    !(hasLeafTextFragment && usesDefaultTextLineRenderer);
  const shouldRunLeafTextPass =
    !shouldRunNodeViewPass &&
    !shouldRunRendererLinePass &&
    !shouldSkipBodyPassAfterFragment &&
    !hasLeafTextFragment &&
    hasTextPayload;
  const shouldRunDefaultTextPass = shouldRunLeafTextPass;
  const shouldRunCompatPass =
    shouldRunContainerPass ||
    shouldRunListMarkerPass ||
    shouldRunNodeViewPass ||
    shouldRunRendererLinePass ||
    shouldRunLeafTextPass;

  return {
    hasTextPayload,
    hasAuxiliaryPass,
    hasFragmentRenderer,
    hasFragmentOwner,
    hasLeafTextFragment,
    usesDefaultTextLineRenderer,
    shouldRunContainerPass,
    shouldRunListMarkerPass,
    shouldRunNodeViewPass,
    shouldRunRendererLinePass,
    shouldRunLeafTextPass,
    shouldRunDefaultTextPass,
    shouldSkipBodyPassAfterFragment,
    shouldRunCompatPass,
  };
};
