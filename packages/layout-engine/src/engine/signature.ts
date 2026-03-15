/**
 * 把数字稳定写入哈希值，避免浮点噪声影响缓存判断。
 */
export function hashNumber(hash: number, value: number) {
  const num = Number.isFinite(value) ? Math.round(value) : 0;
  return (hash * 31 + num) | 0;
}

/**
 * 把字符串稳定写入哈希值，供布局缓存与页复用比较使用。
 */
export function hashString(hash: number, value: string) {
  if (!value) {
    return hash;
  }
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

const objectIdentityTokens = new WeakMap<object, number>();
let nextObjectIdentityToken = 1;

/**
 * 为无法稳定序列化的对象分配一次性标识，用于缓存签名兜底。
 */
function getObjectIdentityToken(value: unknown) {
  const obj = value as object;
  if (objectIdentityTokens.has(obj)) {
    return objectIdentityTokens.get(obj) || 0;
  }
  const token = nextObjectIdentityToken++;
  objectIdentityTokens.set(obj, token);
  return token;
}

/**
 * 把任意值折叠进缓存签名，兼容对象、函数与数组。
 */
function hashCacheSignatureValue(hash: number, value: unknown): number {
  if (value == null) {
    return hashString(hash, "null");
  }
  if (typeof value === "string") {
    return hashString(hash, value);
  }
  if (typeof value === "number") {
    return hashNumber(hash, value);
  }
  if (typeof value === "boolean") {
    return hashNumber(hash, value ? 1 : 0);
  }
  if (typeof value === "bigint") {
    return hashString(hash, value.toString());
  }
  if (Array.isArray(value)) {
    let next = hashNumber(hash, value.length);
    for (const item of value) {
      next = hashCacheSignatureValue(next, item);
    }
    return next;
  }
  if (typeof value === "object" || typeof value === "function") {
    return hashNumber(hash, getObjectIdentityToken(value));
  }
  return hashString(hash, String(value));
}

/**
 * 把 attrs 对象稳定写入哈希值，用于块级缓存签名。
 */
function hashAttrs(hash: number, attrs: Record<string, any> | null | undefined) {
  if (!attrs || typeof attrs !== "object") {
    return hash;
  }
  const keys = Object.keys(attrs).sort();
  for (const key of keys) {
    hash = hashString(hash, key);
    const value = attrs[key];
    if (typeof value === "string") {
      hash = hashString(hash, value);
      continue;
    }
    if (typeof value === "number") {
      hash = hashNumber(hash, value);
      continue;
    }
    if (typeof value === "boolean") {
      hash = hashNumber(hash, value ? 1 : 0);
      continue;
    }
    if (Array.isArray(value)) {
      hash = hashNumber(hash, value.length);
      for (const item of value) {
        if (typeof item === "string") {
          hash = hashString(hash, item);
        } else if (typeof item === "number") {
          hash = hashNumber(hash, item);
        } else if (typeof item === "boolean") {
          hash = hashNumber(hash, item ? 1 : 0);
        } else if (item != null) {
          hash = hashString(hash, JSON.stringify(item));
        }
      }
      continue;
    }
    if (value == null) {
      hash = hashString(hash, "null");
      continue;
    }
    hash = hashString(hash, JSON.stringify(value));
  }
  return hash;
}

/**
 * 递归计算对象结构签名，避免重复做大对象深比较。
 */
function hashObjectLike(hash: number, value: Record<string, any>, cache?: WeakMap<object, number>) {
  if (!value || typeof value !== "object") {
    return hash;
  }
  if (cache?.has(value)) {
    return hashNumber(hash, cache.get(value) || 0);
  }
  const keys = Object.keys(value).sort();
  let objectHash = 17;
  for (const key of keys) {
    objectHash = hashString(objectHash, key);
    const item = value[key];
    if (typeof item === "string") {
      objectHash = hashString(objectHash, item);
      continue;
    }
    if (typeof item === "number") {
      objectHash = hashNumber(objectHash, item);
      continue;
    }
    if (typeof item === "boolean") {
      objectHash = hashNumber(objectHash, item ? 1 : 0);
      continue;
    }
    if (Array.isArray(item)) {
      objectHash = hashNumber(objectHash, item.length);
      for (const entry of item) {
        if (typeof entry === "string") {
          objectHash = hashString(objectHash, entry);
        } else if (typeof entry === "number") {
          objectHash = hashNumber(objectHash, entry);
        } else if (typeof entry === "boolean") {
          objectHash = hashNumber(objectHash, entry ? 1 : 0);
        } else if (entry == null) {
          objectHash = hashString(objectHash, "null");
        } else {
          objectHash = hashObjectLike(objectHash, entry, cache);
        }
      }
      continue;
    }
    if (item == null) {
      objectHash = hashString(objectHash, "null");
      continue;
    }
    objectHash = hashObjectLike(objectHash, item, cache);
  }
  const signature = objectHash >>> 0;
  cache?.set(value, signature);
  return hashNumber(hash, signature);
}

/**
 * 为任意对象生成稳定签名，供布局缓存和页复用比较使用。
 */
export function getObjectSignature(value: unknown, cache?: WeakMap<object, number>) {
  if (!value || typeof value !== "object") {
    return 0;
  }
  if (cache?.has(value)) {
    return cache.get(value) || 0;
  }
  const signature = hashObjectLike(17, value as Record<string, any>, cache) >>> 0;
  cache?.set(value as object, signature);
  return signature;
}

/**
 * 计算单个 block 的布局缓存签名，决定是否可以直接复用缓存结果。
 */
export function getBlockLayoutSignature(
  block: any,
  settings: any,
  indent: number,
  renderer: any,
  registry: any
) {
  let hash = 17;
  const blockHash =
    block && typeof block.hashCode === "function" ? Number(block.hashCode()) : Number.NaN;
  if (Number.isFinite(blockHash)) {
    hash = hashNumber(hash, blockHash);
  } else {
    hash = hashString(hash, block?.type?.name || "");
    hash = hashAttrs(hash, block?.attrs || null);
    hash = hashNumber(hash, block?.nodeSize);
    hash = hashNumber(hash, block?.childCount);
    hash = hashString(hash, block?.textContent || "");
  }
  hash = hashNumber(hash, indent || 0);
  hash = hashNumber(hash, settings?.pageWidth);
  hash = hashNumber(hash, settings?.lineHeight);
  hash = hashString(hash, settings?.font || "");
  const getCacheSignature = renderer?.getCacheSignature;
  if (typeof getCacheSignature === "function") {
    try {
      const customSignature = getCacheSignature({
        node: block,
        settings,
        registry,
        indent,
      });
      hash = hashString(hash, "__custom_cache_signature__");
      hash = hashCacheSignatureValue(hash, customSignature);
    } catch (_error) {
      // 自定义签名是可选能力，失败时回退默认签名即可。
    }
  }
  return hash >>> 0;
}
