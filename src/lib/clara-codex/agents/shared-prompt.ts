import type { AgentConfig, AgentContext } from './types'

export function buildAgentPrompt(params: {
  config: AgentConfig
  context: AgentContext
  faqBlock?: string
  extraReplacements?: Record<string, string>
}): string {
  const { config, context, faqBlock, extraReplacements } = params

  let prompt = config.prompt
  prompt = prompt.replace(/\{\{LOCALE\}\}/g, getLocaleLabel(context.locale))
  prompt = prompt.replace(/\{\{NOW_ISRAEL\}\}/g, context.nowLabel)
  prompt = prompt.replace(/\{\{TODAY_ISO\}\}/g, context.nowISO)
  prompt = prompt.replace(/\{\{CONTACT_NAME\}\}/g, context.contactName || 'Unknown')
  prompt = prompt.replace(/\{\{SENDER_PHONE\}\}/g, context.senderPhone || 'Unknown')
  prompt = prompt.replace(/\{\{BRANCH_ID\}\}/g, context.branchId || 'Unknown')
  prompt = prompt.replace(/\{\{HUMAN_AVAILABLE\}\}/g, context.humanAvailable ? 'yes' : 'no')
  prompt = prompt.replace(/\{\{FAQ_BLOCK\}\}/g, faqBlock || '')

  prompt = prompt.replace(/\{\{CUSTOM_PROMPT\}\}/g, '')
  prompt = prompt.replace(/\{\{EMAIL_REQUIRED_FOR_LINK\}\}/g, 'yes')

  if (extraReplacements) {
    for (const [key, value] of Object.entries(extraReplacements)) {
      prompt = prompt.split(key).join(value)
    }
  }

  return prompt.trim()
}

function getLocaleLabel(locale: string): string {
  if (locale === 'he') return 'Hebrew (עברית)'
  if (locale === 'fr') return 'French (Français)'
  return 'English'
}
