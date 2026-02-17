'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Save,
  Bot,
  Clock,
  Building2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MessageSquare,
  Wrench,
} from 'lucide-react'
import { useAdmin } from '@/contexts/AdminContext'
import {
  buildDefaultSchedule,
  ClaraCodexModelOption,
  ClaraCodexWhatsAppSettings,
  CODEX_AVAILABLE_MODELS,
  CODEX_WHATSAPP_TOOL_CATALOG,
  normalizeClaraCodexSettings,
} from '@/lib/clara-codex/config'

interface ClaraCodexSectionProps {
  isDark: boolean
}

interface SettingsResponse {
  id: string
  is_active: boolean
  settings: ClaraCodexWhatsAppSettings
  models: ClaraCodexModelOption[]
}

type SectionId = 'overview' | 'model' | 'branches' | 'schedule' | 'prompt' | 'fallbacks' | 'tools'
type SavableSectionId = Exclude<SectionId, 'tools'>

interface SectionStatus {
  type: 'success' | 'error'
  message: string
}

const DAYS: Array<{ key: keyof ReturnType<typeof buildDefaultSchedule>; label: string }> = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
]

function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ')
}

function isValidTimeValue(input: string) {
  return /^\d{2}:\d{2}$/.test(input)
}

function sectionTitle(section: SectionId): string {
  if (section === 'overview') return 'Activation'
  if (section === 'model') return 'Model & Behavior'
  if (section === 'branches') return 'Active Branches'
  if (section === 'schedule') return 'Schedule'
  if (section === 'prompt') return 'Prompt & Keywords'
  if (section === 'fallbacks') return 'Fallback Messages'
  return 'Tools Exposed To Clara'
}

function sectionDescription(section: SectionId): string {
  if (section === 'overview') return 'Global on/off and core safety checks.'
  if (section === 'model') return 'LLM model, temperature, token budget and behavior flags.'
  if (section === 'branches') return 'Branches where Clara Codex is allowed to operate.'
  if (section === 'schedule') return 'Operating hours by day.'
  if (section === 'prompt') return 'Primary prompt, keywords and additional directive.'
  if (section === 'fallbacks') return 'Messages sent when human handoff or technical issues occur.'
  return 'Exact list of backend tools available to Clara Codex.'
}

function sectionIcon(section: SectionId) {
  if (section === 'model') return Sparkles
  if (section === 'branches') return Building2
  if (section === 'schedule') return Clock
  if (section === 'prompt') return Bot
  if (section === 'fallbacks') return MessageSquare
  if (section === 'tools') return Wrench
  return Bot
}

export function ClaraCodexSection({ isDark }: ClaraCodexSectionProps) {
  const { branches } = useAdmin()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingSection, setSavingSection] = useState<SavableSectionId | null>(null)
  const [sectionStatus, setSectionStatus] = useState<Partial<Record<SectionId, SectionStatus>>>({})

  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [settings, setSettings] = useState<ClaraCodexWhatsAppSettings>(normalizeClaraCodexSettings({}))
  const [models, setModels] = useState<ClaraCodexModelOption[]>([...CODEX_AVAILABLE_MODELS])
  const [originalPrimaryPrompt, setOriginalPrimaryPrompt] = useState('')
  const [unlockPrimaryPromptChecked, setUnlockPrimaryPromptChecked] = useState(false)

  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    overview: true,
    model: false,
    branches: false,
    schedule: false,
    prompt: true,
    fallbacks: false,
    tools: false,
  })

  useEffect(() => {
    void load()
  }, [])

  const groupedModels = useMemo(() => {
    return models.reduce<Record<string, Array<{ id: string; name: string }>>>((acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = []
      acc[model.provider].push({ id: model.id, name: model.name })
      return acc
    }, {})
  }, [models])

  const primaryPromptChanged = settings.primary_prompt.trim() !== originalPrimaryPrompt.trim()
  const primaryPromptUnlocked = unlockPrimaryPromptChecked

  const selectedBranchCount = settings.active_branches.length

  async function load() {
    try {
      setLoading(true)
      setLoadError(null)
      const response = await fetch('/api/admin/clara-codex/settings')
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to load Clara Codex settings')
      }

      const payload = json.data as SettingsResponse
      const normalizedSettings = normalizeClaraCodexSettings(payload.settings)
      setSettingsId(payload.id)
      setIsActive(payload.is_active)
      setSettings(normalizedSettings)
      setOriginalPrimaryPrompt(normalizedSettings.primary_prompt || '')
      setUnlockPrimaryPromptChecked(false)
      setSectionStatus({})
      if (Array.isArray(payload.models) && payload.models.length > 0) {
        setModels(payload.models)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  function clearSectionStatus(section: SectionId) {
    setSectionStatus(prev => {
      if (!prev[section]) return prev
      const next = { ...prev }
      delete next[section]
      return next
    })
  }

  function setSectionMessage(section: SectionId, type: 'success' | 'error', message: string) {
    setSectionStatus(prev => ({ ...prev, [section]: { type, message } }))
  }

  function validateOverviewSection(): string | null {
    if (isActive && !settings.primary_prompt.trim()) {
      return 'Primary prompt is required before activating Clara Codex.'
    }
    if (isActive && selectedBranchCount === 0) {
      return 'At least one active branch is required before activation.'
    }
    return null
  }

  function validateModelSection(): string | null {
    if (models.length === 0) {
      return 'No validated LLM key found. Add at least one provider key before choosing a model.'
    }
    if (settings.temperature < 0 || settings.temperature > 1) {
      return 'Temperature must stay between 0 and 1.'
    }
    if (!Number.isFinite(settings.max_tokens) || settings.max_tokens < 256 || settings.max_tokens > 8192) {
      return 'Max tokens must stay between 256 and 8192.'
    }
    if (!Number.isFinite(settings.auto_resume_minutes) || settings.auto_resume_minutes < 1 || settings.auto_resume_minutes > 180) {
      return 'Auto resume must stay between 1 and 180 minutes.'
    }
    if (!Number.isFinite(settings.auto_activate_delay_minutes) || settings.auto_activate_delay_minutes < 0 || settings.auto_activate_delay_minutes > 60) {
      return 'Auto activate delay must stay between 0 and 60 minutes.'
    }
    return null
  }

  function validateBranchesSection(): string | null {
    if (isActive && selectedBranchCount === 0) {
      return 'Select at least one branch before activation.'
    }
    return null
  }

  function validateScheduleSection(): string | null {
    if (!settings.schedule_enabled) return null

    for (const day of DAYS) {
      const row = settings.schedule[day.key]
      if (!row.enabled) continue
      if (!isValidTimeValue(row.start) || !isValidTimeValue(row.end)) {
        return `Invalid time format for ${day.label}.`
      }
      if (row.start >= row.end) {
        return `${day.label}: start time must be before end time.`
      }
    }
    return null
  }

  function validatePromptSection(): string | null {
    if (!settings.primary_prompt.trim()) {
      return 'Primary prompt cannot be empty.'
    }

    if (primaryPromptChanged && !primaryPromptUnlocked) {
      return 'To edit and save primary prompt, check the safety checkbox first.'
    }

    return null
  }

  function validateFallbacksSection(): string | null {
    const keys = ['fallback_human_message', 'fallback_no_agent_message', 'fallback_tech_error_message'] as const
    for (const key of keys) {
      for (const locale of ['fr', 'en', 'he'] as const) {
        const value = settings[key][locale]
        if (!value || !value.trim()) {
          return `${key} (${locale}) cannot be empty.`
        }
      }
    }
    return null
  }

  function validateSection(section: SavableSectionId): string | null {
    if (section === 'overview') return validateOverviewSection()
    if (section === 'model') return validateModelSection()
    if (section === 'branches') return validateBranchesSection()
    if (section === 'schedule') return validateScheduleSection()
    if (section === 'prompt') return validatePromptSection()
    return validateFallbacksSection()
  }

  async function saveSection(section: SavableSectionId) {
    try {
      clearSectionStatus(section)
      const validationError = validateSection(section)
      if (validationError) {
        setSectionMessage(section, 'error', validationError)
        return
      }

      setSavingSection(section)

      const payload = {
        id: settingsId,
        is_active: isActive,
        settings,
      }

      const response = await fetch('/api/admin/clara-codex/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to save settings')
      }

      if (section === 'prompt') {
        setOriginalPrimaryPrompt(settings.primary_prompt || '')
      }

      setSectionMessage(section, 'success', `${sectionTitle(section)} saved.`)
    } catch (e) {
      setSectionMessage(section, 'error', e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSavingSection(null)
    }
  }

  function toggleSection(section: SectionId) {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  function renderSectionStatus(section: SectionId) {
    const status = sectionStatus[section]
    if (!status) return null

    return (
      <div className={classNames(
        'rounded-lg border px-4 py-3 text-sm flex items-center gap-2',
        status.type === 'error'
          ? (isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700')
          : (isDark ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-700')
      )}>
        <AlertCircle className="w-4 h-4" />
        <span>{status.message}</span>
      </div>
    )
  }

  function renderSaveButton(section: SavableSectionId, label: string) {
    const saving = savingSection === section
    return (
      <div className="flex justify-end">
        <button
          onClick={() => saveSection(section)}
          disabled={!!savingSection}
          className={classNames(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white',
            isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
            !!savingSection && 'opacity-60 cursor-not-allowed'
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {label}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className={classNames('w-7 h-7 animate-spin', isDark ? 'text-blue-400' : 'text-blue-600')} />
      </div>
    )
  }

  const sectionList: SectionId[] = ['overview', 'model', 'branches', 'schedule', 'prompt', 'fallbacks', 'tools']

  return (
    <div className="space-y-5">
      <div className={classNames(
        'rounded-xl border p-5',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className={classNames('w-5 h-5', isDark ? 'text-blue-400' : 'text-blue-600')} />
              <h3 className={classNames('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                Clara Codex (Independent)
              </h3>
            </div>
            <p className={classNames('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Accordion layout with independent save and validation by section.
            </p>
          </div>
          <div className={classNames(
            'rounded-lg border px-3 py-2 text-xs',
            isDark ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
          )}>
            <p>Status: <span className="font-semibold">{isActive ? 'Active' : 'Inactive'}</span></p>
            <p>Branches: <span className="font-semibold">{selectedBranchCount}</span></p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className={classNames(
          'rounded-lg border px-4 py-3 text-sm flex items-center gap-2',
          isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
        )}>
          <AlertCircle className="w-4 h-4" />
          <span>{loadError}</span>
        </div>
      )}

      {sectionList.map((section) => {
        const Icon = sectionIcon(section)
        const open = openSections[section]

        return (
          <div
            key={section}
            className={classNames(
              'rounded-xl border',
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <button
              onClick={() => toggleSection(section)}
              className={classNames(
                'w-full px-5 py-4 flex items-center justify-between text-left',
                isDark ? 'hover:bg-gray-700/40' : 'hover:bg-gray-50'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={classNames('w-4 h-4', isDark ? 'text-blue-400' : 'text-blue-600')} />
                <div>
                  <h4 className={classNames('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    {sectionTitle(section)}
                  </h4>
                  <p className={classNames('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {sectionDescription(section)}
                  </p>
                </div>
              </div>
              {open ? (
                <ChevronUp className={classNames('w-4 h-4', isDark ? 'text-gray-400' : 'text-gray-500')} />
              ) : (
                <ChevronDown className={classNames('w-4 h-4', isDark ? 'text-gray-400' : 'text-gray-500')} />
              )}
            </button>

            {open && (
              <div className="px-5 pb-5 space-y-4">
                {section === 'overview' && (
                  <>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => {
                          setIsActive(e.target.checked)
                          clearSectionStatus('overview')
                        }}
                        className="w-5 h-5"
                      />
                      <span className={classNames('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                        Active
                      </span>
                    </label>

                    <div className={classNames(
                      'rounded-lg border p-3 text-sm',
                      isDark ? 'bg-gray-900/40 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
                    )}>
                      Activation checks:
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        <li>Primary prompt must not be empty.</li>
                        <li>At least one branch must be selected.</li>
                      </ul>
                    </div>

                    {renderSectionStatus('overview')}
                    {renderSaveButton('overview', 'Save Activation')}
                  </>
                )}

                {section === 'model' && (
                  <>
                    <div className="grid md:grid-cols-3 gap-4">
                      <label className="space-y-1">
                        <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Model</span>
                        <select
                          value={settings.model}
                          disabled={models.length === 0}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, model: e.target.value }))
                            clearSectionStatus('model')
                          }}
                          className={classNames(
                            'w-full rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        >
                          {Object.entries(groupedModels).map(([provider, providerModels]) => (
                            <optgroup key={provider} label={provider}>
                              {providerModels.map(model => (
                                <option key={model.id} value={model.id}>{model.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {models.length === 0 && (
                          <p className={classNames('text-xs', isDark ? 'text-yellow-300' : 'text-yellow-700')}>
                            No model available: validate at least one LLM API key first.
                          </p>
                        )}
                      </label>

                      <label className="space-y-1">
                        <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Temperature</span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          value={settings.temperature}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, temperature: Number(e.target.value) }))
                            clearSectionStatus('model')
                          }}
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
                          min={256}
                          max={8192}
                          step={128}
                          value={settings.max_tokens}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, max_tokens: Number(e.target.value) }))
                            clearSectionStatus('model')
                          }}
                          className={classNames(
                            'w-full rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </label>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={settings.faq_enabled}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, faq_enabled: e.target.checked }))
                            clearSectionStatus('model')
                          }}
                        />
                        <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>Use FAQ as truth source</span>
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={settings.enforce_email_for_link}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, enforce_email_for_link: e.target.checked }))
                            clearSectionStatus('model')
                          }}
                        />
                        <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>Require email before booking link</span>
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={settings.silent_human_call}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, silent_human_call: e.target.checked }))
                            clearSectionStatus('model')
                          }}
                        />
                        <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>Allow silent human escalation</span>
                      </label>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="space-y-1">
                        <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Auto resume (minutes)</span>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={settings.auto_resume_minutes}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, auto_resume_minutes: Number(e.target.value) }))
                            clearSectionStatus('model')
                          }}
                          className={classNames(
                            'w-full rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Auto activate delay (minutes)</span>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={settings.auto_activate_delay_minutes}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, auto_activate_delay_minutes: Number(e.target.value) }))
                            clearSectionStatus('model')
                          }}
                          className={classNames(
                            'w-full rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </label>
                    </div>

                    {renderSectionStatus('model')}
                    {renderSaveButton('model', 'Save Model & Behavior')}
                  </>
                )}

                {section === 'branches' && (
                  <>
                    <div className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Selected: <span className="font-semibold">{selectedBranchCount}</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2">
                      {branches.map(branch => {
                        const checked = settings.active_branches.includes(branch.id)
                        return (
                          <label key={branch.id} className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSettings(prev => ({
                                  ...prev,
                                  active_branches: e.target.checked
                                    ? [...prev.active_branches, branch.id]
                                    : prev.active_branches.filter(id => id !== branch.id),
                                }))
                                clearSectionStatus('branches')
                              }}
                            />
                            <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{branch.name}</span>
                          </label>
                        )
                      })}
                    </div>

                    {renderSectionStatus('branches')}
                    {renderSaveButton('branches', 'Save Active Branches')}
                  </>
                )}

                {section === 'schedule' && (
                  <>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.schedule_enabled}
                        onChange={(e) => {
                          setSettings(prev => ({ ...prev, schedule_enabled: e.target.checked }))
                          clearSectionStatus('schedule')
                        }}
                      />
                      <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>Enable schedule window</span>
                    </label>

                    {DAYS.map(day => (
                      <div key={day.key} className="grid grid-cols-4 gap-3 items-center">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={settings.schedule[day.key].enabled}
                            onChange={(e) => {
                              setSettings(prev => ({
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [day.key]: { ...prev.schedule[day.key], enabled: e.target.checked },
                                },
                              }))
                              clearSectionStatus('schedule')
                            }}
                          />
                          <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{day.label}</span>
                        </label>
                        <input
                          type="time"
                          value={settings.schedule[day.key].start}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              schedule: {
                                ...prev.schedule,
                                [day.key]: { ...prev.schedule[day.key], start: e.target.value },
                              },
                            }))
                            clearSectionStatus('schedule')
                          }}
                          className={classNames(
                            'rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                        <input
                          type="time"
                          value={settings.schedule[day.key].end}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              schedule: {
                                ...prev.schedule,
                                [day.key]: { ...prev.schedule[day.key], end: e.target.value },
                              },
                            }))
                            clearSectionStatus('schedule')
                          }}
                          className={classNames(
                            'rounded-lg border px-3 py-2 text-sm',
                            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </div>
                    ))}

                    {renderSectionStatus('schedule')}
                    {renderSaveButton('schedule', 'Save Schedule')}
                  </>
                )}

                {section === 'prompt' && (
                  <>
                    <div className={classNames(
                      'rounded-lg border p-3 space-y-2 text-sm',
                      isDark ? 'bg-gray-900/40 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
                    )}>
                      <p className="font-medium">Placeholders available in Primary prompt:</p>
                      <p><code>{'{{NOW_ISRAEL}}'}</code> <code>{'{{TODAY_ISO}}'}</code> <code>{'{{HUMAN_AVAILABLE}}'}</code></p>
                      <p><code>{'{{EMAIL_REQUIRED_FOR_LINK}}'}</code> <code>{'{{SILENT_HUMAN_ESCALATION}}'}</code></p>
                      <p><code>{'{{EVENT_KEYWORDS}}'}</code> <code>{'{{FAQ_BLOCK}}'}</code></p>
                    </div>

                    <div className={classNames(
                      'rounded-lg border p-3 space-y-3',
                      isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                      <p className={classNames('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
                        Safety confirmation before editing primary prompt
                      </p>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={unlockPrimaryPromptChecked}
                          onChange={(e) => {
                            setUnlockPrimaryPromptChecked(e.target.checked)
                            clearSectionStatus('prompt')
                          }}
                        />
                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                          I understand this prompt controls Clara Codex core behavior.
                        </span>
                      </label>
                    </div>

                    <label className="space-y-1 block">
                      <span className={classNames('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Primary prompt</span>
                      <textarea
                        value={settings.primary_prompt}
                        onChange={(e) => {
                          setSettings(prev => ({ ...prev, primary_prompt: e.target.value }))
                          clearSectionStatus('prompt')
                        }}
                        rows={16}
                        disabled={!primaryPromptUnlocked}
                        placeholder="Write the full Clara Codex system prompt here. Nothing is hidden in code."
                        className={classNames(
                          'w-full rounded-lg border px-3 py-2 text-sm',
                          isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900',
                          !primaryPromptUnlocked && 'opacity-60 cursor-not-allowed'
                        )}
                      />
                      {!primaryPromptUnlocked && (
                        <p className={classNames('text-xs', isDark ? 'text-yellow-300' : 'text-yellow-700')}>
                          Primary prompt is locked until the safety checkbox is checked.
                        </p>
                      )}
                    </label>

                    <label className="space-y-1 block">
                      <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Event keywords (comma separated)</span>
                      <input
                        value={settings.event_keywords.join(', ')}
                        onChange={(e) => {
                          setSettings(prev => ({
                            ...prev,
                            event_keywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean),
                          }))
                          clearSectionStatus('prompt')
                        }}
                        className={classNames(
                          'w-full rounded-lg border px-3 py-2 text-sm',
                          isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </label>

                    <label className="space-y-1 block">
                      <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Additional directive (optional)</span>
                      <textarea
                        value={settings.custom_prompt}
                        onChange={(e) => {
                          setSettings(prev => ({ ...prev, custom_prompt: e.target.value }))
                          clearSectionStatus('prompt')
                        }}
                        rows={7}
                        className={classNames(
                          'w-full rounded-lg border px-3 py-2 text-sm',
                          isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </label>

                    {renderSectionStatus('prompt')}
                    {renderSaveButton('prompt', 'Save Prompt & Keywords')}
                  </>
                )}

                {section === 'fallbacks' && (
                  <>
                    {(['fallback_human_message', 'fallback_no_agent_message', 'fallback_tech_error_message'] as const).map((key) => (
                      <div key={key} className="space-y-2">
                        <p className={classNames('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>{key}</p>
                        <div className="grid md:grid-cols-3 gap-3">
                          {(['fr', 'en', 'he'] as const).map((locale) => (
                            <textarea
                              key={`${key}-${locale}`}
                              value={settings[key][locale]}
                              onChange={(e) => {
                                setSettings(prev => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    [locale]: e.target.value,
                                  },
                                }))
                                clearSectionStatus('fallbacks')
                              }}
                              rows={3}
                              placeholder={`${key} (${locale})`}
                              className={classNames(
                                'rounded-lg border px-3 py-2 text-sm',
                                isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {renderSectionStatus('fallbacks')}
                    {renderSaveButton('fallbacks', 'Save Fallback Messages')}
                  </>
                )}

                {section === 'tools' && (
                  <div className="space-y-3">
                    {CODEX_WHATSAPP_TOOL_CATALOG.map(tool => (
                      <div
                        key={tool.id}
                        className={classNames(
                          'rounded-lg border p-3',
                          isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className={classNames('font-medium text-sm', isDark ? 'text-gray-200' : 'text-gray-900')}>
                            {tool.label}
                          </p>
                          <code className={classNames('text-xs', isDark ? 'text-blue-300' : 'text-blue-700')}>{tool.id}</code>
                        </div>
                        <p className={classNames('text-sm mt-1', isDark ? 'text-gray-300' : 'text-gray-700')}>
                          {tool.purpose}
                        </p>
                        <p className={classNames('text-xs mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                          Trigger: {tool.trigger}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
