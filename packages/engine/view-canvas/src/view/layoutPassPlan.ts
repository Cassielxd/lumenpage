import { type PaginationAsyncRequester } from "./paginationRequester.js";
import {
  getLayoutSettingsSignature,
  resolveCascadePaginationPlan,
  resolveLayoutSettingsForPass,
} from "./layoutPassPlanning.js";
import {
  resolveLayoutExecutionStrategy,
  type ResolvedLayoutExecutionStrategy,
} from "./layoutPassExecution.js";

export type LayoutPassSkipPlan = {
  kind: "skip";
  changeSummary: any;
  docChanged: boolean;
  settingsChanged: boolean;
  layoutSettingsSignature: string;
};

export type LayoutPassRunPlan = {
  kind: "run";
  doc: any;
  prevLayout: any;
  prevLayoutIndex: any;
  changeSummary: any;
  docChanged: boolean;
  settingsChanged: boolean;
  layoutSettingsForPass: any;
  layoutSettingsSignature: string;
  incrementalEnabled: boolean;
  settleDelayMs: number;
  cascadeFromPageIndex: number | null;
  useCascadePagination: boolean;
  isLayoutProgressive: boolean;
  executionStrategy: ResolvedLayoutExecutionStrategy;
};

export type LayoutPassPlan = LayoutPassSkipPlan | LayoutPassRunPlan;

type ResolveLayoutPassPlanArgs = {
  editorState: any;
  prevLayout: any;
  prevLayoutIndex: any;
  changeSummary: any;
  runForceFullPass: boolean;
  forceSyncLayoutOnce: boolean;
  resolvedPageWidth?: number;
  lastLayoutSettingsSignature: string | null;
  layoutPipeline: any;
  workerConfig: any;
  paginationRequester: PaginationAsyncRequester | null;
  docPosToTextOffset: (doc: any, pos: number) => number;
  clampOffset: (offset: number) => number;
};

export const resolveLayoutPassPlan = ({
  editorState,
  prevLayout,
  prevLayoutIndex,
  changeSummary,
  runForceFullPass,
  forceSyncLayoutOnce,
  resolvedPageWidth,
  lastLayoutSettingsSignature,
  layoutPipeline,
  workerConfig,
  paginationRequester,
  docPosToTextOffset,
  clampOffset,
}: ResolveLayoutPassPlanArgs): LayoutPassPlan => {
  const layoutSettingsForPass = resolveLayoutSettingsForPass(
    layoutPipeline?.settings,
    resolvedPageWidth
  );
  const layoutSettingsSignature = getLayoutSettingsSignature(layoutSettingsForPass);
  const settingsChanged = layoutSettingsSignature !== lastLayoutSettingsSignature;
  const doc = editorState?.doc ?? null;
  const docChanged = changeSummary?.docChanged === true;

  if (prevLayout && !settingsChanged && !docChanged && !runForceFullPass) {
    return {
      kind: "skip",
      changeSummary,
      docChanged,
      settingsChanged,
      layoutSettingsSignature,
    };
  }

  const workerConfigIncremental = workerConfig?.incremental;
  const incrementalEnabled = workerConfigIncremental !== false;
  const settleDelayMs = Number.isFinite(workerConfigIncremental?.settleDelayMs)
    ? Math.max(120, Number(workerConfigIncremental?.settleDelayMs))
    : 120;

  const { cascadeFromPageIndex, useCascadePagination } = resolveCascadePaginationPlan({
    prevLayout,
    changeSummary,
    docChanged,
    incrementalEnabled,
    runForceFullPass,
    editorState,
    doc,
    clampOffset,
    docPosToTextOffset,
    getLayoutIndex: () => prevLayoutIndex ?? null,
  });

  const executionStrategy = resolveLayoutExecutionStrategy({
    doc,
    prevLayout,
    changeSummary,
    layoutPipeline,
    workerConfig,
    paginationRequester,
    forceSyncLayoutOnce,
    useCascadePagination,
    runForceFullPass,
  });

  return {
    kind: "run",
    doc,
    prevLayout,
    prevLayoutIndex,
    changeSummary,
    docChanged,
    settingsChanged,
    layoutSettingsForPass,
    layoutSettingsSignature,
    incrementalEnabled,
    settleDelayMs,
    cascadeFromPageIndex,
    useCascadePagination,
    isLayoutProgressive: useCascadePagination && !!prevLayout && prevLayout.pages.length > 1,
    executionStrategy,
  };
};
