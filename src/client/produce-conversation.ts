/**
 * Turn-scoped produced-file facts for the preview plugin. This mirrors the
 * stock `deliverables` definition but under its own key (`produce-preview`),
 * so the preview surface works even when the stock ui-deliverables plugin is
 * composed out of the tree. The vocabulary comes from successful first-party
 * mutation calls (`write`, `edit`, and mutating `str_replace_editor`).
 */

import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'

interface ProducedPath {
  readonly seq: number
  readonly path: string
}

/** Immutable produced-file facts published against one Turn. */
export interface ProducePreviewTurnData {
  readonly produced: readonly ProducedPath[]
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationTurnDataMap {
    /** Successful mutation paths accumulated in this Turn. */
    'produce-preview': ProducePreviewTurnData
  }
}

interface ProducePreviewState extends ProducePreviewTurnData {
  readonly turn: number
  readonly calls: ReadonlyMap<string, string | null>
}

/** Extract the path from a supported first-party mutation call. */
function mutationPath(name: string, argsRaw: string): string | null {
  let args: unknown
  try {
    args = JSON.parse(argsRaw) as unknown
  } catch {
    return null
  }
  if (!isRecord(args)) return null
  switch (name) {
    case 'write':
      return typeof args.content === 'string' ? pathValue(args.file_path) : null
    case 'edit':
      return validEditArgs(args) ? pathValue(args.file_path) : null
    case 'str_replace_editor':
      return editorMutationPath(args)
    default:
      return null
  }
}

function validEditArgs(args: Readonly<Record<string, unknown>>): boolean {
  return typeof args.old_string === 'string'
    && args.old_string.length > 0
    && typeof args.new_string === 'string'
    && args.old_string !== args.new_string
    && (args.replace_all === undefined || typeof args.replace_all === 'boolean')
}

function editorMutationPath(args: Readonly<Record<string, unknown>>): string | null {
  const path = pathValue(args.path)
  if (path === null) return null
  switch (args.command) {
    case 'create':
      return typeof args.file_text === 'string' ? path : null
    case 'str_replace':
      return typeof args.old_str === 'string'
        && args.old_str.length > 0
        && (args.new_str === undefined || typeof args.new_str === 'string')
        ? path
        : null
    case 'insert':
      return typeof args.insert_line === 'number'
        && Number.isInteger(args.insert_line)
        && args.insert_line >= 0
        && typeof args.new_str === 'string'
        ? path
        : null
    default:
      return null
  }
}

function pathValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Message-producing surface types; mirrored from dsh-session/surface. */
const SURFACE_TYPES = new Set(['user/message', 'assistant/message', 'tool/result'])

/** Mirror of dsh-session's isAppendSurfaceEvent, kept dependency-free for the browser bundle. */
function isAppendSurfaceEvent(event: { type: string } & Record<string, unknown>): boolean {
  return SURFACE_TYPES.has(event.type) && event.surfaceOp === 'append'
}

/** Produced paths up to a closing seq, in first-seen order, deduped. */
export function producedForClosing(
  data: Readonly<ProducePreviewTurnData> | undefined,
  seq = Number.POSITIVE_INFINITY,
): readonly string[] {
  if (data === undefined) return []
  const paths: string[] = []
  const seen = new Set<string>()
  for (const produced of data.produced) {
    if (produced.seq > seq || seen.has(produced.path)) continue
    seen.add(produced.path)
    paths.push(produced.path)
  }
  return paths
}

/** Turn-local successful mutation accumulator; publishes no view Node. */
export const producePreviewDefinition: ConversationNodeDefinition<ProducePreviewState> = {
  kind: 'produce-preview',
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call') return { id: String(event.data.turn), role: 'update' }
    if (event.type === 'tool/result' && isAppendSurfaceEvent(event)) {
      return { id: String(event.data.turn), role: 'update' }
    }
    return null
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('produce-preview start requires turn/start')
    return { turn: match.event.data.turn, calls: new Map(), produced: [] }
  },
  update: (context, match) => {
    if (match.event.type === 'tool/call') {
      const calls = new Map(context.state.calls)
      calls.set(
        String(match.event.data.callId),
        mutationPath(match.event.data.name, match.event.data.arguments),
      )
      return { ...context.state, calls }
    }
    if (match.event.type !== 'tool/result') return context.state
    const result = match.event.data.message.content[0]
    if (result.isError === true) return context.state
    const callId = String(match.event.data.message.source.callId)
    const path = context.state.calls.get(callId)
    return path === null || path === undefined
      ? context.state
      : { ...context.state, produced: [...context.state.produced, { seq: match.event.seq, path }] }
  },
  buildLocationData: (context, scope) => scope !== 'turn' || context.state === undefined
    ? null
    : {
      kind: 'turn',
      turn: context.state.turn,
      key: 'produce-preview',
      value: { produced: context.state.produced },
    },
}
