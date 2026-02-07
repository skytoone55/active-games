'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, Sparkles, Key, AlertCircle, CheckCircle } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'

interface AIModelSectionProps {
  isDark: boolean
}

type LLMProvider = 'anthropic' | 'openai' | 'gemini'

interface ProviderModel {
  id: string
  name: string
  description: string
}

interface ProviderConfig {
  name: string
  models: ProviderModel[]
  envKey: string
}

interface ApiKeyStatus {
  configured: boolean
  masked: string | null
}

interface MessengerAISettings {
  provider: LLMProvider
  model: string
}

export function AIModelSection({ isDark }: AIModelSectionProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [settings, setSettings] = useState<MessengerAISettings | null>(null)
  const [originalSettings, setOriginalSettings] = useState<MessengerAISettings | null>(null)
  const [providers, setProviders] = useState<Record<LLMProvider, ProviderConfig>>({} as Record<LLMProvider, ProviderConfig>)
  const [apiKeys, setApiKeys] = useState<Record<LLMProvider, ApiKeyStatus>>({} as Record<LLMProvider, ApiKeyStatus>)

  // Load settings
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/messenger/ai-settings')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      setSettings(data.settings)
      setOriginalSettings(data.settings)
      setProviders(data.providers || {})
      setApiKeys(data.apiKeys || {})

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/messenger/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) throw new Error('Failed to save AI settings')

      setOriginalSettings(settings)
      setSuccess(t('messenger.settings.ai.save_success'))
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI settings')
    } finally {
      setSaving(false)
    }
  }

  const hasUnsavedChanges = (): boolean => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className={`p-4 rounded-lg ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {t('messenger.settings.ai.load_error')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isDark ? 'bg-purple-500/20' : 'bg-purple-100'
        }`}>
          <Sparkles className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        </div>
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('messenger.settings.ai.title')}
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('messenger.settings.ai.subtitle')}
          </p>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
        }`}>
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
        }`}>
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Provider Selection */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          <Key className="w-4 h-4 inline mr-2" />
          {t('messenger.settings.ai.provider_label')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(providers).map(([providerId, provider]) => {
            const keyStatus = apiKeys[providerId as LLMProvider]
            const isSelected = settings.provider === providerId
            const isConfigured = keyStatus?.configured

            // Logique correcte des pastilles:
            // 🟢 Vert = sélectionné ET clé configurée
            // 🟠 Orange = NON sélectionné ET clé configurée
            // 🔴 Rouge = clé manquante/invalide (peu importe si sélectionné)
            let dotColor = 'bg-red-500' // Rouge par défaut
            if (isConfigured) {
              dotColor = isSelected ? 'bg-green-500' : 'bg-orange-500'
            }

            return (
              <button
                key={providerId}
                onClick={() => {
                  if (isConfigured) {
                    const newProvider = providerId as LLMProvider
                    const defaultModel = providers[newProvider]?.models[0]?.id || ''
                    setSettings({ provider: newProvider, model: defaultModel })
                  }
                }}
                disabled={!isConfigured}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? isDark
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-purple-500 bg-purple-50'
                    : isConfigured
                      ? isDark
                        ? 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      : isDark
                        ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {provider.name.split(' ')[0]}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                </div>
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {provider.models.length} {t('messenger.settings.ai.models_count')}
                </span>
                {isSelected && (
                  <div className={`mt-1 text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                    ✓ {t('messenger.settings.ai.selected')}
                  </div>
                )}
                {keyStatus?.masked && (
                  <p className={`mt-1 text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {keyStatus.masked}
                  </p>
                )}
              </button>
            )
          })}
        </div>
        <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('messenger.settings.ai.env_note')}
        </p>
      </div>

      {/* Model Selection */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          <Sparkles className="w-4 h-4 inline mr-2" />
          {t('messenger.settings.ai.model_label')} ({providers[settings.provider]?.name || settings.provider})
        </label>
        <select
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          className={`w-full px-4 py-3 rounded-lg border transition-colors ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white focus:border-purple-500'
              : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
          } focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
        >
          {providers[settings.provider]?.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
        <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('messenger.settings.ai.model_note')}
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-700">
        <button
          onClick={saveSettings}
          disabled={saving || !hasUnsavedChanges()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isDark
              ? 'bg-purple-500 text-white hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500'
              : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400'
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t('messenger.settings.ai.save')}
        </button>
      </div>
    </div>
  )
}
