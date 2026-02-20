'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Save,
  Bot,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MessageSquare,
  Wrench,
  ShieldCheck,
  Calendar,
  HeadphonesIcon,
  ArrowUpRight,
  RotateCcw,
  Settings2,
} from 'lucide-react'
import type { AgentConfig, AgentId } from '@/lib/clara-codex/agents/types'
import { AGENT_LABELS, AGENT_DESCRIPTIONS } from '@/lib/clara-codex/agents/types'
import { DEFAULT_AGENT_CONFIGS } from '@/lib/clara-codex/agents/defaults'

interface AgentsTabProps {
  isDark: boolean
}

interface PromptSettings {
  custom_prompt: string
  enforce_email_for_link: boolean
}

interface AgentsApiResponse {
  agents: Record<AgentId, AgentConfig>
  models: Array<{ id: string; name: string; provider: string }>
  promptSettings?: PromptSettings
}

type TabId = 'agents' | 'tools'

const AGENT_ORDER: AgentId[] = ['router', 'info', 'resa_game', 'resa_event', 'after_sale', 'escalation']

// Template variables documentation
const TEMPLATE_VARIABLES = [
  { name: '{{LOCALE}}', desc: 'Langue detectee (Hebrew / English / French)', auto: true },
  { name: '{{NOW_ISRAEL}}', desc: 'Date et heure actuelle en Israel', auto: true },
  { name: '{{TODAY_ISO}}', desc: 'Date du jour (YYYY-MM-DD)', auto: true },
  { name: '{{CONTACT_NAME}}', desc: 'Nom du contact WhatsApp', auto: true },
  { name: '{{SENDER_PHONE}}', desc: 'Numero de telephone du client', auto: true },
  { name: '{{BRANCH_ID}}', desc: 'ID de la succursale', auto: true },
  { name: '{{HUMAN_AVAILABLE}}', desc: 'Agent humain disponible (yes/no)', auto: true },
  { name: '{{FAQ_BLOCK}}', desc: 'FAQ pertinentes (recherche hybride vector + keyword)', auto: true },
  { name: '{{PROFILE_CONTEXT}}', desc: 'Contexte game/event du profil conversation (info agent)', auto: true },
  { name: '{{CUSTOM_PROMPT}}', desc: 'Instructions supplementaires injectees dans tous les agents', auto: false },
  { name: '{{EMAIL_REQUIRED_FOR_LINK}}', desc: 'Email obligatoire avant lien de reservation (yes/no)', auto: false },
]

// Tools catalog for the tools tab
const TOOLS_CATALOG = [
  {
    id: 'checkGameAvailability',
    label: 'Check Game Availability',
    agent: 'resa_game' as AgentId,
    purpose: 'Verifie la disponibilite des creneaux pour les jeux ACTIVE et LASER.',
    trigger: 'Appele quand le client a fourni : type de jeu, nombre de joueurs, date et heure souhaitees.',
    params: ['branchId', 'date', 'time', 'gameArea (ACTIVE|LASER|MIX)', 'players', 'numberOfGames', 'duration'],
  },
  {
    id: 'checkEventAvailability',
    label: 'Check Event Availability',
    agent: 'resa_event' as AgentId,
    purpose: 'Verifie la disponibilite pour un evenement : salle privee + sessions de jeux.',
    trigger: 'Appele quand le client a fourni : type event, nombre de participants, date et heure.',
    params: ['branchId', 'date', 'time', 'eventType (event_active|event_laser|event_mix)', 'participants'],
  },
  {
    id: 'generateBookingLink',
    label: 'Generate Booking Link',
    agent: 'resa_game / resa_event' as any,
    purpose: 'Genere un lien de reservation pre-rempli une fois toutes les infos confirmees.',
    trigger: 'Appele uniquement apres confirmation de disponibilite et collecte de l\'email.',
    params: ['branchId', 'date', 'time', 'gameArea', 'players', 'email', 'contactName', 'phone'],
  },
  {
    id: 'searchOrderByPhone',
    label: 'Search Order By Phone',
    agent: 'after_sale' as AgentId,
    purpose: 'Recherche les commandes existantes par numero de telephone.',
    trigger: 'Appele quand un client post-reservation demande des infos sur sa commande.',
    params: ['phone'],
  },
  {
    id: 'escalateToHuman',
    label: 'Escalate To Human',
    agent: 'all agents' as any,
    purpose: 'Marque la conversation pour transfert humain. Log le contexte.',
    trigger: 'Appele pour plaintes, doutes, echecs d\'outils, ou demande explicite d\'un humain.',
    params: ['conversationId', 'reason'],
  },
]

function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ')
}

function agentIcon(agentId: AgentId) {
  switch (agentId) {
    case 'router': return ArrowUpRight
    case 'info': return MessageSquare
    case 'resa_game': return Sparkles
    case 'resa_event': return Calendar
    case 'after_sale': return HeadphonesIcon
    case 'escalation': return ShieldCheck
    default: return Bot
  }
}

export function AgentsTab({ isDark }: AgentsTabProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [agents, setAgents] = useState<Record<AgentId, AgentConfig>>({} as any)
  const [models, setModels] = useState<Array<{ id: string; name: string; provider: string }>>([])
  const [promptSettings, setPromptSettings] = useState<PromptSettings>({
    custom_prompt: '',
    enforce_email_for_link: true,
  })
  const [openAgents, setOpenAgents] = useState<Record<AgentId, boolean>>({
    router: false,
    info: true,
    resa_game: false,
    resa_event: false,
    after_sale: false,
    escalation: false,
  })
  const [promptProcessingOpen, setPromptProcessingOpen] = useState(false)

  const [activeTab, setActiveTab] = useState<TabId>('agents')

  const groupedModels = useMemo(() => {
    return models.reduce<Record<string, Array<{ id: string; name: string }>>>((acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = []
      acc[model.provider].push({ id: model.id, name: model.name })
      return acc
    }, {})
  }, [models])

  useEffect(() => {
    void loadAgents()
  }, [])

  async function loadAgents() {
    try {
      setLoading(true)
      setLoadError(null)
      const response = await fetch('/api/admin/clara-codex/agents')
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to load agent configs')
      }
      const payload = json.data as AgentsApiResponse
      setAgents(payload.agents)
      if (Array.isArray(payload.models) && payload.models.length > 0) {
        setModels(payload.models)
      }
      if (payload.promptSettings) {
        setPromptSettings(payload.promptSettings)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function saveAll() {
    try {
      setSaving(true)
      setSaveStatus(null)
      const response = await fetch('/api/admin/clara-codex/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents, promptSettings }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to save')
      }
      setAgents(json.data.agents)
      setSaveStatus({ type: 'success', message: 'All agent configurations saved.' })
    } catch (e) {
      setSaveStatus({ type: 'error', message: e instanceof Error ? e.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  function updateAgent(agentId: AgentId, updates: Partial<AgentConfig>) {
    setAgents(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], ...updates },
    }))
    setSaveStatus(null)
  }

  function toggleAgent(agentId: AgentId) {
    setOpenAgents(prev => ({ ...prev, [agentId]: !prev[agentId] }))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className={classNames('w-7 h-7 animate-spin', isDark ? 'text-orange-400' : 'text-orange-600')} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1">
        {[
          { id: 'agents' as TabId, label: 'Agents', icon: Bot },
          { id: 'tools' as TabId, label: 'Tools', icon: Wrench },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? isDark ? 'bg-orange-600/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                  : isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {loadError && (
        <div className={classNames(
          'rounded-lg border px-4 py-3 text-sm flex items-center gap-2',
          isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
        )}>
          <AlertCircle className="w-4 h-4" />
          <span>{loadError}</span>
          <button onClick={() => loadAgents()} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      {/* --- AGENTS TAB --- */}
      {activeTab === 'agents' && (
        <>
          {/* ── Prompt Processing Section ── */}
          <div className={classNames(
            'rounded-xl border',
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}>
            <button
              onClick={() => setPromptProcessingOpen(!promptProcessingOpen)}
              className={classNames(
                'w-full px-5 py-4 flex items-center justify-between text-left',
                isDark ? 'hover:bg-gray-700/40' : 'hover:bg-gray-50'
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Settings2 className={classNames('w-4 h-4 flex-shrink-0', isDark ? 'text-blue-400' : 'text-blue-600')} />
                <div className="flex-1 min-w-0">
                  <h4 className={classNames('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    Prompt Processing
                  </h4>
                  <p className={classNames('text-xs truncate', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Variables template et instructions globales injectees dans tous les agents
                  </p>
                </div>
              </div>
              {promptProcessingOpen ? (
                <ChevronUp className={classNames('w-4 h-4 ml-2', isDark ? 'text-gray-400' : 'text-gray-500')} />
              ) : (
                <ChevronDown className={classNames('w-4 h-4 ml-2', isDark ? 'text-gray-400' : 'text-gray-500')} />
              )}
            </button>

            {promptProcessingOpen && (
              <div className="px-5 pb-5 space-y-4">
                {/* Template variables reference */}
                <div className={classNames(
                  'rounded-lg border p-4 space-y-2',
                  isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}>
                  <p className={classNames('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                    Variables template
                  </p>
                  <p className={classNames('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Ces variables sont remplacees automatiquement dans le prompt de chaque agent avant envoi au LLM.
                  </p>
                  <div className="space-y-1 mt-2">
                    {TEMPLATE_VARIABLES.map(v => (
                      <div key={v.name} className="flex items-start gap-2 text-xs">
                        <code className={classNames(
                          'px-1.5 py-0.5 rounded flex-shrink-0 font-mono',
                          v.auto
                            ? isDark ? 'bg-gray-700 text-green-400' : 'bg-green-50 text-green-700'
                            : isDark ? 'bg-gray-700 text-orange-400' : 'bg-orange-50 text-orange-700'
                        )}>
                          {v.name}
                        </code>
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                          {v.desc}
                          {!v.auto && (
                            <span className={classNames(
                              'ml-1 font-medium',
                              isDark ? 'text-orange-400' : 'text-orange-600'
                            )}>
                              — editable ci-dessous
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Prompt */}
                <label className="space-y-1 block">
                  <span className={classNames('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
                    Custom Prompt <code className="text-xs font-normal">{'{{CUSTOM_PROMPT}}'}</code>
                  </span>
                  <p className={classNames('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Instructions supplementaires injectees dans tous les agents (info, resa_game, resa_event, after_sale).
                    Laisser vide si non necessaire.
                  </p>
                  <textarea
                    value={promptSettings.custom_prompt}
                    onChange={(e) => { setPromptSettings(prev => ({ ...prev, custom_prompt: e.target.value })); setSaveStatus(null) }}
                    rows={4}
                    placeholder="Ex: Always mention our current promotion: 10% off for groups of 20+..."
                    className={classNames(
                      'w-full rounded-lg border px-3 py-2 text-sm font-mono',
                      isDark ? 'bg-gray-900 border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                    )}
                  />
                </label>

                {/* Email Required */}
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promptSettings.enforce_email_for_link}
                    onChange={(e) => { setPromptSettings(prev => ({ ...prev, enforce_email_for_link: e.target.checked })); setSaveStatus(null) }}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className={classNames('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                      Email obligatoire pour le lien de reservation
                    </span>
                    <p className={classNames('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      <code>{'{{EMAIL_REQUIRED_FOR_LINK}}'}</code> = {promptSettings.enforce_email_for_link ? '"yes"' : '"no"'}
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* ── Agent Cards ── */}
          {AGENT_ORDER.map(agentId => {
            const config = agents[agentId]
            if (!config) return null
            const Icon = agentIcon(agentId)
            const open = openAgents[agentId]
            const isEscalation = agentId === 'escalation'

            return (
              <div
                key={agentId}
                className={classNames(
                  'rounded-xl border',
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                {/* Accordion header */}
                <button
                  onClick={() => toggleAgent(agentId)}
                  className={classNames(
                    'w-full px-5 py-4 flex items-center justify-between text-left',
                    isDark ? 'hover:bg-gray-700/40' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className={classNames('w-4 h-4 flex-shrink-0', isDark ? 'text-orange-400' : 'text-orange-600')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={classNames('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                          {AGENT_LABELS[agentId]}
                        </h4>
                        <span className={classNames(
                          'text-xs px-2 py-0.5 rounded-full',
                          config.enabled
                            ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                            : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                        )}>
                          {config.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className={classNames('text-xs truncate', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        {AGENT_DESCRIPTIONS[agentId]}
                      </p>
                    </div>
                    <span className={classNames('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      {config.model}
                    </span>
                  </div>
                  {open ? (
                    <ChevronUp className={classNames('w-4 h-4 ml-2', isDark ? 'text-gray-400' : 'text-gray-500')} />
                  ) : (
                    <ChevronDown className={classNames('w-4 h-4 ml-2', isDark ? 'text-gray-400' : 'text-gray-500')} />
                  )}
                </button>

                {/* Accordion body */}
                {open && (
                  <div className="px-5 pb-5 space-y-4">
                    {/* Enable toggle */}
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => updateAgent(agentId, { enabled: e.target.checked })}
                        className="w-5 h-5"
                      />
                      <span className={classNames('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                        Enabled
                      </span>
                    </label>

                    {/* Model / Temperature / Max Tokens */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <label className="space-y-1">
                        <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Model</span>
                        <select
                          value={config.model}
                          onChange={(e) => updateAgent(agentId, { model: e.target.value })}
                          className={classNames(
                            'w-full rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        >
                          {Object.entries(groupedModels).map(([provider, providerModels]) => (
                            <optgroup key={provider} label={provider}>
                              {providerModels.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Temperature</span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={config.temperature}
                          onChange={(e) => updateAgent(agentId, { temperature: Number(e.target.value) })}
                          className={classNames(
                            'w-full rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Max Tokens</span>
                        <input
                          type="number"
                          min={128}
                          max={8192}
                          step={128}
                          value={config.max_tokens}
                          onChange={(e) => updateAgent(agentId, { max_tokens: Number(e.target.value) })}
                          className={classNames(
                            'w-full rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </label>
                    </div>

                    {/* Prompt (not for escalation) */}
                    {!isEscalation && (
                      <label className="space-y-1 block">
                        <div className="flex items-center justify-between">
                          <span className={classNames('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
                            System Prompt
                          </span>
                          <button
                            onClick={() => {
                              const defaultConfig = DEFAULT_AGENT_CONFIGS[agentId]
                              if (defaultConfig?.prompt !== undefined) updateAgent(agentId, { prompt: defaultConfig.prompt })
                            }}
                            className={classNames(
                              'flex items-center gap-1 text-xs px-2 py-1 rounded',
                              isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            )}
                            title="Reset to default prompt"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset
                          </button>
                        </div>
                        <textarea
                          value={config.prompt}
                          onChange={(e) => updateAgent(agentId, { prompt: e.target.value })}
                          rows={agentId === 'router' ? 14 : 18}
                          className={classNames(
                            'w-full rounded-lg border px-3 py-2 text-sm font-mono',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                        {agentId !== 'router' && (
                          <p className={classNames('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            Utilise les variables template definies dans la section Prompt Processing ci-dessus.
                          </p>
                        )}
                      </label>
                    )}

                    {isEscalation && (
                      <div className={classNames(
                        'rounded-lg border p-4 text-sm',
                        isDark ? 'bg-gray-900/40 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
                      )}>
                        <p className="font-medium mb-1">Direct escalation — no LLM call</p>
                        <p className="text-xs">
                          This agent directly flags the conversation for human takeover.
                          No system prompt or LLM call is needed. It sets <code>needs_human = true</code> and
                          returns a localized handoff message.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Save all */}
          <div className="flex items-center justify-between gap-4">
            {saveStatus && (
              <div className={classNames(
                'rounded-lg border px-4 py-2 text-sm flex items-center gap-2 flex-1',
                saveStatus.type === 'error'
                  ? isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
                  : isDark ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-700'
              )}>
                <AlertCircle className="w-4 h-4" />
                <span>{saveStatus.message}</span>
              </div>
            )}
            <button
              onClick={saveAll}
              disabled={saving}
              className={classNames(
                'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white',
                isDark ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-600 hover:bg-orange-700',
                saving && 'opacity-60 cursor-not-allowed'
              )}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All Agents
            </button>
          </div>
        </>
      )}

      {/* --- TOOLS TAB --- */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className={classNames(
            'rounded-xl border p-4',
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}>
            <p className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
              List of all backend tools available to agents. These tools are hardcoded and
              automatically attached to the relevant agent. They cannot be enabled/disabled
              individually — they are always available when the agent is active.
            </p>
          </div>

          {TOOLS_CATALOG.map(tool => (
            <div
              key={tool.id}
              className={classNames(
                'rounded-xl border p-5',
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Wrench className={classNames('w-4 h-4', isDark ? 'text-orange-400' : 'text-orange-600')} />
                  <h4 className={classNames('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                    {tool.label}
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <code className={classNames(
                    'text-xs px-2 py-0.5 rounded',
                    isDark ? 'bg-gray-700 text-orange-300' : 'bg-orange-50 text-orange-700'
                  )}>
                    {tool.id}
                  </code>
                  <span className={classNames(
                    'text-xs px-2 py-0.5 rounded',
                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  )}>
                    {typeof tool.agent === 'string' ? AGENT_LABELS[tool.agent as AgentId] || tool.agent : tool.agent}
                  </span>
                </div>
              </div>

              <p className={classNames('text-sm mt-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                {tool.purpose}
              </p>
              <p className={classNames('text-xs mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                <span className="font-medium">Trigger:</span> {tool.trigger}
              </p>

              <div className="flex flex-wrap gap-1 mt-2">
                {tool.params.map(param => (
                  <span
                    key={param}
                    className={classNames(
                      'text-xs px-2 py-0.5 rounded-full',
                      isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {param}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
