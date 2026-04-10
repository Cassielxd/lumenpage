import type {
  LayoutPerfSummary,
  LayoutSettingsLike,
  LayoutSettingsPerfState,
  LayoutSettingsRuntimeState,
} from "./engine/types";

type LayoutSettingsWithRuntimeState = LayoutSettingsLike & {
  runtimeState?: LayoutSettingsRuntimeState | null;
  __perf?: LayoutSettingsPerfState | null;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const resolveSettingsRuntimeState = (
  settings: LayoutSettingsWithRuntimeState | null | undefined
): LayoutSettingsRuntimeState | null => {
  if (!settings) {
    return null;
  }
  const runtimeState = isObjectRecord(settings.runtimeState)
    ? (settings.runtimeState as LayoutSettingsRuntimeState)
    : null;
  const legacyPerf = isObjectRecord(settings.__perf)
    ? (settings.__perf as LayoutSettingsPerfState)
    : null;
  if (runtimeState?.perf || !legacyPerf) {
    return runtimeState;
  }
  runtimeState.perf = legacyPerf;
  return runtimeState;
};

const ensureSettingsRuntimeState = (
  settings: LayoutSettingsWithRuntimeState | null | undefined
): LayoutSettingsRuntimeState | null => {
  if (!settings) {
    return null;
  }
  if (isObjectRecord(settings.runtimeState)) {
    return settings.runtimeState as LayoutSettingsRuntimeState;
  }
  const runtimeState: LayoutSettingsRuntimeState = {};
  settings.runtimeState = runtimeState;
  return runtimeState;
};

const resolveSettingsPerfState = (
  settings: LayoutSettingsWithRuntimeState | null | undefined
): LayoutSettingsPerfState | null => {
  if (!settings) {
    return null;
  }
  const runtimeState = resolveSettingsRuntimeState(settings);
  if (isObjectRecord(runtimeState?.perf)) {
    const perfState = runtimeState.perf as LayoutSettingsPerfState;
    settings.__perf = perfState;
    return perfState;
  }
  if (isObjectRecord(settings.__perf)) {
    const perfState = settings.__perf as LayoutSettingsPerfState;
    const ensuredRuntimeState = ensureSettingsRuntimeState(settings);
    if (ensuredRuntimeState) {
      ensuredRuntimeState.perf = perfState;
    }
    return perfState;
  }
  return null;
};

const ensureSettingsPerfState = (
  settings: LayoutSettingsWithRuntimeState | null | undefined
): LayoutSettingsPerfState | null => {
  if (!settings) {
    return null;
  }
  const existing = resolveSettingsPerfState(settings);
  if (existing) {
    return existing;
  }
  const runtimeState = ensureSettingsRuntimeState(settings);
  const perfState: LayoutSettingsPerfState = {};
  if (runtimeState) {
    runtimeState.perf = perfState;
  }
  settings.__perf = perfState;
  return perfState;
};

export const getLayoutSettingsRuntimeState = (
  settings: LayoutSettingsWithRuntimeState | null | undefined
) => resolveSettingsRuntimeState(settings);

export const getLayoutSettingsPerfState = (
  settings: LayoutSettingsWithRuntimeState | null | undefined
) => resolveSettingsPerfState(settings);

export const ensureLayoutSettingsPerfState = (
  settings: LayoutSettingsWithRuntimeState | null | undefined
) => ensureSettingsPerfState(settings);

export const getLayoutSettingsPerfSummary = (
  settings: LayoutSettingsWithRuntimeState | null | undefined
): LayoutPerfSummary | null => resolveSettingsPerfState(settings)?.layout ?? null;

export const setLayoutSettingsPerfSummary = (
  settings: LayoutSettingsWithRuntimeState | null | undefined,
  summary: LayoutPerfSummary | null | undefined
) => {
  if (!settings) {
    return null;
  }
  const perfState = ensureSettingsPerfState(settings);
  if (!perfState) {
    return null;
  }
  perfState.layout = summary ?? null;
  return perfState.layout ?? null;
};
