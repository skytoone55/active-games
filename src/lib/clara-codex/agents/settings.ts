import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { AgentConfig, AgentId } from './types'
import { DEFAULT_AGENT_CONFIGS } from './defaults'
import { CODEX_SETTINGS_TABLE } from '../settings'

const AGENT_IDS: AgentId[] = ['router', 'info', 'resa_game', 'resa_event', 'after_sale', 'escalation']

export interface MultiAgentSettingsPayload {
  agents: Record<AgentId, AgentConfig>
}

function normalizeAgentConfig(agentId: AgentId, raw: Partial<AgentConfig> | undefined): AgentConfig {
  const defaults = DEFAULT_AGENT_CONFIGS[agentId]
  if (!raw) return { ...defaults }

  return {
    id: agentId,
    label: defaults.label,
    description: defaults.description,
    model: typeof raw.model === 'string' && raw.model.trim() ? raw.model : defaults.model,
    temperature: typeof raw.temperature === 'number' ? raw.temperature : defaults.temperature,
    max_tokens: typeof raw.max_tokens === 'number' ? raw.max_tokens : defaults.max_tokens,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : defaults.prompt,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled,
  }
}

export function normalizeAllAgentConfigs(raw: unknown): Record<AgentId, AgentConfig> {
  const input = (raw || {}) as Record<string, Partial<AgentConfig>>
  const result = {} as Record<AgentId, AgentConfig>

  for (const id of AGENT_IDS) {
    result[id] = normalizeAgentConfig(id, input[id])
  }

  return result
}

export async function getAgentConfigs(): Promise<Record<AgentId, AgentConfig>> {
  const supabase = createServiceRoleClient() as any

  const { data, error } = await supabase
    .from(CODEX_SETTINGS_TABLE)
    .select('settings')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[AGENT SETTINGS] Failed to load:', error)
    return normalizeAllAgentConfigs({})
  }

  const agents = (data?.settings as any)?.agents
  return normalizeAllAgentConfigs(agents)
}

export async function saveAgentConfigs(configs: Record<AgentId, AgentConfig>): Promise<Record<AgentId, AgentConfig>> {
  const supabase = createServiceRoleClient() as any

  // Load current record
  const { data: current } = await supabase
    .from(CODEX_SETTINGS_TABLE)
    .select('id, settings')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!current) {
    throw new Error('Clara Codex settings record not found')
  }

  const normalized = normalizeAllAgentConfigs(configs)
  const updatedSettings = { ...(current.settings || {}), agents: normalized }

  const { error } = await supabase
    .from(CODEX_SETTINGS_TABLE)
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)

  if (error) {
    throw new Error(`Failed to save agent configs: ${error.message}`)
  }

  return normalized
}

export async function saveAgentConfig(agentId: AgentId, config: Partial<AgentConfig>): Promise<AgentConfig> {
  const all = await getAgentConfigs()
  all[agentId] = normalizeAgentConfig(agentId, { ...all[agentId], ...config })
  await saveAgentConfigs(all)
  return all[agentId]
}
