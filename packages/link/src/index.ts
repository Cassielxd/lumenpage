const DEFAULT_BASE_URL = "https://example.invalid/";
const CONTROL_AND_SPACE = /[\u0000-\u0020]+/g;

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const MEDIA_PROTOCOLS = new Set(["http:", "https:", "blob:"]);
const DEFAULT_BLOCKED_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta"] as const;

export const normalizeUrlLike = (value: unknown) =>
  String(value || "").trim().replace(CONTROL_AND_SPACE, "");

export const hasRelativeUrlPrefix = (value: string) =>
  value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || value.startsWith("#");

const sanitizeUrlWithProtocols = (
  value: unknown,
  protocols: ReadonlySet<string>,
  options: {
    allowRelative?: boolean;
    allowDataImage?: boolean;
    baseUrl?: string;
  } = {}
) => {
  const normalized = normalizeUrlLike(value);
  if (!normalized) {
    return null;
  }
  const { allowRelative = true, allowDataImage = false, baseUrl = DEFAULT_BASE_URL } = options;
  if (allowRelative && hasRelativeUrlPrefix(normalized)) {
    return normalized;
  }
  if (allowDataImage && /^data:image\//i.test(normalized)) {
    return normalized;
  }
  try {
    const url = new URL(normalized, baseUrl);
    return protocols.has(url.protocol) ? normalized : null;
  } catch (_error) {
    return null;
  }
};

export const sanitizeLinkHref = (value: unknown, baseUrl?: string) =>
  sanitizeUrlWithProtocols(value, LINK_PROTOCOLS, {
    allowRelative: true,
    allowDataImage: false,
    baseUrl: baseUrl || DEFAULT_BASE_URL,
  });

export const sanitizeImageSrc = (value: unknown, baseUrl?: string) =>
  sanitizeUrlWithProtocols(value, MEDIA_PROTOCOLS, {
    allowRelative: true,
    allowDataImage: true,
    baseUrl: baseUrl || DEFAULT_BASE_URL,
  }) || "";

export const sanitizeVideoSrc = (value: unknown, baseUrl?: string) =>
  sanitizeUrlWithProtocols(value, MEDIA_PROTOCOLS, {
    allowRelative: true,
    allowDataImage: false,
    baseUrl: baseUrl || DEFAULT_BASE_URL,
  }) || "";

export const sanitizePosterSrc = (value: unknown, baseUrl?: string) =>
  sanitizeUrlWithProtocols(value, MEDIA_PROTOCOLS, {
    allowRelative: true,
    allowDataImage: true,
    baseUrl: baseUrl || DEFAULT_BASE_URL,
  }) || "";

export type HtmlSanitizeOptions = {
  blockedTags?: readonly string[];
  dropEventAttributes?: boolean;
  dropStyleAttribute?: boolean;
  allowHref?: (value: string) => boolean;
  allowSrc?: (value: string) => boolean;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const sanitizeMarkJson = (mark: unknown) => {
  if (!isRecord(mark)) {
    return null;
  }
  const nextMark: Record<string, any> = { ...mark };
  const markType = typeof nextMark.type === "string" ? nextMark.type : "";
  const markAttrs = isRecord(nextMark.attrs) ? { ...nextMark.attrs } : {};

  if (markType === "link") {
    const safeHref = sanitizeLinkHref(markAttrs.href);
    if (!safeHref) {
      return null;
    }
    markAttrs.href = safeHref;
  }

  nextMark.attrs = markAttrs;
  return nextMark;
};

const sanitizeNodeAttrs = (nodeType: string, attrs: Record<string, any>) => {
  const nextAttrs = { ...attrs };
  if (nodeType === "image") {
    nextAttrs.src = sanitizeImageSrc(nextAttrs.src);
  }
  if (nodeType === "video") {
    nextAttrs.src = sanitizeVideoSrc(nextAttrs.src);
    nextAttrs.poster = sanitizePosterSrc(nextAttrs.poster);
  }
  return nextAttrs;
};

const sanitizeNodeJson = (node: unknown): Record<string, any> | null => {
  if (!isRecord(node)) {
    return null;
  }
  const nextNode: Record<string, any> = { ...node };
  const nodeType = typeof nextNode.type === "string" ? nextNode.type : "";

  if (isRecord(nextNode.attrs)) {
    nextNode.attrs = sanitizeNodeAttrs(nodeType, nextNode.attrs);
  } else if (nodeType === "image" || nodeType === "video") {
    nextNode.attrs = sanitizeNodeAttrs(nodeType, {});
  }

  if (Array.isArray(nextNode.marks)) {
    nextNode.marks = nextNode.marks.map((mark) => sanitizeMarkJson(mark)).filter(Boolean);
    if (nextNode.marks.length === 0) {
      delete nextNode.marks;
    }
  }

  if (Array.isArray(nextNode.content)) {
    nextNode.content = nextNode.content
      .map((childNode) => sanitizeNodeJson(childNode))
      .filter(Boolean);
  }

  return nextNode;
};

export const sanitizeDocJson = (docJson: unknown) => sanitizeNodeJson(docJson);

export const normalizePastedText = (text: string) => {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
};

export const sanitizePastedHtml = (html: string, options: HtmlSanitizeOptions = {}) => {
  if (typeof html !== "string" || html.length === 0) {
    return "";
  }
  if (typeof DOMParser === "undefined") {
    return html;
  }
  const {
    blockedTags = DEFAULT_BLOCKED_TAGS,
    dropEventAttributes = true,
    dropStyleAttribute = true,
    allowHref = (value) => sanitizeLinkHref(value) != null,
    allowSrc = (value) => sanitizeImageSrc(value) !== "" || sanitizeVideoSrc(value) !== "",
  } = options;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  for (const tag of blockedTags) {
    doc.querySelectorAll(tag).forEach((node) => node.remove());
  }

  doc.body.querySelectorAll("*").forEach((el) => {
    const attrs = Array.from(el.attributes || []);
    for (const attr of attrs) {
      const name = String(attr.name || "").toLowerCase();
      const value = String(attr.value || "");
      if (dropEventAttributes && name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (dropStyleAttribute && name === "style") {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" && !allowHref(value)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "src" && !allowSrc(value)) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return doc.body.innerHTML;
};

// Resolve link mark near a position.
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

// Resolve link mark near current selection.
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

// Keep only navigable, safe href values.
export const normalizeNavigableHref = (href: string) => sanitizeLinkHref(href);
