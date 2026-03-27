export function callOrReturn<Value>(value: Value | (() => Value), fallback: Value): Value;
export function callOrReturn<Value>(
  value: Value | (() => Value) | undefined,
  fallback?: Value
): Value | undefined;
export function callOrReturn<Value>(
  value: Value | (() => Value) | undefined,
  fallback?: Value
): Value | undefined {
  if (typeof value === "function") {
    return (value as () => Value)();
  }

  return value ?? fallback;
}
