import type { AgentConfig } from '../types'

export function buildInfoPrompt(params: {
  config: AgentConfig
  locale: string
  nowLabel: string
  todayISO: string
  faqRows: Array<{ question: string; answer: string }>
}): string {
  const { config, locale, nowLabel, todayISO, faqRows } = params

  const faqBlock = faqRows
    .map(row => `Q: ${row.question}\nA: ${row.answer}`)
    .join('\n\n')

  let prompt = config.prompt
  prompt = prompt.replace(/\{\{LOCALE\}\}/g, getLocaleLabel(locale))
  prompt = prompt.replace(/\{\{NOW_ISRAEL\}\}/g, nowLabel)
  prompt = prompt.replace(/\{\{TODAY_ISO\}\}/g, todayISO)
  prompt = prompt.replace(/\{\{FAQ_BLOCK\}\}/g, faqBlock || 'No FAQ available.')
  prompt = prompt.replace(/\{\{CUSTOM_PROMPT\}\}/g, '')

  return prompt.trim()
}

function getLocaleLabel(locale: string): string {
  if (locale === 'he') return 'Hebrew (עברית)'
  if (locale === 'fr') return 'French (Français)'
  return 'English'
}
