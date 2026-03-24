const DEFAULT_BASE_URL = "https://example.invalid/";
const CONTROL_AND_SPACE = /[\u0000-\u0020]+/g;

const DEFAULT_LINK_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"] as const;
const DEFAULT_MEDIA_PROTOCOLS = ["http:", "https:", "blob:"] as const;
const DEFAULT_BLOCKED_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta"] as const;
const SAFE_DATA_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export type SecurityAuditEvent = {
  surface: "url" | "html" | "json";
  target: "link" | "image" | "video" | "poster" | "href" | "src" | "tag" | "attribute" | "mark";
  decision: "drop" | "sanitize";
  value?: string;
  reason?: string;
  source?: string;
};

export type SecurityPolicy = {
  baseUrl?: string;
  linkProtocols?: readonly string[];
  mediaProtocols?: readonly string[];
  blockedTags?: readonly string[];
  dropEventAttributes?: boolean;
  dropStyleAttribute?: boolean;
  allowRelativeLinks?: boolean;
  allowRelativeMedia?: boolean;
  allowDataImage?: boolean;
  onAudit?: ((event: SecurityAuditEvent) => void) | null;
};

export type UrlSanitizeOptions = {
  baseUrl?: string;
  source?: string;
  policy?: SecurityPolicy;
};

export type JsonSanitizeOptions = {
  source?: string;
  policy?: SecurityPolicy;
};

export type HtmlSanitizeOptions = {
  blockedTags?: readonly string[];
  dropEventAttributes?: boolean;
  dropStyleAttribute?: boolean;
  allowHref?: (value: string) => boolean;
  allowSrc?: (value: string) => boolean;
  source?: string;
  policy?: SecurityPolicy;
};

type ResolvedSecurityPolicy = {
  baseUrl: string;
  linkProtocols: string[];
  mediaProtocols: string[];
  blockedTags: string[];
  dropEventAttributes: boolean;
  dropStyleAttribute: boolean;
  allowRelativeLinks: boolean;
  allowRelativeMedia: boolean;
  allowDataImage: boolean;
  onAudit: ((event: SecurityAuditEvent) => void) | null;
};

const normalizeProtocol = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return normalized.endsWith(":") ? normalized : `${normalized}:`;
};

const sanitizeProtocolList = (values: readonly string[] | undefined, fallback: readonly string[]) => {
  const source = Array.isArray(values) && values.length > 0 ? values : fallback;
  const normalized = source.map((item) => normalizeProtocol(item)).filter(Boolean);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : Array.from(fallback);
};

const sanitizeTagList = (values: readonly string[] | undefined, fallback: readonly string[]) => {
  const source = Array.isArray(values) && values.length > 0 ? values : fallback;
  const normalized = source.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : Array.from(fallback);
};

const normalizeSecurityPolicy = (policy: SecurityPolicy = {}): ResolvedSecurityPolicy => ({
  baseUrl:
    typeof policy.baseUrl === "string" && policy.baseUrl.trim()
      ? String(policy.baseUrl).trim()
      : DEFAULT_BASE_URL,
  linkProtocols: sanitizeProtocolList(policy.linkProtocols, DEFAULT_LINK_PROTOCOLS),
  mediaProtocols: sanitizeProtocolList(policy.mediaProtocols, DEFAULT_MEDIA_PROTOCOLS),
  blockedTags: sanitizeTagList(policy.blockedTags, DEFAULT_BLOCKED_TAGS),
  dropEventAttributes: policy.dropEventAttributes !== false,
  dropStyleAttribute: policy.dropStyleAttribute !== false,
  allowRelativeLinks: policy.allowRelativeLinks !== false,
  allowRelativeMedia: policy.allowRelativeMedia !== false,
  allowDataImage: policy.allowDataImage !== false,
  onAudit: typeof policy.onAudit === "function" ? policy.onAudit : null,
});

let activeSecurityPolicy = normalizeSecurityPolicy();

const resolveSecurityPolicy = (policy?: SecurityPolicy | null) => {
  if (!policy) {
    return activeSecurityPolicy;
  }
  return normalizeSecurityPolicy({
    ...activeSecurityPolicy,
    ...policy,
    linkProtocols: policy.linkProtocols ?? activeSecurityPolicy.linkProtocols,
    mediaProtocols: policy.mediaProtocols ?? activeSecurityPolicy.mediaProtocols,
    blockedTags: policy.blockedTags ?? activeSecurityPolicy.blockedTags,
  });
};

const emitSecurityAudit = (policy: ResolvedSecurityPolicy, event: SecurityAuditEvent) => {
  if (typeof policy.onAudit !== "function") {
    return;
  }
  try {
    policy.onAudit(event);
  } catch (_error) {
    // Keep sanitization flow resilient; audits are best-effort only.
  }
};

export const getSecurityPolicy = (): SecurityPolicy => ({
  ...activeSecurityPolicy,
  linkProtocols: [...activeSecurityPolicy.linkProtocols],
  mediaProtocols: [...activeSecurityPolicy.mediaProtocols],
  blockedTags: [...activeSecurityPolicy.blockedTags],
});

export const setSecurityPolicy = (policy: SecurityPolicy = {}) => {
  activeSecurityPolicy = normalizeSecurityPolicy({
    ...activeSecurityPolicy,
    ...policy,
    linkProtocols: policy.linkProtocols ?? activeSecurityPolicy.linkProtocols,
    mediaProtocols: policy.mediaProtocols ?? activeSecurityPolicy.mediaProtocols,
    blockedTags: policy.blockedTags ?? activeSecurityPolicy.blockedTags,
  });
  return getSecurityPolicy();
};

export const resetSecurityPolicy = () => {
  activeSecurityPolicy = normalizeSecurityPolicy();
  return getSecurityPolicy();
};

export const normalizeUrlLike = (value: unknown) =>
  String(value || "").trim().replace(CONTROL_AND_SPACE, "");

export const hasRelativeUrlPrefix = (value: string) =>
  value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || value.startsWith("#");

const isAllowedDataImageUrl = (value: string) => {
  const match = /^data:([^;,]+)(;[^,]*)?,(.*)$/i.exec(value);
  if (!match) {
    return false;
  }
  const mime = String(match[1] || "").toLowerCase();
  const params = String(match[2] || "").toLowerCase();
  const payload = String(match[3] || "");
  if (!SAFE_DATA_IMAGE_MIME_TYPES.has(mime)) {
    return false;
  }
  if (!params.includes(";base64")) {
    return false;
  }
  // Keep this strict to avoid tolerant parsing of malformed payloads.
  return /^[a-z0-9+/=\s]+$/i.test(payload);
};

const resolveUrlOptions = (options?: string | UrlSanitizeOptions): UrlSanitizeOptions => {
  if (typeof options === "string") {
    return { baseUrl: options };
  }
  return options || {};
};

const sanitizeUrlWithProtocols = (
  value: unknown,
  protocols: ReadonlySet<string>,
  options: {
    allowRelative?: boolean;
    allowDataImage?: boolean;
    baseUrl?: string;
    source?: string;
    policy: ResolvedSecurityPolicy;
    target: SecurityAuditEvent["target"];
  }
) => {
  const raw = String(value ?? "");
  const normalized = normalizeUrlLike(value);
  const {
    allowRelative = true,
    allowDataImage = false,
    baseUrl = DEFAULT_BASE_URL,
    source,
    policy,
    target,
  } = options;

  if (!normalized) {
    if (raw.trim().length > 0) {
      emitSecurityAudit(policy, {
        surface: "url",
        target,
        decision: "drop",
        value: raw,
        reason: "empty-or-control-only",
        source,
      });
    }
    return null;
  }

  if (allowRelative && hasRelativeUrlPrefix(normalized)) {
    if (raw !== normalized) {
      emitSecurityAudit(policy, {
        surface: "url",
        target,
        decision: "sanitize",
        value: raw,
        reason: "normalized-relative-url",
        source,
      });
    }
    return normalized;
  }

  if (allowDataImage && isAllowedDataImageUrl(normalized)) {
    if (raw !== normalized) {
      emitSecurityAudit(policy, {
        surface: "url",
        target,
        decision: "sanitize",
        value: raw,
        reason: "normalized-data-image-url",
        source,
      });
    }
    return normalized;
  }

  try {
    const url = new URL(normalized, baseUrl);
    if (protocols.has(url.protocol)) {
      if (raw !== normalized) {
        emitSecurityAudit(policy, {
          surface: "url",
          target,
          decision: "sanitize",
          value: raw,
          reason: "normalized-url",
          source,
        });
      }
      return normalized;
    }
    emitSecurityAudit(policy, {
      surface: "url",
      target,
      decision: "drop",
      value: raw,
      reason: `disallowed-protocol:${url.protocol}`,
      source,
    });
    return null;
  } catch (_error) {
    emitSecurityAudit(policy, {
      surface: "url",
      target,
      decision: "drop",
      value: raw,
      reason: "invalid-url",
      source,
    });
    return null;
  }
};

export const sanitizeLinkHref = (value: unknown, options?: string | UrlSanitizeOptions) => {
  const resolvedOptions = resolveUrlOptions(options);
  const policy = resolveSecurityPolicy(resolvedOptions.policy);
  return sanitizeUrlWithProtocols(value, new Set(policy.linkProtocols), {
    allowRelative: policy.allowRelativeLinks,
    allowDataImage: false,
    baseUrl: resolvedOptions.baseUrl || policy.baseUrl,
    source: resolvedOptions.source,
    policy,
    target: "link",
  });
};

export const sanitizeImageSrc = (value: unknown, options?: string | UrlSanitizeOptions) => {
  const resolvedOptions = resolveUrlOptions(options);
  const policy = resolveSecurityPolicy(resolvedOptions.policy);
  return (
    sanitizeUrlWithProtocols(value, new Set(policy.mediaProtocols), {
      allowRelative: policy.allowRelativeMedia,
      allowDataImage: policy.allowDataImage,
      baseUrl: resolvedOptions.baseUrl || policy.baseUrl,
      source: resolvedOptions.source,
      policy,
      target: "image",
    }) || ""
  );
};

export const sanitizeVideoSrc = (value: unknown, options?: string | UrlSanitizeOptions) => {
  const resolvedOptions = resolveUrlOptions(options);
  const policy = resolveSecurityPolicy(resolvedOptions.policy);
  return (
    sanitizeUrlWithProtocols(value, new Set(policy.mediaProtocols), {
      allowRelative: policy.allowRelativeMedia,
      allowDataImage: false,
      baseUrl: resolvedOptions.baseUrl || policy.baseUrl,
      source: resolvedOptions.source,
      policy,
      target: "video",
    }) || ""
  );
};

export const sanitizeAudioSrc = (value: unknown, options?: string | UrlSanitizeOptions) => {
  const resolvedOptions = resolveUrlOptions(options);
  const policy = resolveSecurityPolicy(resolvedOptions.policy);
  return (
    sanitizeUrlWithProtocols(value, new Set(policy.mediaProtocols), {
      allowRelative: policy.allowRelativeMedia,
      allowDataImage: false,
      baseUrl: resolvedOptions.baseUrl || policy.baseUrl,
      source: resolvedOptions.source,
      policy,
      target: "video",
    }) || ""
  );
};

export const sanitizePosterSrc = (value: unknown, options?: string | UrlSanitizeOptions) => {
  const resolvedOptions = resolveUrlOptions(options);
  const policy = resolveSecurityPolicy(resolvedOptions.policy);
  return (
    sanitizeUrlWithProtocols(value, new Set(policy.mediaProtocols), {
      allowRelative: policy.allowRelativeMedia,
      allowDataImage: policy.allowDataImage,
      baseUrl: resolvedOptions.baseUrl || policy.baseUrl,
      source: resolvedOptions.source,
      policy,
      target: "poster",
    }) || ""
  );
};

const isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const sanitizeMarkJson = (
  mark: unknown,
  options: {
    source?: string;
    policy: ResolvedSecurityPolicy;
  }
) => {
  if (!isRecord(mark)) {
    return null;
  }
  const nextMark: Record<string, any> = { ...mark };
  const markType = typeof nextMark.type === "string" ? nextMark.type : "";
  const markAttrs = isRecord(nextMark.attrs) ? { ...nextMark.attrs } : {};

  if (markType === "link") {
    const safeHref = sanitizeLinkHref(markAttrs.href, {
      source: options.source || "json",
      policy: options.policy,
    });
    if (!safeHref) {
      emitSecurityAudit(options.policy, {
        surface: "json",
        target: "mark",
        decision: "drop",
        value: String(markAttrs.href || ""),
        reason: "unsafe-link-mark",
        source: options.source,
      });
      return null;
    }
    if (String(markAttrs.href || "") !== safeHref) {
      emitSecurityAudit(options.policy, {
        surface: "json",
        target: "link",
        decision: "sanitize",
        value: String(markAttrs.href || ""),
        reason: "normalized-link-mark",
        source: options.source,
      });
    }
    markAttrs.href = safeHref;
  }

  nextMark.attrs = markAttrs;
  return nextMark;
};

const sanitizeNodeAttrs = (
  nodeType: string,
  attrs: Record<string, any>,
  options: {
    source?: string;
    policy: ResolvedSecurityPolicy;
  }
) => {
  const nextAttrs = { ...attrs };
  if (nodeType === "image") {
    const previous = String(nextAttrs.src || "");
    const next = sanitizeImageSrc(nextAttrs.src, {
      source: options.source || "json",
      policy: options.policy,
    });
    if (previous && !next) {
      emitSecurityAudit(options.policy, {
        surface: "json",
        target: "image",
        decision: "drop",
        value: previous,
        reason: "unsafe-image-src",
        source: options.source,
      });
    } else if (previous && previous !== next) {
      emitSecurityAudit(options.policy, {
        surface: "json",
        target: "image",
        decision: "sanitize",
        value: previous,
        reason: "normalized-image-src",
        source: options.source,
      });
    }
    nextAttrs.src = next;
  }
  if (nodeType === "video") {
    const previousSrc = String(nextAttrs.src || "");
    const nextSrc = sanitizeVideoSrc(nextAttrs.src, {
      source: options.source || "json",
      policy: options.policy,
    });
    if (previousSrc && !nextSrc) {
      emitSecurityAudit(options.policy, {
        surface: "json",
        target: "video",
        decision: "drop",
        value: previousSrc,
        reason: "unsafe-video-src",
        source: options.source,
      });
    } else if (previousSrc && previousSrc !== nextSrc) {
      emitSecurityAudit(options.policy, {
        surface: "json",
        target: "video",
        decision: "sanitize",
        value: previousSrc,
        reason: "normalized-video-src",
        source: options.source,
      });
    }

    const previousPoster = String(nextAttrs.poster || "");
    const nextPoster = sanitizePosterSrc(nextAttrs.poster, {
      source: options.source || "json",
      policy: options.policy,
    });
    if (previousPoster && !nextPoster) {
      emitSecurityAudit(options.policy, {
        surface: "json",
        target: "poster",
        decision: "drop",
        value: previousPoster,
        reason: "unsafe-poster-src",
        source: options.source,
      });
    } else if (previousPoster && previousPoster !== nextPoster) {
      emitSecurityAudit(options.policy, {
        surface: "json",
        target: "poster",
        decision: "sanitize",
        value: previousPoster,
        reason: "normalized-poster-src",
        source: options.source,
      });
    }

    nextAttrs.src = nextSrc;
    nextAttrs.poster = nextPoster;
  }
  return nextAttrs;
};

const sanitizeNodeJson = (
  node: unknown,
  options: {
    source?: string;
    policy: ResolvedSecurityPolicy;
  }
): Record<string, any> | null => {
  if (!isRecord(node)) {
    return null;
  }
  const nextNode: Record<string, any> = { ...node };
  const nodeType = typeof nextNode.type === "string" ? nextNode.type : "";

  if (isRecord(nextNode.attrs)) {
    nextNode.attrs = sanitizeNodeAttrs(nodeType, nextNode.attrs, options);
  } else if (nodeType === "image" || nodeType === "video") {
    nextNode.attrs = sanitizeNodeAttrs(nodeType, {}, options);
  }

  if (Array.isArray(nextNode.marks)) {
    nextNode.marks = nextNode.marks
      .map((mark) => sanitizeMarkJson(mark, options))
      .filter(Boolean);
    if (nextNode.marks.length === 0) {
      delete nextNode.marks;
    }
  }

  if (Array.isArray(nextNode.content)) {
    nextNode.content = nextNode.content
      .map((childNode) => sanitizeNodeJson(childNode, options))
      .filter(Boolean);
  }

  return nextNode;
};

export const sanitizeDocJson = (docJson: unknown, options: JsonSanitizeOptions = {}) => {
  const policy = resolveSecurityPolicy(options.policy);
  return sanitizeNodeJson(docJson, {
    source: options.source || "json",
    policy,
  });
};

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
  const policy = resolveSecurityPolicy(options.policy);
  const source = options.source || "paste-html";
  const {
    blockedTags = policy.blockedTags,
    dropEventAttributes = policy.dropEventAttributes,
    dropStyleAttribute = policy.dropStyleAttribute,
    allowHref = (value) =>
      sanitizeLinkHref(value, {
        policy,
        source,
      }) != null,
    allowSrc = (value) =>
      sanitizeImageSrc(value, {
        policy,
        source,
      }) !== "" ||
      sanitizeVideoSrc(value, {
        policy,
        source,
      }) !== "",
  } = options;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  for (const tag of blockedTags) {
    doc.querySelectorAll(tag).forEach((node) => {
      emitSecurityAudit(policy, {
        surface: "html",
        target: "tag",
        decision: "drop",
        value: tag,
        reason: "blocked-tag",
        source,
      });
      node.remove();
    });
  }

  doc.body.querySelectorAll("*").forEach((el) => {
    const attrs = Array.from(el.attributes || []);
    for (const attr of attrs) {
      const name = String(attr.name || "").toLowerCase();
      const value = String(attr.value || "");
      if (dropEventAttributes && name.startsWith("on")) {
        emitSecurityAudit(policy, {
          surface: "html",
          target: "attribute",
          decision: "drop",
          value: `${name}=${value}`,
          reason: "event-attribute",
          source,
        });
        el.removeAttribute(attr.name);
        continue;
      }
      if (dropStyleAttribute && name === "style") {
        emitSecurityAudit(policy, {
          surface: "html",
          target: "attribute",
          decision: "drop",
          value: `${name}=${value}`,
          reason: "style-attribute",
          source,
        });
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" && !allowHref(value)) {
        emitSecurityAudit(policy, {
          surface: "html",
          target: "href",
          decision: "drop",
          value,
          reason: "unsafe-href",
          source,
        });
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "src" && !allowSrc(value)) {
        emitSecurityAudit(policy, {
          surface: "html",
          target: "src",
          decision: "drop",
          value,
          reason: "unsafe-src",
          source,
        });
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
export const normalizeNavigableHref = (href: string, options?: string | UrlSanitizeOptions) =>
  sanitizeLinkHref(href, options);
