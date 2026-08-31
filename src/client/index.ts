/**
 * Produce-preview client plugin: registers a turn-scoped produced-file
 * conversation node and a `conversation.chat.turnTail` slot entry that renders
 * inline images / videos / tables for the files a turn produced. It is fully
 * self-contained — it does not depend on the stock ui-deliverables plugin.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import { ProducedPreview } from './ProducedPreview.tsx'
import { isPreviewable } from './media.ts'
import { producePreviewDefinition, producedForClosing } from './produce-conversation.ts'
import { en, NS, zh } from './locales.ts'

/** Required services: the slot registry, the locale seat, and the conversation registry. */
export const inject = ['slots', 'locale', 'uiConversation']

/**
 * Claim the turn-tail chain only when this turn produced previewable files.
 * @param owner - turn-tail owner currency for the closing assistant.
 * @returns previewable produced paths, or null to decline before mount.
 */
export function selectPreviewableFiles(owner: TurnTailOwnerProps): readonly string[] | null {
  const paths = producedForClosing(owner.turn.data.get('produce-preview'), owner.seq)
  const previewable = paths.filter(isPreviewable)
  return previewable.length === 0 ? null : previewable
}

/**
 * Client plugin body: register the conversation node and the turn-tail entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.uiConversation.events.register(producePreviewDefinition)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'produce-preview: dictionaries')
  ctx.slots.inject(
    'conversation.chat.turnTail',
    () => ctx.slots.register({
      name: 'conversation.chat.turnTail',
      select: selectPreviewableFiles,
      locale: NS,
      inject: () => ({}),
    }, ProducedPreview),
  )
}
