import { getLayoutVersion as getResolvedLayoutVersion } from "./layoutRuntimeMetadata";

type CreateRenderSyncSchedulingArgs = {
  renderer: any;
  getLayout: () => any;
  getPendingChangeSummary?: () => any;
  getRafId: () => number;
  setRafId: (id: number) => void;
  getLayoutPassCoordinator: () => any;
  getRenderFrameCoordinator: () => any;
};

export const createRenderSyncScheduling = ({
  renderer,
  getLayout,
  getPendingChangeSummary,
  getRafId,
  setRafId,
  getLayoutPassCoordinator,
  getRenderFrameCoordinator,
}: CreateRenderSyncSchedulingArgs) => {
  const hasPendingLayoutWork = () => getLayoutPassCoordinator()?.isPending?.() === true;
  const hasPendingDocLayout = () => getPendingChangeSummary?.()?.docChanged === true;
  const hasUnrenderedLayoutVersion = () => {
    const layoutVersion = Number(getResolvedLayoutVersion(getLayout?.()) ?? 0);
    const renderedLayoutVersion = Number(renderer?.lastLayoutVersion ?? 0);
    return Number.isFinite(layoutVersion) && layoutVersion > renderedLayoutVersion;
  };

  const cancelScheduledRender = () => {
    const renderRafId = getRafId();
    if (!renderRafId) {
      return;
    }
    cancelAnimationFrame(renderRafId);
    setRafId(0);
  };

  const scheduleRender = () => {
    // Async pagination can apply a newer layout before the worker settles.
    // That newer layout still needs a render frame even while layout work is pending.
    if ((hasPendingLayoutWork() || hasPendingDocLayout()) && !hasUnrenderedLayoutVersion()) {
      return;
    }
    getRenderFrameCoordinator()?.scheduleRender?.();
  };

  const scheduleLayout = () => {
    cancelScheduledRender();
    getLayoutPassCoordinator()?.scheduleLayout?.();
  };

  const updateLayout = () => {
    cancelScheduledRender();
    getLayoutPassCoordinator()?.updateLayout?.();
  };

  return {
    hasPendingLayoutWork,
    cancelScheduledRender,
    scheduleRender,
    scheduleLayout,
    updateLayout,
  };
};
