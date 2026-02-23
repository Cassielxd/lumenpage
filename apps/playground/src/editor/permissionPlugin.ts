import { Plugin } from "lumenpage-state";

export type PlaygroundPermissionMode = "full" | "comment" | "readonly";

// 基于事务过滤实现权限控制：不修改核心，仅在接入层拦截文档写操作。
export const createPlaygroundPermissionPlugin = (mode: PlaygroundPermissionMode) => {
  if (mode === "full" || mode === "comment") {
    return null;
  }
  return new Plugin({
    filterTransaction(tr) {
      if (!tr) {
        return true;
      }
      // 只读态禁止文档写入；选区变化与滚动类事务允许通过。
      if (tr.docChanged) {
        return false;
      }
      return true;
    },
  });
};
