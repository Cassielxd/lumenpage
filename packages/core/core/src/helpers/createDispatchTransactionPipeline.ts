import type { Transaction } from "lumenpage-state";

import { getExtensionField } from "./getExtensionField.js";
import { sortExtensions } from "./sortExtensions.js";
import type { AnyExtension, DispatchTransactionProps, ExtensionContext } from "../types.js";

export const createDispatchTransactionPipeline = ({
  extensions,
  getContext,
  baseDispatch,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  baseDispatch: (transaction: Transaction) => void;
}) =>
  sortExtensions(extensions).reduceRight((next, extension) => {
    const ctx = getContext(extension);
    const dispatchTransaction = getExtensionField<
      ((props: DispatchTransactionProps) => void) | undefined
    >(extension, "dispatchTransaction", ctx);

    if (!dispatchTransaction) {
      return next;
    }

    return (transaction: Transaction) => {
      dispatchTransaction.call(ctx, { transaction, next });
    };
  }, baseDispatch);
