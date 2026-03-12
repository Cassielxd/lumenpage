export type SuggestionRange = {
  from: number;
  to: number;
};

export type SuggestionMatch = {
  range: SuggestionRange;
  query: string;
  text: string;
} | null;

export type SuggestionMatchTrigger = {
  char: string;
  allowSpaces: boolean;
  allowToIncludeChar: boolean;
  allowedPrefixes: string[] | null;
  startOfLine: boolean;
  $position: any;
};

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const findSuggestionMatch = (config: SuggestionMatchTrigger): SuggestionMatch => {
  const {
    char,
    allowSpaces: allowSpacesOption,
    allowToIncludeChar,
    allowedPrefixes,
    startOfLine,
    $position,
  } = config;

  const allowSpaces = allowSpacesOption && !allowToIncludeChar;
  const escapedChar = escapeForRegExp(char);
  const suffix = new RegExp(`\\s${escapedChar}$`);
  const prefix = startOfLine ? "^" : "";
  const finalEscapedChar = allowToIncludeChar ? "" : escapedChar;
  const regexp = allowSpaces
    ? new RegExp(`${prefix}${escapedChar}.*?(?=\\s${finalEscapedChar}|$)`, "gm")
    : new RegExp(`${prefix}(?:^)?${escapedChar}[^\\s${finalEscapedChar}]*`, "gm");

  const text = $position?.nodeBefore?.isText ? String($position.nodeBefore.text || "") : "";
  if (!text) {
    return null;
  }

  const textFrom = Number($position?.pos) - text.length;
  const match = Array.from(text.matchAll(regexp)).pop();
  if (!match || match.input === undefined || match.index === undefined) {
    return null;
  }

  const matchPrefix = match.input.slice(Math.max(0, match.index - 1), match.index);
  if (allowedPrefixes !== null) {
    const prefixAllowed = matchPrefix === "" || allowedPrefixes.includes(matchPrefix);
    if (!prefixAllowed) {
      return null;
    }
  }

  const from = textFrom + match.index;
  let to = from + match[0].length;
  if (allowSpaces && suffix.test(text.slice(to - 1, to + 1))) {
    match[0] += " ";
    to += 1;
  }

  if (from < $position.pos && to >= $position.pos) {
    return {
      range: { from, to },
      query: match[0].slice(char.length),
      text: match[0],
    };
  }

  return null;
};
