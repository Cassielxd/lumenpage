import type { Transaction } from "lumenpage-state";

import { getExtensionField } from "./getExtensionField";
import { sortExtensions } from "./sortExtensions";
import type { AnyExtension, DispatchTransactionProps, ExtensionContext } from "../types";

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
