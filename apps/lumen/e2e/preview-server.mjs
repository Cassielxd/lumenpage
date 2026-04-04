import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.dirname(__dirname);
const distDir = path.join(appDir, "dist");
const host = process.env.PW_HOST || process.argv[2] || "localhost";
const port = Number(process.env.PW_PORT || process.argv[3] || "4173");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
};

const resolveRequestPath = (pathname) => {
  const decodedPathname = decodeURIComponent(pathname || "/");
  const normalized = path.normalize(decodedPathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const relativePath = normalized === path.sep ? "index.html" : normalized.replace(/^[/\\]+/, "");
  return path.join(distDir, relativePath);
};

const sendFile = async (response, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const body = await fs.readFile(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  response.end(body);
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
    let filePath = resolveRequestPath(url.pathname);

    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      await sendFile(response, filePath);
      return;
    } catch (_error) {
      const fallbackPath = path.join(distDir, "index.html");
      await sendFile(response, fallbackPath);
      return;
    }
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "preview server error");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`preview-server listening on http://${host}:${port}\n`);
});
