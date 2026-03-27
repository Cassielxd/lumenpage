import type { EditorState, Transaction } from "lumenpage-state";

export const createChainableState = ({
  state,
  transaction,
}: {
  state: EditorState;
  transaction: Transaction;
}): EditorState => {
  let { selection } = transaction;
  let { doc } = transaction;
  let { storedMarks } = transaction;

  return {
    ...state,
    apply: state.apply.bind(state),
    applyTransaction: state.applyTransaction.bind(state),
    plugins: state.plugins,
    schema: state.schema,
    reconfigure: state.reconfigure.bind(state),
    toJSON: state.toJSON.bind(state),
    get storedMarks() {
      return storedMarks;
    },
    get selection() {
      return selection;
    },
    get doc() {
      return doc;
    },
    get tr() {
      selection = transaction.selection;
      doc = transaction.doc;
      storedMarks = transaction.storedMarks;
      return transaction;
    },
  } as EditorState;
};
