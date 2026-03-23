import { Plugin } from "lumenpage-state";
import { COMMENT_MUTATION_META } from "lumenpage-extension-comment";

export type PlaygroundPermissionMode = "full" | "comment" | "readonly";

// 通过事务过滤实现权限控制：不改核心，仅在接入层拦截文档写入。
export const createPlaygroundPermissionPlugin = (mode: PlaygroundPermissionMode) => {
  if (mode === "full") {
    return null;
  }
  return new Plugin({
    filterTransaction(tr) {
      if (!tr) {
        return true;
      }
      // 只读态禁止所有文档写入；评论态只放行显式标记过的评论事务。
      if (!tr.docChanged) {
        return true;
      }
      if (mode === "comment") {
        return tr.getMeta?.(COMMENT_MUTATION_META) === true;
      }
      return false;
    },
  });
};
