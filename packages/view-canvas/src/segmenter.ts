const defaultSegmentText = (text) => text.match(/\S+|\s+/g) || [];

export const createSegmentText = (options = {}) => {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return defaultSegmentText;
  }

  const locale = options.locale;
  const granularity = options.granularity || "word";
  const segmenter = new Intl.Segmenter(locale, { granularity });

  return (text) => {
    const segments = [];
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
