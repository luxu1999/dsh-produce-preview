/**
 * Inline previews for files a turn produced: an <img> for images, a real
 * <video controls> for videos (Range-enabled streaming), and an HTML table for
 * CSV/TSV/HTML tables. Each preview is clickable to open the source file with
 * the platform opener. Only the byte route this plugin's host half registers
 * is used; nothing here needs shell access.
 */

import { useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from './locales.ts'
import { fileUrl, previewKind, previewLabel, type PreviewKind } from './media.ts'

/** Props handed to the turn-tail slot entry. */
export type ProducedPreviewProps = Pick<PropsLocale<typeof NS>, 't'> & {
  /** Previewable produced paths (already filtered by the selector). */
  readonly matched: readonly string[]
  /** The chat view's file opener (reveal in OS / open externally). */
  readonly openFile: (path: string) => void
}

function isImage(path: string): boolean {
  return previewKind(path) === 'image'
}
function isVideo(path: string): boolean {
  return previewKind(path) === 'video'
}

/** Per-path inline preview, switching on extension class. */
function PreviewItem({ path, openFile }: { path: string; openFile: (path: string) => void }) {
  const url = fileUrl(path)
  const label = previewLabel(path)
  const kind: PreviewKind = previewKind(path)

  if (kind === 'video') {
    return (
      <video
        controls
        preload="metadata"
        src={url}
        title={path}
        aria-label={label}
        style={{ display: 'block', margin: '6px 0', maxWidth: '100%', maxHeight: 340, borderRadius: 8 }}
        onClick={(event) => { event.stopPropagation(); event.preventDefault() }}
      />
    )
  }
  if (kind === 'image') {
    return (
      // click to open the source file
      <button
        type="button"
        title={path}
        aria-label={label}
        onClick={() => { openFile(path) }}
        style={{ display: 'block', margin: '6px 0', padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
      >
        <img
          src={url}
          alt={label}
          loading="lazy"
          style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, display: 'block' }}
        />
      </button>
    )
  }
  return <TablePreview path={path} label={label} openFile={openFile} />
}

/** CSV/TSV/HTML table preview loaded from the byte route. */
function TablePreview({ path, label, openFile }: {
  path: string
  label: string
  openFile: (path: string) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(fileUrl(path))
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.text()
      })
      .then((value) => { if (!cancelled) setText(value) })
      .catch(() => { if (!cancelled) setError('failed to load') })
    return () => { cancelled = true }
  }, [path])

  const body = error !== null ? <span>{error}</span> : text === null ? <span>加载中…</span> : (
    <CsvTable text={text} />
  )
  return (
    <div
      data-table-preview
      title={path}
      role="button"
      tabIndex={0}
      onClick={() => { openFile(path) }}
      onKeyDown={(event) => { if (event.key === 'Enter') openFile(path) }}
      style={{ margin: '6px 0', cursor: 'pointer', overflow: 'auto', maxHeight: 360, borderRadius: 8, border: '1px solid #d0d3d9' }}
    >
      {body}
    </div>
  )
}

/** Render a CSV/TSV-ish text as a simple HTML table. */
function CsvTable({ text }: { text: string }) {
  const delimiter = text.includes('\t') ? '\t' : ','
  const rows = text.split(/\r?\n/u).filter(line => line.trim() !== '').map(line => line.split(delimiter))
  if (rows.length === 0) return null
  const [head, ...body] = rows
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 13, background: 'transparent' }}>
      <thead>
        <tr>{head.map((cell, index) => <th key={index} style={thStyle}>{cell}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => <td key={cellIndex} style={tdStyle}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #d0d3d9', padding: '4px 8px', background: '#f2f3f5', textAlign: 'left',
}
const tdStyle: React.CSSProperties = {
  border: '1px solid #d0d3d9', padding: '4px 8px', whiteSpace: 'nowrap',
}

/** Render the whole inline preview lane under the closing assistant. */
export function ProducedPreview({ matched, openFile }: ProducedPreviewProps) {
  return (
    <div data-produce-preview data-path-count={matched.length}>
      {matched.map(path => <PreviewItem key={path} path={path} openFile={openFile} />)}
    </div>
  )
}
