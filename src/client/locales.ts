/** Produce-preview copy namespace and strings. */

export const NS = 'producePreview'

export type ProducePreviewKey = 'label' | 'open' | 'loading'

export const zh: Record<ProducePreviewKey, string> = {
  label: '预览',
  open: '打开 {name}',
  loading: '加载中…',
}

export const en: Record<ProducePreviewKey, string> = {
  label: 'Preview',
  open: 'Open {name}',
  loading: 'Loading…',
}
