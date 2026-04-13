import { getExtensionField } from "./getExtensionField.js";
import { callOrReturn } from "../utilities/callOrReturn.js";
import type { ExtensionContext, ExtensionInstance } from "../types.js";

export const resolveConfigField = <Value>(
  instance: ExtensionInstance,
  ctx: ExtensionContext,
  field: string,
  fallback: Value
) =>
  callOrReturn(getExtensionField<Value | (() => Value)>(instance.extension, field, ctx), fallback) as Value;
