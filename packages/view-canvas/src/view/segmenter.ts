type SegmenterGranularity = "grapheme" | "word" | "sentence";

type SegmenterOptions = {
  locale?: string | string[];
  granularity?: SegmenterGranularity;
};

type IntlSegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity?: SegmenterGranularity }
) => {
  segment: (text: string) => Iterable<{ segment: string; isWordLike?: boolean }>;
};

const defaultSegmentText = (text: string) => text.match(/\S+|\s+/g) || [];

const getIntlSegmenter = (): IntlSegmenterConstructor | null => {
  const intl = (globalThis as { Intl?: { Segmenter?: IntlSegmenterConstructor } }).Intl;
  return intl?.Segmenter ?? null;
};

export const createSegmentText = (options: SegmenterOptions = {}) => {
  const IntlSegmenter = getIntlSegmenter();
  if (!IntlSegmenter) {
    return defaultSegmentText;
  }

  const { locale, granularity = "word" } = options;
  const segmenter = new IntlSegmenter(locale, { granularity });

  return (text: string) => {
    const segments: Array<{
      text: string;
      isWhitespace: boolean;
      isWordLike?: boolean;
    }> = [];
    for (const segment of segmenter.segment(text)) {
      const value = segment.segment;
      segments.push({
        text: value,
        isWhitespace: value.trim().length === 0,
        isWordLike: segment.isWordLike ?? undefined,
      });
    }
    return segments;
  };
};

export const createLinebreakSegmentText = () => createSegmentText({ granularity: "word" });
