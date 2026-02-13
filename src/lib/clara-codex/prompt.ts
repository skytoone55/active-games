import type { ClaraCodexWhatsAppSettings } from './config'

interface FAQRow {
  question: Record<string, string> | string | null
  answer: Record<string, string> | string | null
}

function pickBestLocalizedText(value: FAQRow['question']): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.he || value.fr || value.en || ''
}

export function buildClaraCodexPrompt(params: {
  settings: ClaraCodexWhatsAppSettings
  faqRows: FAQRow[]
  todayISO: string
  nowLabel: string
  humanAvailable: boolean
}) {
  const { settings, faqRows, todayISO, nowLabel, humanAvailable } = params

  const basePrompt = settings.primary_prompt?.trim() || ''
  if (!basePrompt) {
    return ''
  }

  const faqBlock = faqRows
    .map((row) => {
      const q = pickBestLocalizedText(row.question)
      const a = pickBestLocalizedText(row.answer)
      if (!q || !a) return ''
      return `Q: ${q}\nA: ${a}`
    })
    .filter(Boolean)
    .join('\n\n')

  const replacements: Record<string, string> = {
    '{{NOW_ISRAEL}}': nowLabel,
    '{{TODAY_ISO}}': todayISO,
    '{{HUMAN_AVAILABLE}}': humanAvailable ? 'yes' : 'no',
    '{{EMAIL_REQUIRED_FOR_LINK}}': settings.enforce_email_for_link ? 'yes' : 'no',
    '{{SILENT_HUMAN_ESCALATION}}': settings.silent_human_call ? 'yes' : 'no',
    '{{EVENT_KEYWORDS}}': settings.event_keywords.join(', '),
    '{{FAQ_BLOCK}}': faqBlock || '',
  }

  let prompt = basePrompt
  for (const [token, value] of Object.entries(replacements)) {
    prompt = prompt.split(token).join(value)
  }

  if (settings.custom_prompt?.trim()) {
    prompt = `${prompt}\n\n${settings.custom_prompt.trim()}`
  }

  return prompt.trim()
}
