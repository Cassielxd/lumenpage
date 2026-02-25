type GetView = () => any;

const buildResetParagraphAttrs = (attrs: Record<string, unknown> = {}) => ({
  id: attrs.id ?? null,
  align: "left",
  indent: 0,
  spacingBefore: null,
  spacingAfter: null,
});

export const createTextFormatActions = ({ getView }: { getView: GetView }) => {
  const clearFormat = () => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.tr || !state?.selection || !state?.schema) {
      return false;
    }

    const { from, to, empty, $from } = state.selection;
    let tr = state.tr;
    let changed = false;

    const markTypes = Object.values(state.schema.marks || {});
    for (const markType of markTypes) {
      tr = tr.removeMark(from, to, markType as any);
    }

    if (empty) {
      tr = tr.setStoredMarks([]);
    }

    const paragraphType = state.schema.nodes?.paragraph;
    const resetBlockAt = (node: any, pos: number) => {
      if (!node?.type?.name) {
        return;
      }
      if (node.type.name === "heading" && paragraphType) {
        tr = tr.setNodeMarkup(
          pos,
          paragraphType,
          buildResetParagraphAttrs(node.attrs || {}),
          node.marks
        );
        changed = true;
        return;
      }
      if (node.type.name === "paragraph") {
        tr = tr.setNodeMarkup(
          pos,
          node.type,
          buildResetParagraphAttrs(node.attrs || {}),
          node.marks
        );
        changed = true;
      }
    };

    if (empty) {
      const parentNode = $from?.parent;
      if (parentNode && $from.depth > 0) {
        resetBlockAt(parentNode, $from.before($from.depth));
      }
    } else {
      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        resetBlockAt(node, pos);
      });
    }

    if (!changed && tr.steps.length === 0 && !tr.storedMarksSet) {
      return false;
    }
    view.dispatch(tr.scrollIntoView());
    return true;
  };

  return {
    clearFormat,
  };
};
