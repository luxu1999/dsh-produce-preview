import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, resolve, sep, extname } from "node:path";
import Schema from "@deepseek-ai/schemastery";
const name = "produce-preview";
const inject = ["connection"];
const PRODUCED_FILE_PATH = "/api/produced.file";
const Config = Schema.object({
  root: Schema.string().required(false),
  maxBytes: Schema.number().required(false).integer().min(0).default(512 * 1024 * 1024),
  allowRange: Schema.boolean().required(false).default(true)
});
const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".csv": "text/csv; charset=utf-8",
  ".tsv": "text/tab-separated-values; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};
function apply(ctx, config) {
  const root = resolveRoot(ctx, config);
  connectionOf(ctx).fetch.register({
    path: PRODUCED_FILE_PATH,
    methods: ["GET", "HEAD"],
    fetch: (request) => serveFile(root, config, request)
  });
}
function connectionOf(ctx) {
  return Reflect.get(ctx, "connection");
}
function workspaceRegistryOf(ctx) {
  const candidate = Reflect.get(ctx, "workspaceRegistry");
  return typeof candidate?.list === "function" ? candidate : void 0;
}
function resolveRoot(ctx, config) {
  if (config.root !== void 0 && config.root.length > 0) return resolve(config.root);
  const registry = workspaceRegistryOf(ctx);
  const first = registry?.list()[0]?.path;
  if (first !== void 0) return resolve(first);
  return resolve(process.cwd());
}
function withinRoot(root, path) {
  const normalizedRoot = normalizeCase(root);
  const normalizedPath = normalizeCase(path);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + sep) || normalizedPath.startsWith(normalizedRoot + "/");
}
function normalizeCase(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function toWeb(stream) {
  const reader = stream[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      stream.destroy();
    }
  });
}
function contentTypeOf(path) {
  return MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
}
async function serveFile(root, config, request) {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path");
  if (rawPath === null || rawPath.length === 0) {
    return new Response('missing "path" query parameter', { status: 400 });
  }
  if (isAbsolute(rawPath) || rawPath.includes("..")) {
    return new Response("path must be relative to the workspace root", { status: 403 });
  }
  const resolved = resolve(root, rawPath);
  if (!withinRoot(root, resolved)) {
    return new Response("path escapes the workspace root", { status: 403 });
  }
  let fileStat;
  try {
    fileStat = await stat(resolved);
  } catch {
    return new Response("file not found", { status: 404 });
  }
  if (!fileStat.size || fileStat.size === 0) {
    return new Response("file is empty", { status: 204 });
  }
  if (fileStat.size > config.maxBytes) {
    return new Response("file exceeds the size cap", { status: 413 });
  }
  const contentType = contentTypeOf(resolved);
  const headers = {
    "content-type": contentType,
    "content-length": String(fileStat.size),
    ...config.allowRange ? { "accept-ranges": "bytes" } : {}
  };
  const range = config.allowRange ? request.headers.get("range") : null;
  if (range !== null && range.startsWith("bytes=")) {
    const [startRaw, endRaw] = range.slice("bytes=".length).split("-");
    const start = Number.parseInt(startRaw, 10);
    const endRawValue = endRaw.trim() === "" ? fileStat.size - 1 : Number.parseInt(endRaw, 10);
    if (!Number.isInteger(start) || start < 0 || start >= fileStat.size) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${String(fileStat.size)}` } });
    }
    const end = Math.min(Number.isInteger(endRawValue) ? endRawValue : fileStat.size - 1, fileStat.size - 1);
    if (end < start) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${String(fileStat.size)}` } });
    }
    const length = end - start + 1;
    headers["content-range"] = `bytes ${String(start)}-${String(end)}/${String(fileStat.size)}`;
    headers["content-length"] = String(length);
    if (request.method === "HEAD") {
      return new Response(null, { status: 206, headers });
    }
    const stream2 = createReadStream(resolved, { start, end });
    return new Response(toWeb(stream2), { status: 206, headers });
  }
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  const stream = createReadStream(resolved);
  return new Response(toWeb(stream), { status: 200, headers });
}
export {
  Config,
  PRODUCED_FILE_PATH,
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
