type CanvasNodeViewLike = any;

/*
 * 鑺傜偣娓叉煋娉ㄥ唽琛細鎸夎妭鐐圭被鍨嬫寕杞藉竷灞€/娓叉煋瀹炵幇銆?
 */

export type NodeLayoutResult = {
  lines: any[];
  length: number;
  height?: number;
  blockAttrs?: any;
  blockLineHeight?: number;
  overflow?: NodeLayoutResult;
  fragments?: NodeLayoutSplitFragment[];
};

export type NodeLayoutSplitFragment = {
  kind?: "visible" | "overflow";
  lines: any[];
  length: number;
  height?: number;
  continuation?: {
    fromPrev?: boolean;
    hasNext?: boolean;
    rowSplit?: boolean;
  };
};

export type ContainerStyle = {
  indent?: number;
  [key: string]: any;
};

export type NodeRendererPaginationConfig = {
  fragmentModel?: "none" | "continuation";
  reusePolicy?: "actual-slice-only" | "always-sensitive";
};

// 鑺傜偣娓叉煋鎺ュ彛锛氬彲瑕嗙洊 runs銆佸垎鍧楀竷灞€涓庡鍣ㄦ覆鏌撱€?
export type NodeRenderer = {
  toRuns?: (node: any, settings: any, registry?: any) => any;
  layoutBlock?: (ctx: any) => NodeLayoutResult;
  splitBlock?: (ctx: any) => NodeLayoutResult;
  allowSplit?: boolean;
  pagination?: NodeRendererPaginationConfig;
  cacheLayout?: boolean;
  getCacheSignature?: (ctx: {
    node: any;
    settings: any;
    registry?: any;
    indent?: number;
  }) => unknown;
  renderLine?: (ctx: any) => void;
  getContainerStyle?: (ctx: any) => ContainerStyle | null;
  renderContainer?: (ctx: any) => void;
  createNodeView?: (node: any, view: any, getPos: () => number) => CanvasNodeViewLike;
};

export class NodeRendererRegistry {
  renderers;

  // 鍒濆鍖栨敞鍐岃〃銆?
  constructor() {
    this.renderers = new Map();
  }

  // 娉ㄥ唽鑺傜偣娓叉煋鍣ㄣ€?
  register(typeName, renderer) {
    this.renderers.set(typeName, renderer);

    return this;
  }

  // 鑾峰彇鑺傜偣娓叉煋鍣ㄣ€?
  get(typeName) {
    return this.renderers.get(typeName);
  }

  // 鍒ゆ柇鏄惁宸叉敞鍐屻€?
  has(typeName) {
    return this.renderers.has(typeName);
  }
}



