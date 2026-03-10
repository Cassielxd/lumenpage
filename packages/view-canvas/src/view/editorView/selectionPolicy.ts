import { NodeSelection } from "lumenpage-state";

type ResolveNodeSelectionDecisionArgs = {
  node: any;
  pos: number;
  hit?: any;
  event?: any;
  queryEditorProp?: (name: string, ...args: any[]) => any;
  getDefaultNodeSelectionTypes?: (() => Set<string> | null) | null;
};

type ResolveNodeSelectionDecisionResult = {
  allowed: boolean;
  explicit: boolean;
};

const warnedKeys = new Set<string>();
const warnOnce = (key: string, _message: string) => {
  if (warnedKeys.has(key)) {
    return;
  }
  warnedKeys.add(key);
};

// NodeSelection 判定单点：统一处理显式钩子、白名单与默认兜底。
export const resolveNodeSelectionDecision = ({
  node,
  pos,
  hit = null,
  event = null,
  queryEditorProp,
  getDefaultNodeSelectionTypes = null,
}: ResolveNodeSelectionDecisionArgs): ResolveNodeSelectionDecisionResult => {
  if (!node || !NodeSelection.isSelectable(node)) {
    return { allowed: false, explicit: false };
  }

  const explicitDecision =
    typeof queryEditorProp === "function"
      ? queryEditorProp("isNodeSelectionTarget", { node, pos, hit, event })
      : null;

  if (explicitDecision === true) {
    return { allowed: true, explicit: true };
  }
  if (explicitDecision === false) {
    return { allowed: false, explicit: true };
  }
  if (explicitDecision != null) {
    warnOnce(
      "isNodeSelectionTarget-invalid-return",
      "[selection-policy] isNodeSelectionTarget should return true/false/null. Falling back to default policy."
    );
  }

  const fromProps =
    typeof queryEditorProp === "function" ? queryEditorProp("nodeSelectionTypes") : null;
  if (Array.isArray(fromProps) && fromProps.length > 0) {
    return { allowed: fromProps.includes(node.type?.name), explicit: false };
  }
  if (fromProps != null && !Array.isArray(fromProps)) {
    warnOnce(
      "nodeSelectionTypes-invalid-type",
      "[selection-policy] nodeSelectionTypes should be a string array. Falling back to default policy."
    );
  }

  const defaults =
    typeof getDefaultNodeSelectionTypes === "function" ? getDefaultNodeSelectionTypes() : null;
  if (defaults && defaults.size > 0) {
    return { allowed: defaults.has(node.type?.name), explicit: false };
  }

  // 默认行为：可选且非 textblock 节点可作为 NodeSelection 目标。
  return { allowed: node.isTextblock !== true, explicit: false };
};
