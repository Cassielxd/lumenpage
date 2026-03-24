# lumenpage-link

> 目录：`packages/core/link`

## 包定位
链接工具包，集中处理链接地址解析、清洗和判定逻辑。

## 当前职责
- 清洗和规范化 href。
- 统一链接协议白名单与安全策略。
- 为 extension-link 和渲染层提供基础工具。

## 入口与结构
- 包名：`lumenpage-link`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export type SecurityAuditEvent = {`
- `export type SecurityPolicy = {`
- `export type UrlSanitizeOptions = {`
- `export type JsonSanitizeOptions = {`
- `export type HtmlSanitizeOptions = {`
- `export const getSecurityPolicy = (): SecurityPolicy => ({`
- `export const setSecurityPolicy = (policy: SecurityPolicy = {}) => {`
- `export const resetSecurityPolicy = () => {`
- `export const normalizeUrlLike = (value: unknown) =>`
- `export const hasRelativeUrlPrefix = (value: string) =>`
- `export const sanitizeLinkHref = (value: unknown, options?: string | UrlSanitizeOptions) => {`
- `export const sanitizeImageSrc = (value: unknown, options?: string | UrlSanitizeOptions) => {`

## 依赖关系
### Workspace 依赖
- 无 workspace 依赖。

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { sanitizeLinkHref } from "lumenpage-link";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
