# 分页布局设计（2026-02-27）

## 1. 设计目标

分页引擎同时满足：

- 正确性：文档结构、选区映射、命中坐标稳定
- 性能：支持增量布局与页面复用
- 可扩展：节点分页能力由 `node-*` 扩展，不在核心写死节点细节

## 2. 模块边界（当前）

- `packages/engine/layout-engine/src/engine.ts`
  - `layoutFromDoc` 主入口
  - 增量布局、分页切分、缓存复用
- `packages/engine/layout-engine/src/textRuns.ts`
  - doc -> runs
- `packages/engine/layout-engine/src/lineBreaker.ts`
  - runs -> lines
- `packages/engine/layout-engine/src/nodeRegistry.ts`
  - 节点布局/绘制扩展注册
- `packages/engine/view-canvas/src/layout-pagination/*`
  - 兼容转发层（门面），不承载核心算法

## 3. 关键数据

- `Run`：文本布局单元
- `Line`：换行结果与命中信息
- `Page`：分页后的行集合
- `LayoutResult`：`pages + mapping + settings` 相关输出

## 4. 布局主流程

1. `layoutFromDoc(doc, options)`
2. 生成 runs
3. 行断开（line break）
4. 按页高分页
5. 输出 `LayoutResult`

## 5. 增量与缓存

1. `changeSummary` 驱动受影响块重排
2. 块缓存按签名复用，减少重复计算
3. 渐进分页支持先可交互、后补全

## 6. 复杂节点分页协议

节点可通过注册表实现：

- `layoutBlock`：自定义块布局
- `splitBlock`：跨页拆分
- `allowSplit`：拆分策略
- `getCacheSignature`：缓存签名

表格节点已走该协议，并支持行级/行内分页。

## 7. 渲染协同

- 页面内容层：canvas 页面缓存
- overlay 层：选区、光标、装饰、NodeView
- 布局与绘制解耦：布局引擎不直接操作 DOM

## 8. Worker 策略

- 可在 worker 计算分页
- 复杂场景可回退主线程，优先正确性
- Lumen 侧 provider：`apps/lumen/src/editor/paginationDocWorkerClient.ts`

## 9. 调试入口

- `?debugPerf=1`
- `?paginationWorker=1`
- `?paginationWorkerForce=1`
- `?paginationIncremental=1`
- `?paginationMaxPages=<n>`
- `?paginationSettleMs=<ms>`
