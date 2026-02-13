'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Bot, Clock, Building2, AlertCircle } from 'lucide-react'
import { useAdmin } from '@/contexts/AdminContext'
import { buildDefaultSchedule, ClaraCodexWhatsAppSettings, CODEX_AVAILABLE_MODELS, normalizeClaraCodexSettings } from '@/lib/clara-codex/config'

interface ClaraCodexSectionProps {
  isDark: boolean
}

interface SettingsResponse {
  id: string
  is_active: boolean
  settings: ClaraCodexWhatsAppSettings
  models: typeof CODEX_AVAILABLE_MODELS
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

export function ClaraCodexSection({ isDark }: ClaraCodexSectionProps) {
  const { branches } = useAdmin()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [settings, setSettings] = useState<ClaraCodexWhatsAppSettings>(normalizeClaraCodexSettings({}))
  const [models, setModels] = useState<typeof CODEX_AVAILABLE_MODELS>(CODEX_AVAILABLE_MODELS)

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

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/clara-codex/settings')
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to load Clara Codex settings')
      }

      const payload = json.data as SettingsResponse
      setSettingsId(payload.id)
      setIsActive(payload.is_active)
      setSettings(normalizeClaraCodexSettings(payload.settings))
      if (Array.isArray(payload.models) && payload.models.length > 0) {
        setModels(payload.models)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

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

      setSuccess('Clara Codex settings saved')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className={classNames('w-7 h-7 animate-spin', isDark ? 'text-blue-400' : 'text-blue-600')} />
      </div>
    )
  }

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
              Dedicated WhatsApp AI engine with isolated settings, tools and tracking.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5"
            />
            <span className={classNames('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
              Active
            </span>
          </label>
        </div>
      </div>

      <div className={classNames(
        'rounded-xl border p-5 space-y-4',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h4 className={classNames('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Model & Behavior</h4>

        <div className="grid md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Model</span>
            <select
              value={settings.model}
              onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
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
          </label>

          <label className="space-y-1">
            <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Temperature</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={settings.temperature}
              onChange={(e) => setSettings(prev => ({ ...prev, temperature: Number(e.target.value) }))}
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
              onChange={(e) => setSettings(prev => ({ ...prev, max_tokens: Number(e.target.value) }))}
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
              onChange={(e) => setSettings(prev => ({ ...prev, faq_enabled: e.target.checked }))}
            />
            <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>Use FAQ as truth source</span>
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enforce_email_for_link}
              onChange={(e) => setSettings(prev => ({ ...prev, enforce_email_for_link: e.target.checked }))}
            />
            <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>Require email before booking link</span>
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.silent_human_call}
              onChange={(e) => setSettings(prev => ({ ...prev, silent_human_call: e.target.checked }))}
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
              onChange={(e) => setSettings(prev => ({ ...prev, auto_resume_minutes: Number(e.target.value) }))}
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
              onChange={(e) => setSettings(prev => ({ ...prev, auto_activate_delay_minutes: Number(e.target.value) }))}
              className={classNames(
                'w-full rounded-lg border px-3 py-2 text-sm',
                isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </label>
        </div>
      </div>

      <div className={classNames(
        'rounded-xl border p-5 space-y-4',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h4 className={classNames('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
          <Building2 className="w-4 h-4" /> Active Branches
        </h4>
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
                  }}
                />
                <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{branch.name}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className={classNames(
        'rounded-xl border p-5 space-y-4',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h4 className={classNames('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
          <Clock className="w-4 h-4" /> Schedule
        </h4>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.schedule_enabled}
            onChange={(e) => setSettings(prev => ({ ...prev, schedule_enabled: e.target.checked }))}
          />
          <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>Enable schedule window</span>
        </label>

        {DAYS.map(day => (
          <div key={day.key} className="grid grid-cols-4 gap-3 items-center">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.schedule[day.key].enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  schedule: {
                    ...prev.schedule,
                    [day.key]: { ...prev.schedule[day.key], enabled: e.target.checked },
                  },
                }))}
              />
              <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{day.label}</span>
            </label>
            <input
              type="time"
              value={settings.schedule[day.key].start}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                schedule: {
                  ...prev.schedule,
                  [day.key]: { ...prev.schedule[day.key], start: e.target.value },
                },
              }))}
              className={classNames(
                'rounded-lg border px-3 py-2 text-sm',
                isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
              )}
            />
            <input
              type="time"
              value={settings.schedule[day.key].end}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                schedule: {
                  ...prev.schedule,
                  [day.key]: { ...prev.schedule[day.key], end: e.target.value },
                },
              }))}
              className={classNames(
                'rounded-lg border px-3 py-2 text-sm',
                isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>
        ))}
      </div>

      <div className={classNames(
        'rounded-xl border p-5 space-y-4',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h4 className={classNames('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Prompt & Keywords</h4>
        <label className="space-y-1 block">
          <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Event keywords (comma separated)</span>
          <input
            value={settings.event_keywords.join(', ')}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              event_keywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean),
            }))}
            className={classNames(
              'w-full rounded-lg border px-3 py-2 text-sm',
              isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            )}
          />
        </label>

        <label className="space-y-1 block">
          <span className={classNames('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>Custom directive</span>
          <textarea
            value={settings.custom_prompt}
            onChange={(e) => setSettings(prev => ({ ...prev, custom_prompt: e.target.value }))}
            rows={7}
            className={classNames(
              'w-full rounded-lg border px-3 py-2 text-sm',
              isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            )}
          />
        </label>
      </div>

      <div className={classNames(
        'rounded-xl border p-5 space-y-4',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h4 className={classNames('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Fallback Messages</h4>
        {(['fallback_human_message', 'fallback_no_agent_message', 'fallback_tech_error_message'] as const).map((key) => (
          <div key={key} className="space-y-2">
            <p className={classNames('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>{key}</p>
            <div className="grid md:grid-cols-3 gap-3">
              {(['fr', 'en', 'he'] as const).map((locale) => (
                <textarea
                  key={`${key}-${locale}`}
                  value={settings[key][locale]}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    [key]: {
                      ...prev[key],
                      [locale]: e.target.value,
                    },
                  }))}
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
      </div>

      {(error || success) && (
        <div className={classNames(
          'rounded-lg border px-4 py-3 text-sm flex items-center gap-2',
          error
            ? (isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700')
            : (isDark ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-700')
        )}>
          <AlertCircle className="w-4 h-4" />
          <span>{error || success}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className={classNames(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
            isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white',
            saving && 'opacity-60 cursor-not-allowed'
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Clara Codex
        </button>
      </div>
    </div>
  )
}
