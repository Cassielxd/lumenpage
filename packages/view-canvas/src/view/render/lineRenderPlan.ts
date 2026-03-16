const lineHasTextPayload = (line: any) => {
  if (typeof line?.text === "string" && line.text.length > 0) {
    return true;
  }
  if (!Array.isArray(line?.runs) || line.runs.length === 0) {
    return false;
  }
  return line.runs.some((run: any) => typeof run?.text === "string" && run.text.length > 0);
};

const lineHasAuxiliaryVisualPass = (line: any, hasNodeViewRender = false) => {
  if (hasNodeViewRender) {
    return true;
  }
  if (Array.isArray(line?.containers) && line.containers.length > 0) {
    return true;
  }
  return !!(
    line?.listMarker ||
    line?.blockAttrs?.listOwnerMarkerText ||
    line?.blockAttrs?.markerText
  );
};

const rendererHandlesListMarkerInFragment = (renderer: any) =>
  renderer?.listMarkerRenderMode === "fragment";

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
  options: { hasNodeViewRender?: boolean; hasLeafTextFragment?: boolean } = {}
): LineRenderPlan => {
  const hasTextPayload = lineHasTextPayload(line);
  const hasAuxiliaryPass = lineHasAuxiliaryVisualPass(line, options.hasNodeViewRender === true);
  const hasFragmentRenderer = typeof renderer?.renderFragment === "function";
  const hasFragmentOwner =
    Array.isArray(line?.fragmentOwners) && line.fragmentOwners.length > 0;
  const hasLeafTextFragment = options.hasLeafTextFragment === true;
  const usesDefaultTextLineRenderer = renderer?.lineBodyMode === "default-text";
  const fragmentHandlesListMarker = rendererHandlesListMarkerInFragment(renderer);
  const shouldRunContainerPass =
    Array.isArray(line?.containers) && line.containers.length > 0;
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
  const shouldRunNodeViewPass = options.hasNodeViewRender === true;
  const shouldSkipBodyPassAfterFragment =
    hasFragmentRenderer && hasFragmentOwner && !hasAuxiliaryPass && !hasTextPayload;
  const shouldRunRendererLinePass =
    !shouldRunNodeViewPass &&
    !shouldSkipBodyPassAfterFragment &&
    typeof renderer?.renderLine === "function" &&
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
