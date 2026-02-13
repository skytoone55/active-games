export const CODEX_LOCALES = ['fr', 'en', 'he'] as const

export type CodexLocale = (typeof CODEX_LOCALES)[number]

export type CodexDayName =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'

export interface CodexLocalizedText {
  fr: string
  en: string
  he: string
}

export interface CodexDaySchedule {
  enabled: boolean
  start: string
  end: string
}

export interface ClaraCodexWhatsAppSettings {
  enabled: boolean
  model: string
  temperature: number
  max_tokens: number
  faq_enabled: boolean
  primary_prompt: string
  custom_prompt: string
  auto_resume_minutes: number
  auto_activate_delay_minutes: number
  active_branches: string[]
  schedule_enabled: boolean
  schedule: Record<CodexDayName, CodexDaySchedule>
  event_keywords: string[]
  enforce_email_for_link: boolean
  silent_human_call: boolean
  fallback_no_agent_message: CodexLocalizedText
  fallback_tech_error_message: CodexLocalizedText
  fallback_human_message: CodexLocalizedText
}

export interface ClaraCodexSettingsRecord {
  id: string
  is_active: boolean
  settings: ClaraCodexWhatsAppSettings
}

export const CODEX_AVAILABLE_MODELS = [
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'Google' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic' },
] as const

const defaultScheduleDay = (): CodexDaySchedule => ({
  enabled: true,
  start: '09:00',
  end: '22:00',
})

export function buildDefaultSchedule(): Record<CodexDayName, CodexDaySchedule> {
  return {
    sunday: defaultScheduleDay(),
    monday: defaultScheduleDay(),
    tuesday: defaultScheduleDay(),
    wednesday: defaultScheduleDay(),
    thursday: defaultScheduleDay(),
    friday: defaultScheduleDay(),
    saturday: defaultScheduleDay(),
  }
}

export const DEFAULT_CLARA_CODEX_SETTINGS: ClaraCodexWhatsAppSettings = {
  enabled: false,
  model: 'gemini-2.0-flash-lite',
  temperature: 0.2,
  max_tokens: 2048,
  faq_enabled: true,
  primary_prompt: '',
  custom_prompt: '',
  auto_resume_minutes: 5,
  auto_activate_delay_minutes: 0,
  active_branches: [],
  schedule_enabled: false,
  schedule: buildDefaultSchedule(),
  event_keywords: [
    'event',
    'birthday',
    'anniversaire',
    'אירוע',
    'יום הולדת',
    'חגיגה',
    'team building',
    'corporate',
    'party',
  ],
  enforce_email_for_link: true,
  silent_human_call: true,
  fallback_no_agent_message: {
    fr: 'Tous nos conseillers sont occupés pour le moment. Nous vous recontactons au plus vite. Je reste disponible si vous voulez avancer sur les informations.',
    en: 'All our advisors are currently busy. We will contact you as soon as possible. I can still help with information in the meantime.',
    he: 'כל הנציגים שלנו עסוקים כרגע. נחזור אליך בהקדם האפשרי. אני עדיין זמינה לעזור עם מידע בינתיים.',
  },
  fallback_tech_error_message: {
    fr: 'Je rencontre un souci technique. Un conseiller humain reprendra votre demande rapidement.',
    en: 'I am facing a technical issue right now. A human advisor will take over shortly.',
    he: 'יש לי תקלה טכנית כרגע. נציג אנושי יטפל בבקשה שלך בהקדם.',
  },
  fallback_human_message: {
    fr: 'Je transfère votre demande à un conseiller. Je peux continuer à avancer avec vous pendant ce temps.',
    en: 'I am transferring your request to an advisor. I can keep helping while they join.',
    he: 'אני מעבירה את הבקשה שלך לנציג. אפשר להמשיך להתקדם בזמן שהוא מצטרף.',
  },
}

function sanitizeLocalizedText(value: unknown, fallback: CodexLocalizedText): CodexLocalizedText {
  const input = (value || {}) as Partial<CodexLocalizedText>
  return {
    fr: typeof input.fr === 'string' ? input.fr : fallback.fr,
    en: typeof input.en === 'string' ? input.en : fallback.en,
    he: typeof input.he === 'string' ? input.he : fallback.he,
  }
}

function sanitizeDaySchedule(value: unknown, fallback: CodexDaySchedule): CodexDaySchedule {
  const input = (value || {}) as Partial<CodexDaySchedule>
  const start = typeof input.start === 'string' ? input.start : fallback.start
  const end = typeof input.end === 'string' ? input.end : fallback.end
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : fallback.enabled
  return { enabled, start, end }
}

export function normalizeClaraCodexSettings(raw: unknown): ClaraCodexWhatsAppSettings {
  const input = (raw || {}) as Partial<ClaraCodexWhatsAppSettings>
  const defaultSchedule = buildDefaultSchedule()
  const incomingSchedule = (input.schedule || {}) as Partial<Record<CodexDayName, CodexDaySchedule>>

  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_CLARA_CODEX_SETTINGS.enabled,
    model: typeof input.model === 'string' && input.model.trim() ? input.model : DEFAULT_CLARA_CODEX_SETTINGS.model,
    temperature: typeof input.temperature === 'number' ? input.temperature : DEFAULT_CLARA_CODEX_SETTINGS.temperature,
    max_tokens: typeof input.max_tokens === 'number' ? input.max_tokens : DEFAULT_CLARA_CODEX_SETTINGS.max_tokens,
    faq_enabled: typeof input.faq_enabled === 'boolean' ? input.faq_enabled : DEFAULT_CLARA_CODEX_SETTINGS.faq_enabled,
    primary_prompt: typeof input.primary_prompt === 'string'
      ? input.primary_prompt
      : DEFAULT_CLARA_CODEX_SETTINGS.primary_prompt,
    custom_prompt: typeof input.custom_prompt === 'string' ? input.custom_prompt : DEFAULT_CLARA_CODEX_SETTINGS.custom_prompt,
    auto_resume_minutes: typeof input.auto_resume_minutes === 'number'
      ? input.auto_resume_minutes
      : DEFAULT_CLARA_CODEX_SETTINGS.auto_resume_minutes,
    auto_activate_delay_minutes: typeof input.auto_activate_delay_minutes === 'number'
      ? input.auto_activate_delay_minutes
      : DEFAULT_CLARA_CODEX_SETTINGS.auto_activate_delay_minutes,
    active_branches: Array.isArray(input.active_branches)
      ? input.active_branches.filter((x): x is string => typeof x === 'string')
      : DEFAULT_CLARA_CODEX_SETTINGS.active_branches,
    schedule_enabled: typeof input.schedule_enabled === 'boolean'
      ? input.schedule_enabled
      : DEFAULT_CLARA_CODEX_SETTINGS.schedule_enabled,
    schedule: {
      sunday: sanitizeDaySchedule(incomingSchedule.sunday, defaultSchedule.sunday),
      monday: sanitizeDaySchedule(incomingSchedule.monday, defaultSchedule.monday),
      tuesday: sanitizeDaySchedule(incomingSchedule.tuesday, defaultSchedule.tuesday),
      wednesday: sanitizeDaySchedule(incomingSchedule.wednesday, defaultSchedule.wednesday),
      thursday: sanitizeDaySchedule(incomingSchedule.thursday, defaultSchedule.thursday),
      friday: sanitizeDaySchedule(incomingSchedule.friday, defaultSchedule.friday),
      saturday: sanitizeDaySchedule(incomingSchedule.saturday, defaultSchedule.saturday),
    },
    event_keywords: Array.isArray(input.event_keywords)
      ? input.event_keywords.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : DEFAULT_CLARA_CODEX_SETTINGS.event_keywords,
    enforce_email_for_link: typeof input.enforce_email_for_link === 'boolean'
      ? input.enforce_email_for_link
      : DEFAULT_CLARA_CODEX_SETTINGS.enforce_email_for_link,
    silent_human_call: typeof input.silent_human_call === 'boolean'
      ? input.silent_human_call
      : DEFAULT_CLARA_CODEX_SETTINGS.silent_human_call,
    fallback_no_agent_message: sanitizeLocalizedText(
      input.fallback_no_agent_message,
      DEFAULT_CLARA_CODEX_SETTINGS.fallback_no_agent_message
    ),
    fallback_tech_error_message: sanitizeLocalizedText(
      input.fallback_tech_error_message,
      DEFAULT_CLARA_CODEX_SETTINGS.fallback_tech_error_message
    ),
    fallback_human_message: sanitizeLocalizedText(
      input.fallback_human_message,
      DEFAULT_CLARA_CODEX_SETTINGS.fallback_human_message
    ),
  }
}

export function resolveLocalizedCodexText(
  text: CodexLocalizedText,
  locale: string | null | undefined
): string {
  const normalized = (locale || '').toLowerCase()
  if (normalized.startsWith('fr')) return text.fr
  if (normalized.startsWith('he')) return text.he
  return text.en
}

export function getModelProvider(model: string): 'gemini' | 'openai' | 'anthropic' {
  if (model.startsWith('gpt')) return 'openai'
  if (model.startsWith('claude')) return 'anthropic'
  return 'gemini'
}
