import type { AgentConfig, PromptGlobalSettings } from '../types'
import { formatFAQBlock } from '../shared-faq'

export function buildInfoPrompt(params: {
  config: AgentConfig
  locale: string
  nowLabel: string
  todayISO: string
  faqRows: Array<{ question: string; answer: string }>
  profileContext?: string
  globalPromptSettings?: PromptGlobalSettings
}): string {
  const { config, locale, nowLabel, todayISO, faqRows, profileContext, globalPromptSettings } = params

  const faqBlock = formatFAQBlock(faqRows)

  let prompt = config.prompt
  prompt = prompt.replace(/\{\{LOCALE\}\}/g, getLocaleLabel(locale))
  prompt = prompt.replace(/\{\{NOW_ISRAEL\}\}/g, nowLabel)
  prompt = prompt.replace(/\{\{TODAY_ISO\}\}/g, todayISO)

  prompt = prompt.replace(/\{\{FAQ_BLOCK\}\}/g, faqBlock)

  prompt = prompt.replace(/\{\{PROFILE_CONTEXT\}\}/g, profileContext || 'No specific context.')
  prompt = prompt.replace(/\{\{CUSTOM_PROMPT\}\}/g, globalPromptSettings?.custom_prompt || '')

  return prompt.trim()
}

function getLocaleLabel(locale: string): string {
  if (locale === 'he') return 'Hebrew (עברית)'
  if (locale === 'fr') return 'French (Français)'
  return 'English'
}
