/**
 * Host half of the produce-preview plugin.
 *
 * Registers an HTTP route on the Web surface that serves the byte content of a
 * file the agent just produced (an image, video, or spreadsheet), so the
 * browser can render it inline (`<img>`, `<video>`, `<table>`) without the
 * client ever needing raw shell access. The route rides the shared `/api`
 * channel, so it inherits the connection's Host/Origin fence and browser
 * authentication, and it streams bytes with a correct content-type plus
 * `Accept-Ranges`/`Range` (206) so `<video>` can seek and `HEAD` works.
 *
 * Authorization is "workspace-scoped": the requested relative path is resolved
 * against a workspace root and rejected when it escapes that root (bare
 * absolute paths and `..` climbs are refused). Root resolution prefers an
 * explicit `root` config, then the first registered workspace, then the
 * process cwd. Session-scoped multi-workspace pinning is a later refinement.
 *
 * The browser half (./client) decides WHICH produced files to preview and asks
 * this route for their bytes.
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { isAbsolute, resolve, sep, extname } from 'node:path'
import type { Readable } from 'node:stream'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

/** Stable Cordis plugin name. */
export const name = 'produce-preview'

/** Services required before the route can mount. */
export const inject = ['connection']

/** Stable browser-requested path for this route (under the shared `/api` prefix). */
export const PRODUCED_FILE_PATH = '/api/produced.file'

/** Plugin config: how to bound the file-serving root and any size caps. */
export interface Config {
  /**
   * Absolute workspace root files are resolved against and confined to.
   * Omit to auto-detect (first registered workspace, else process cwd).
   */
  readonly root?: string
  /** Maximum number of bytes a single response may stream. @default 512 MiB */
  readonly maxBytes?: number
  /** Whether to allow range requests (video seeking). @default true */
  readonly allowRange?: boolean
}

/** Validate and normalize plugin config. */
export const Config: Schema<Config> = Schema.object({
  root: Schema.string().required(false),
  maxBytes: Schema.number().required(false).integer().min(0)
    .default(512 * 1024 * 1024) as Schema<number>,
  allowRange: Schema.boolean().required(false).default(true) as Schema<boolean>,
})

/** Media-type map keyed by lowercase file extension. */
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.csv': 'text/csv; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
}

/** The loose interface of the connection service the route registers on. */
interface ConnectionLike {
  fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly ('GET' | 'HEAD')[]
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void>
    readonly apiPrefix?: string
  }
}

/** Optional workspace registry used to auto-detect a root. */
interface WorkspaceRegistryLike {
  list(): readonly { path: string }[]
}

/**
 * Mount the produced-file serving route.
 * @param ctx - host context carrying the connection service.
 * @param config - resolved root and caps.
 */
export function apply(ctx: Context, config: Config): void {
  const root = resolveRoot(ctx, config)
  connectionOf(ctx).fetch.register({
    path: PRODUCED_FILE_PATH,
    methods: ['GET', 'HEAD'],
    fetch: (request) => serveFile(root, config, request),
  })
}

function connectionOf(ctx: Context): ConnectionLike {
  return Reflect.get(ctx, 'connection') as ConnectionLike
}

function workspaceRegistryOf(ctx: Context): WorkspaceRegistryLike | undefined {
  const candidate = Reflect.get(ctx, 'workspaceRegistry') as WorkspaceRegistryLike | undefined
  return typeof candidate?.list === 'function' ? candidate : undefined
}

function resolveRoot(ctx: Context, config: Config): string {
  if (config.root !== undefined && config.root.length > 0) return resolve(config.root)
  const registry = workspaceRegistryOf(ctx)
  const first = registry?.list()[0]?.path
  if (first !== undefined) return resolve(first)
  // Last resort: the process cwd. A single-workspace Web session is the
  // common case; multi-workspace pinning is documented as a TODO.
  return resolve(process.cwd())
}

/** Whether `path` stays within `root` (Windows path case differs). */
function withinRoot(root: string, path: string): boolean {
  const normalizedRoot = normalizeCase(root)
  const normalizedPath = normalizeCase(path)
  return normalizedPath === normalizedRoot
    || normalizedPath.startsWith(normalizedRoot + sep)
    || normalizedPath.startsWith(normalizedRoot + '/')
}

function normalizeCase(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value
}

/** Convert a Node Readable to a Web ReadableStream for the Response body. */
function toWeb(stream: Readable): ReadableStream<Uint8Array> {
  const reader = (stream as unknown as { [Symbol.asyncIterator](): AsyncIterableIterator<Buffer> })
    [Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.next()
      if (done) {
        controller.close()
        return
      }
      controller.enqueue(value)
    },
    cancel() {
      stream.destroy()
    },
  })
}

/** Content-type from the file extension, with the octet-stream fallback. */
function contentTypeOf(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Serve one requested produced file.
 * @param root - the authorized workspace root.
 * @param config - size and range caps.
 * @param request - the browser GET/HEAD request.
 * @returns a streaming, range-aware Response.
 */
async function serveFile(root: string, config: Config, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const rawPath = url.searchParams.get('path')
  if (rawPath === null || rawPath.length === 0) {
    return new Response('missing "path" query parameter', { status: 400 })
  }
  // A relative path only: absolute paths and `..` climbs are refused up front.
  if (isAbsolute(rawPath) || rawPath.includes('..')) {
    return new Response('path must be relative to the workspace root', { status: 403 })
  }
  const resolved = resolve(root, rawPath)
  if (!withinRoot(root, resolved)) {
    return new Response('path escapes the workspace root', { status: 403 })
  }

  let fileStat: { size: number }
  try {
    fileStat = await stat(resolved)
  } catch {
    return new Response('file not found', { status: 404 })
  }
  if (!fileStat.size || fileStat.size === 0) {
    return new Response('file is empty', { status: 204 })
  }
  if (fileStat.size > config.maxBytes) {
    return new Response('file exceeds the size cap', { status: 413 })
  }

  const contentType = contentTypeOf(resolved)
  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-length': String(fileStat.size),
    ...(config.allowRange ? { 'accept-ranges': 'bytes' } : {}),
  }

  // Range handling for <video> seeking.
  const range = config.allowRange ? request.headers.get('range') : null
  if (range !== null && range.startsWith('bytes=')) {
    const [startRaw, endRaw] = range.slice('bytes='.length).split('-')
    const start = Number.parseInt(startRaw, 10)
    const endRawValue = endRaw.trim() === '' ? fileStat.size - 1 : Number.parseInt(endRaw, 10)
    if (!Number.isInteger(start) || start < 0 || start >= fileStat.size) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${String(fileStat.size)}` } })
    }
    const end = Math.min(Number.isInteger(endRawValue) ? endRawValue : fileStat.size - 1, fileStat.size - 1)
    if (end < start) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${String(fileStat.size)}` } })
    }
    const length = end - start + 1
    headers['content-range'] = `bytes ${String(start)}-${String(end)}/${String(fileStat.size)}`
    headers['content-length'] = String(length)
    if (request.method === 'HEAD') {
      return new Response(null, { status: 206, headers })
    }
    const stream = createReadStream(resolved, { start, end })
    return new Response(toWeb(stream), { status: 206, headers })
  }

  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  const stream = createReadStream(resolved)
  return new Response(toWeb(stream), { status: 200, headers })
}
