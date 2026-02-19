import type { AgentConfig } from '../types'

export function buildInfoPrompt(params: {
  config: AgentConfig
  locale: string
  nowLabel: string
  todayISO: string
  faqRows: Array<{ question: string; answer: string }>
  profileContext?: string
}): string {
  const { config, locale, nowLabel, todayISO, faqRows, profileContext } = params

  const faqBlock = faqRows
    .map(row => `Q: ${row.question}\nA: ${row.answer}`)
    .join('\n\n')

  let prompt = config.prompt
  prompt = prompt.replace(/\{\{LOCALE\}\}/g, getLocaleLabel(locale))
  prompt = prompt.replace(/\{\{NOW_ISRAEL\}\}/g, nowLabel)
  prompt = prompt.replace(/\{\{TODAY_ISO\}\}/g, todayISO)

  // If the prompt has {{FAQ_BLOCK}} placeholder, replace it inline.
  // If not (e.g. DB-overridden prompt missing the placeholder), append FAQ at the end
  // so the FAQ is never silently dropped.
  if (prompt.includes('{{FAQ_BLOCK}}')) {
    prompt = prompt.replace(/\{\{FAQ_BLOCK\}\}/g, faqBlock || 'No FAQ available.')
  } else if (faqBlock) {
    prompt += `\n\nFAQ (use this to answer questions accurately):\n${faqBlock}`
  }

  prompt = prompt.replace(/\{\{PROFILE_CONTEXT\}\}/g, profileContext || 'No specific context.')
  prompt = prompt.replace(/\{\{CUSTOM_PROMPT\}\}/g, '')

  return prompt.trim()
}

function getLocaleLabel(locale: string): string {
  if (locale === 'he') return 'Hebrew (עברית)'
  if (locale === 'fr') return 'French (Français)'
  return 'English'
}
