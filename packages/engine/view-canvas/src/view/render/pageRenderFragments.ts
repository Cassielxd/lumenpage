const TEXT_LINE_FRAGMENT_ROLE = "text-line";

export const getTextLineFragmentKey = (target: any) => {
  if (!target || typeof target !== "object") {
    return null;
  }
  if (typeof target.__textLineFragmentKey === "string" && target.__textLineFragmentKey.length > 0) {
    return target.__textLineFragmentKey;
  }
  if (target.meta && typeof target.meta === "object") {
    const metaLineKey = target.meta.lineKey;
    if (typeof metaLineKey === "string" && metaLineKey.length > 0) {
      return metaLineKey;
    }
  }
  if (
    (String(target?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
      String(target?.type || "") === TEXT_LINE_FRAGMENT_ROLE) &&
    typeof target?.key === "string" &&
    target.key.length > 0
  ) {
    return target.key;
  }
  return null;
};

export const isTextLineFragment = (fragment: any) =>
  String(fragment?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
  String(fragment?.type || "") === TEXT_LINE_FRAGMENT_ROLE;

export const getRendererPageFragments = (page: any) => {
  return Array.isArray(page?.fragments) ? page.fragments : [];
};
