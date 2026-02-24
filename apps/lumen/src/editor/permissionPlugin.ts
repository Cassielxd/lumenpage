import { Plugin } from "lumenpage-state";

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
      // 评论态/只读态禁止文档写入；选区变化与滚动事务允许通过。
      if (tr.docChanged) {
        return false;
      }
      return true;
    },
  });
};
