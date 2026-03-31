# lumenpage-collab-server

Based on `@hocuspocus/server`, this service provides collaboration persistence, health checks, and a DeepSeek proxy for Lumen.

## Usage

```bash
pnpm -C apps/collab-server dev
```

Default WebSocket URL: `ws://127.0.0.1:1234`

Health check: `http://127.0.0.1:1234/health`

AI proxy endpoint: `http://127.0.0.1:1234/ai/deepseek/chat/completions`

## Environment Variables

- `PORT`: WebSocket port, default `1234`
- `HOCUSPOCUS_NAME`: Service name, default `lumenpage-collab`
- `HOCUSPOCUS_QUIET`: Disable startup banner when `true`
- `HOCUSPOCUS_DEBOUNCE`: Persistence debounce delay, default `2000`
- `HOCUSPOCUS_MAX_DEBOUNCE`: Max persistence debounce, default `10000`
- `COLLAB_STORAGE_DIR`: Document storage directory, default `./data`
- `COLLAB_AUTH_TOKEN`: Optional auth token for collaboration clients
- `DEEPSEEK_API_KEY`: DeepSeek API key used by the server-side proxy
- `DEEPSEEK_MODEL`: Optional default model if the client does not send one
- `DEEPSEEK_BASE_URL`: Optional DeepSeek base URL, default `https://api.deepseek.com`

## AI Proxy

`/ai/deepseek/chat/completions` calls the official DeepSeek `Chat Completions API` on the server. The browser never needs to expose an API key.

Example request body:

```json
{
  "model": "deepseek-chat",
  "intent": "rewrite",
  "instruction": "Make it more concise",
  "text": "Original content",
  "documentText": "Full document context",
  "systemPrompt": ""
}
```

Example response body:

```json
{
  "ok": true,
  "outputText": "Rewritten content",
  "completionId": "chatcmpl_xxx",
  "model": "deepseek-chat"
}
```

## Client Example

```ts
import { HocuspocusProvider } from "@hocuspocus/provider";

const provider = new HocuspocusProvider({
  url: "ws://127.0.0.1:1234",
  name: "demo-doc",
  token: "",
});
```
