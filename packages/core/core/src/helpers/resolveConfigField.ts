import { getExtensionField } from "./getExtensionField";
import { callOrReturn } from "../utilities/callOrReturn";
import type { ExtensionContext, ExtensionInstance } from "../types";

export const resolveConfigField = <Value>(
  instance: ExtensionInstance,
  ctx: ExtensionContext,
  field: string,
  fallback: Value
) =>
  callOrReturn(getExtensionField<Value | (() => Value)>(instance.extension, field, ctx), fallback) as Value;
