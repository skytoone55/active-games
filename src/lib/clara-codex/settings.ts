import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  ClaraCodexSettingsRecord,
  ClaraCodexWhatsAppSettings,
  CODEX_AVAILABLE_MODELS,
  DEFAULT_CLARA_CODEX_SETTINGS,
  normalizeClaraCodexSettings,
  resolveLocalizedCodexText,
} from './config'

interface CodexSettingsRow {
  id: string
  is_active: boolean
  settings: unknown
}

export interface ClaraCodexSettingsPayload {
  is_active: boolean
  settings: ClaraCodexWhatsAppSettings
}

export const CODEX_SETTINGS_TABLE = 'clara_codex_whatsapp_settings'

function toRecord(row: CodexSettingsRow): ClaraCodexSettingsRecord {
  return {
    id: row.id,
    is_active: row.is_active,
    settings: normalizeClaraCodexSettings(row.settings),
  }
}

export async function getClaraCodexSettings(): Promise<ClaraCodexSettingsRecord> {
  const supabase = createServiceRoleClient() as any

  const { data, error } = await supabase
    .from(CODEX_SETTINGS_TABLE)
    .select('id, is_active, settings')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load Clara Codex settings: ${error.message}`)
  }

  if (data) {
    return toRecord(data as CodexSettingsRow)
  }

  const { data: created, error: createError } = await supabase
    .from(CODEX_SETTINGS_TABLE)
    .insert({
      is_active: false,
      settings: DEFAULT_CLARA_CODEX_SETTINGS,
      updated_at: new Date().toISOString(),
    })
    .select('id, is_active, settings')
    .single()

  if (createError || !created) {
    throw new Error(`Failed to initialize Clara Codex settings: ${createError?.message || 'unknown error'}`)
  }

  return toRecord(created as CodexSettingsRow)
}

export async function saveClaraCodexSettings(payload: ClaraCodexSettingsPayload): Promise<ClaraCodexSettingsRecord> {
  const supabase = createServiceRoleClient() as any
  const current = await getClaraCodexSettings()
  const normalized = normalizeClaraCodexSettings(payload.settings)

  const { data, error } = await supabase
    .from(CODEX_SETTINGS_TABLE)
    .update({
      is_active: payload.is_active,
      settings: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .select('id, is_active, settings')
    .single()

  if (error || !data) {
    throw new Error(`Failed to save Clara Codex settings: ${error?.message || 'unknown error'}`)
  }

  return toRecord(data as CodexSettingsRow)
}

export function getClaraCodexModels() {
  return CODEX_AVAILABLE_MODELS
}

export function getLocalizedCodexMessage(
  messages: ClaraCodexWhatsAppSettings['fallback_human_message'],
  locale: string | null | undefined
): string {
  return resolveLocalizedCodexText(messages, locale)
}
