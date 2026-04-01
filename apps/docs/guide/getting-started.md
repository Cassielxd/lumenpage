# 快速开始

这一页只关注当前仓库最短的启动路径。

## 安装依赖

```bash
pnpm install
```

## 常用启动命令

```bash
pnpm dev                 # 启动 playground
pnpm dev:lumen          # 启动 Lumen
pnpm dev:collab         # 启动 collab-server
pnpm docs:dev           # 启动文档站
```

## 推荐启动顺序

### 1. 先启动协作与 AI 服务

```bash
pnpm dev:collab
```

默认会提供：

- `ws://127.0.0.1:1234`：协作连接
- `http://127.0.0.1:1234/health`：健康检查
- `http://127.0.0.1:1234/ai/*`：AI 代理

### 2. 再启动 Lumen

```bash
pnpm dev:lumen
```

Lumen 是当前最完整的产品壳，已经包含：

- 分页编辑
- 评论与修订
- 协作状态与协作面板
- AI 助手
- 文档标注
- 交互式标尺

### 3. 如果只想看最小链路，再启动 Playground

```bash
pnpm dev
```

Playground 更适合验证底层编辑器能力、扩展装配和引擎行为。

## 文档站

```bash
pnpm docs:dev
```

文档站位于 `apps/docs`，用于承载 LumenPage 的指南、API 和示例页面。

## 推荐阅读顺序

1. [从 Lumen 入口开始](/guide/lumen-entry)
2. [Lumen 运行时配置](/guide/lumen-config)
3. [Lumen 扩展装配](/guide/lumen-extensions)
4. [Lumen App 入口 API](/api/lumen-app)
