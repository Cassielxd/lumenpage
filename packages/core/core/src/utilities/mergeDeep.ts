import { isPlainObject } from "./isPlainObject";

export const mergeDeep = <T>(base: T, patch: any): T => {
  if (patch == null) {
    return base;
  }

  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T;
  }

  const result: Record<string, any> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    result[key] = isPlainObject(current) && isPlainObject(value) ? mergeDeep(current, value) : value;
  }

  return result as T;
};
