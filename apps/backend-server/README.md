# lumenpage-backend-server

This service is the unified backend entry for LumenPage. It uses `Fastify` as the HTTP framework and mounts `Hocuspocus` collaboration on the same port, so account/auth APIs, document/share APIs, collaboration persistence, and the DeepSeek proxy all live in one place.

## Usage

```bash
pnpm -C apps/backend-server dev
```

HTTP base URL: `http://127.0.0.1:1234`

Default WebSocket URL: `ws://127.0.0.1:1234`

Health check: `http://127.0.0.1:1234/health`

AI proxy endpoint: `http://127.0.0.1:1234/ai/deepseek/chat/completions`

## Main API Groups

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/:documentId`
- `PATCH /api/documents/:documentId`
- `GET /api/documents/:documentId/members`
- `POST /api/documents/:documentId/members`
- `PUT /api/documents/:documentId/members/:userId`
- `DELETE /api/documents/:documentId/members/:userId`
- `GET /api/documents/:documentId/share-links`
- `POST /api/documents/:documentId/share-links`
- `DELETE /api/share-links/:shareId`
- `GET /api/share-links/:token`
- `POST /api/documents/:documentId/collab-ticket`

## Environment Variables

- `HOST`: HTTP and WebSocket listen host, default `127.0.0.1`
- `PORT`: HTTP and WebSocket port, default `1234`
- `BACKEND_NAME`: Service name, default `lumenpage-backend`
- `BACKEND_QUIET`: Reduce backend log noise when `true`
- `HOCUSPOCUS_DEBOUNCE`: Persistence debounce delay, default `2000`
- `HOCUSPOCUS_MAX_DEBOUNCE`: Max persistence debounce, default `10000`
- `BACKEND_STORAGE_DIR`: Shared storage directory, default `./data`
- `BACKEND_ALLOWED_ORIGINS`: Comma-separated HTTP origins for browser clients
- `BACKEND_SESSION_COOKIE`: Session cookie name, default `lumenpage_session`
- `BACKEND_SESSION_TTL_DAYS`: Session TTL in days, default `30`
- `BACKEND_SESSION_SECRET`: Secret used for session-related operations
- `BACKEND_COLLAB_SECRET`: Secret used to sign collaboration tickets
- `BACKEND_COLLAB_TICKET_TTL_MINUTES`: Collaboration ticket TTL, default `60`
- `BACKEND_ENFORCE_COLLAB_TICKETS`: Require signed collab tickets for WebSocket access
- `COLLAB_AUTH_TOKEN`: Optional legacy raw collaboration token for older clients
- `DEEPSEEK_API_KEY`: DeepSeek API key used by the server-side proxy
- `DEEPSEEK_MODEL`: Optional default model if the client does not send one
- `DEEPSEEK_BASE_URL`: Optional DeepSeek base URL, default `https://api.deepseek.com`

## Collaboration

The backend keeps the existing Lumen client contract:

- Collaboration still connects to `ws://127.0.0.1:1234`
- Documents are persisted as Yjs updates under `BACKEND_STORAGE_DIR`
- Legacy raw token auth still works if `COLLAB_AUTH_TOKEN` is configured
- New clients can request a scoped collaboration ticket from `/api/documents/:documentId/collab-ticket`

## AI Proxy

`/ai/deepseek/chat/completions` calls the official DeepSeek `Chat Completions API` on the server. The browser never needs to expose an API key.

Example request body:

```json
{
  "model": "deepseek-chat",
  "intent": "rewrite",
  "instruction": "Make it more concise",
  "text": "Original content",
  "source": "selection",
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
