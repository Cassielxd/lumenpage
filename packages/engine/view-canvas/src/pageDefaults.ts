export type PageSizePresetValue = "a3" | "a4" | "a5" | "b4" | "b5" | "letter" | "legal";

export type PageSizePresetDefinition = {
  value: PageSizePresetValue;
  width: number;
  height: number;
};

export const PAGE_SIZE_PRESET_DEFINITIONS: readonly PageSizePresetDefinition[] = Object.freeze([
  { value: "a3", width: 1123, height: 1587 },
  { value: "a4", width: 794, height: 1123 },
  { value: "a5", width: 559, height: 794 },
  { value: "b4", width: 944, height: 1334 },
  { value: "b5", width: 665, height: 944 },
  { value: "letter", width: 816, height: 1056 },
  { value: "legal", width: 816, height: 1344 },
]);

export const DEFAULT_PAGE_SIZE_PRESET_VALUE: PageSizePresetValue = "a4";

const defaultPreset =
  PAGE_SIZE_PRESET_DEFINITIONS.find((preset) => preset.value === DEFAULT_PAGE_SIZE_PRESET_VALUE) ||
  PAGE_SIZE_PRESET_DEFINITIONS[0];

export const DEFAULT_PAGE_WIDTH = defaultPreset.width;
export const DEFAULT_PAGE_HEIGHT = defaultPreset.height;
export const DEFAULT_PAGE_GAP = 24;
export const DEFAULT_PAGE_MARGIN = Object.freeze({
  top: 72,
  right: 72,
  bottom: 72,
  left: 72,
});

export const resolvePageSizePreset = (value: string | null | undefined) =>
  PAGE_SIZE_PRESET_DEFINITIONS.find((preset) => preset.value === value) || null;

export const findPageSizePresetByDimensions = (width: number, height: number) => {
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  return (
    PAGE_SIZE_PRESET_DEFINITIONS.find(
      (preset) => preset.width === shortEdge && preset.height === longEdge
    ) || null
  );
};
