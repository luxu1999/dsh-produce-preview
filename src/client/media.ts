/**
 * Produce-preview client helpers: classify a produced file path by preview
 * type and build the URL the browser requests for its bytes.
 */

export type PreviewKind = 'image' | 'video' | 'table' | 'other'

const EXT: Record<string, PreviewKind> = {
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.bmp': 'image',
  '.svg': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.m4v': 'video',
  '.csv': 'table',
  '.tsv': 'table',
  '.html': 'table',
  '.htm': 'table',
}

/** The full set of extension keys (excluding the leading dot). */
export const PREVIEW_EXTENSIONS: readonly string[] = Object.keys(EXT).map(ext => ext.slice(1))

/** Classify one path by its file extension. */
export function previewKind(path: string): PreviewKind {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return 'other'
  return EXT[path.slice(dot).toLowerCase()] ?? 'other'
}

/** Whether a path is inline-previewable. */
export function isPreviewable(path: string): boolean {
  return previewKind(path) !== 'other'
}

/**
 * URL for the produced-file byte route. The route is registered by the host
 * half of this plugin at `/api/produced.file`; the path is workspace-relative.
 * @param path - the produced file's workspace-relative path.
 */
export function fileUrl(path: string): string {
  return `/api/produced.file?path=${encodeURIComponent(path)}`
}

/** Accessible label for one preview. */
export function previewLabel(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}
