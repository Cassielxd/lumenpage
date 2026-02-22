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
