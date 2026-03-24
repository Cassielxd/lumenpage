# lumenpage-collab-server

基于 `@hocuspocus/server` 的协作服务，提供最小可用的磁盘持久化与健康检查。

## 用法

```bash
pnpm -C apps/collab-server dev
```

默认地址：`ws://127.0.0.1:1234`

健康检查：`http://127.0.0.1:1234/health`

## 环境变量

- `PORT`: WebSocket 端口，默认 `1234`
- `HOCUSPOCUS_NAME`: 服务实例名，默认 `lumenpage-collab`
- `HOCUSPOCUS_QUIET`: 是否关闭启动横幅，默认 `true`
- `HOCUSPOCUS_DEBOUNCE`: 持久化防抖，默认 `2000`
- `HOCUSPOCUS_MAX_DEBOUNCE`: 持久化最大延迟，默认 `10000`
- `COLLAB_STORAGE_DIR`: 文档二进制存储目录，默认 `./data`
- `COLLAB_AUTH_TOKEN`: 可选鉴权 token；设置后客户端必须传入相同 token

## 客户端示例

```ts
import { HocuspocusProvider } from "@hocuspocus/provider";

const provider = new HocuspocusProvider({
  url: "ws://127.0.0.1:1234",
  name: "demo-doc",
  token: "",
});
```
