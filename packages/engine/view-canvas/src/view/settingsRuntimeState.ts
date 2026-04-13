import {
  ensureLayoutSettingsPerfState,
  getLayoutSettingsPerfSummary,
  type LayoutPerfSummary,
  type LayoutSettingsPerfState,
  type LayoutSettingsRuntimeState,
  setLayoutSettingsPerfSummary,
} from "lumenpage-layout-engine";
import type { RendererPerfSummary } from "./render/renderPerfReporter.js";

export type ViewSettingsPerfState = LayoutSettingsPerfState & {
  render?: RendererPerfSummary | null;
  optimization?: Record<string, unknown> | null;
};

type ViewSettingsRuntimeState = LayoutSettingsRuntimeState & {
  perf?: ViewSettingsPerfState | null;
};

type ViewSettingsLike = Record<string, unknown> & {
  runtimeState?: ViewSettingsRuntimeState | null;
  __perf?: ViewSettingsPerfState | null;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const resolveViewPerfState = (settings: ViewSettingsLike | null | undefined): ViewSettingsPerfState | null => {
  const runtimePerf = isObjectRecord(settings?.runtimeState?.perf)
    ? (settings.runtimeState?.perf as ViewSettingsPerfState)
    : null;
  if (runtimePerf) {
    if (settings) {
      settings.__perf = runtimePerf;
    }
    return runtimePerf;
  }
  const legacyPerf = isObjectRecord(settings?.__perf) ? (settings.__perf as ViewSettingsPerfState) : null;
  if (legacyPerf && settings) {
    const runtimeState = (settings.runtimeState ??= {});
    runtimeState.perf = legacyPerf;
  }
  return legacyPerf;
};

const ensureViewPerfState = (settings: ViewSettingsLike | null | undefined): ViewSettingsPerfState | null => {
  if (!settings) {
    return null;
  }
  const existing = resolveViewPerfState(settings);
  if (existing) {
    return existing;
  }
  const perfState = ensureLayoutSettingsPerfState(settings as never) as ViewSettingsPerfState | null;
  if (!perfState) {
    return null;
  }
  const runtimeState = (settings.runtimeState ??= {});
  runtimeState.perf = perfState;
  settings.__perf = perfState;
  return perfState;
};

export const initializeViewPerfState = (settings: ViewSettingsLike | null | undefined) =>
  ensureViewPerfState(settings);

export const getViewLayoutPerfSummary = (
  settings: ViewSettingsLike | null | undefined
): LayoutPerfSummary | null => getLayoutSettingsPerfSummary(settings as never);

export const setViewLayoutPerfSummary = (
  settings: ViewSettingsLike | null | undefined,
  summary: LayoutPerfSummary | null | undefined
) => setLayoutSettingsPerfSummary(settings as never, summary);

export const getViewRenderPerfSummary = (settings: ViewSettingsLike | null | undefined) =>
  resolveViewPerfState(settings)?.render ?? null;

export const setViewRenderPerfSummary = (
  settings: ViewSettingsLike | null | undefined,
  summary: RendererPerfSummary | null | undefined
) => {
  const perfState = ensureViewPerfState(settings);
  if (!perfState) {
    return null;
  }
  perfState.render = summary ?? null;
  return perfState.render ?? null;
};

export const getViewOptimizationPerf = (settings: ViewSettingsLike | null | undefined) =>
  resolveViewPerfState(settings)?.optimization ?? null;

export const patchViewOptimizationPerf = (
  settings: ViewSettingsLike | null | undefined,
  patch: Record<string, unknown>
) => {
  if (!patch || typeof patch !== "object") {
    return null;
  }
  const perfState = ensureViewPerfState(settings);
  if (!perfState) {
    return null;
  }
  const current = isObjectRecord(perfState.optimization)
    ? (perfState.optimization as Record<string, unknown>)
    : null;
  perfState.optimization = current ? { ...current, ...patch } : { ...patch };
  return perfState.optimization;
};
