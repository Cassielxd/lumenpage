import { Plugin } from "lumenpage-state";

const createBlockId = () => `block_${Date.now().toString(36)}_${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const hasIdAttr = (node) =>
  !!node?.type?.spec?.attrs && Object.prototype.hasOwnProperty.call(node.type.spec.attrs, "id");

export const createBlockIdTransaction = (state) => {
  let tr = state.tr;
  let changed = false;

  state.doc.descendants((node, pos) => {
    if (!node.isBlock || !hasIdAttr(node)) {
      return;
    }

    if (node.attrs?.id) {
      return;
    }

    const id = createBlockId();
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, id }, node.marks);
    changed = true;
  });

  return changed ? tr : null;
};

export const createBlockIdPlugin = () =>
  new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) {
        return null;
      }

      return createBlockIdTransaction(newState);
    },
  });
