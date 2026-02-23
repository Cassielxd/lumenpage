// 解析当前位置附近的 link mark，供点击跳转逻辑复用。
export const resolveLinkHrefAtPos = (state: any, pos: number) => {
  if (!state?.doc || !Number.isFinite(pos)) {
    return null;
  }

  const marksFrom = (markList: any[] | null | undefined) => {
    if (!Array.isArray(markList)) {
      return null;
    }
    for (const mark of markList) {
      if (mark?.type?.name === "link" && typeof mark?.attrs?.href === "string" && mark.attrs.href) {
        return mark.attrs.href;
      }
    }
    return null;
  };

  try {
    const $pos = state.doc.resolve(pos);
    const candidates: Array<any[] | null | undefined> = [
      $pos.marks?.(),
      $pos.nodeBefore?.marks,
      $pos.nodeAfter?.marks,
    ];
    if (pos > 0) {
      const $prev = state.doc.resolve(pos - 1);
      candidates.push($prev.marks?.(), $prev.nodeBefore?.marks, $prev.nodeAfter?.marks);
    }
    for (const candidate of candidates) {
      const href = marksFrom(candidate);
      if (href) {
        return href;
      }
    }
  } catch (_error) {
    return null;
  }

  return null;
};

// 从当前选区附近解析链接（优先光标位置），用于键盘跳转等语义动作。
export const resolveLinkHrefAtSelection = (state: any) => {
  const selection = state?.selection;
  if (!selection) {
    return null;
  }
  const head = Number.isFinite(selection.head) ? selection.head : null;
  if (head != null) {
    const byHead = resolveLinkHrefAtPos(state, head);
    if (byHead) {
      return byHead;
    }
  }
  const from = Number.isFinite(selection.from) ? selection.from : null;
  if (from != null) {
    const byFrom = resolveLinkHrefAtPos(state, from);
    if (byFrom) {
      return byFrom;
    }
  }
  const to = Number.isFinite(selection.to) ? selection.to : null;
  if (to != null) {
    const byTo = resolveLinkHrefAtPos(state, to);
    if (byTo) {
      return byTo;
    }
  }
  return null;
};

const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

// 过滤不可导航链接，避免 javascript: 等危险协议。
export const normalizeNavigableHref = (href: string) => {
  if (typeof href !== "string") {
    return null;
  }
  const raw = href.trim();
  if (!raw) {
    return null;
  }
  const lowered = raw.toLowerCase();
  if (lowered.startsWith("javascript:")) {
    return null;
  }
  if (raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("#")) {
    return raw;
  }
  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "https://example.invalid/base-path";
    const url = new URL(raw, base);
    if (!SAFE_PROTOCOLS.includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch (_error) {
    return null;
  }
};
