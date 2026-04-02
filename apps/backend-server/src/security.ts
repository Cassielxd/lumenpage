import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const trimText = (value: unknown) => String(value ?? "").trim();

export const createId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "")}`;

export const createOpaqueToken = (size = 24) => randomBytes(size).toString("base64url");

export const hashPassword = (password: string) => {
  const normalized = String(password ?? "");
  if (normalized.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, 64).toString("hex");
  return { salt, hash };
};

export const verifyPassword = (password: string, salt: string, expectedHash: string) => {
  try {
    const actual = Buffer.from(scryptSync(String(password ?? ""), salt, 64).toString("hex"), "hex");
    const expected = Buffer.from(String(expectedHash ?? ""), "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch (_error) {
    return false;
  }
};

export const parseCookies = (header: string | undefined) => {
  const entries = String(header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const cookies: Record<string, string> = {};
  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const name = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    cookies[name] = decodeURIComponent(value);
  }
  return cookies;
};

export const serializeCookie = (
  name: string,
  value: string,
  options: {
    path?: string;
    maxAge?: number;
    httpOnly?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    secure?: boolean;
  } = {},
) => {
  const parts = [`${name}=${encodeURIComponent(String(value ?? ""))}`];
  parts.push(`Path=${options.path || "/"}`);

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const clearCookie = (name: string) =>
  serializeCookie(name, "", {
    maxAge: 0,
  });

export const signPayload = <T extends object>(payload: T, secret: string) => {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

export const verifySignedPayload = <T extends object>(token: string, secret: string) => {
  const normalized = trimText(token);
  if (!normalized) {
    return null as T | null;
  }

  const [encoded, providedSignature] = normalized.split(".");
  if (!encoded || !providedSignature) {
    return null as T | null;
  }

  const expectedSignature = createHmac("sha256", secret).update(encoded).digest("base64url");
  const actualBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null as T | null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      expiresAt?: string;
    } & T;
    if (payload?.expiresAt) {
      const expiresAt = Date.parse(payload.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return null as T | null;
      }
    }
    return payload as T;
  } catch (_error) {
    return null as T | null;
  }
};
