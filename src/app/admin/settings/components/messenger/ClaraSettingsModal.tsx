'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, Sparkles, AlertCircle, CheckCircle, RotateCcw, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'

interface ClaraSettingsModalProps {
  isDark: boolean
  onClose: () => void
  workflowId?: string
}

interface ClaraSettings {
  clara_global_enabled: boolean
  clara_default_prompt: string
  clara_personality: string
  clara_rules: string
  clara_model_global: string
  clara_temperature_global: number
  clara_fallback_action: 'escalate' | 'retry' | 'abort'
  clara_fallback_message: { fr: string; en: string; he: string }
}

interface Defaults {
  clara_default_prompt: string
  clara_personality: string
  clara_rules: string
}

type TabId = 'prompt' | 'personality' | 'rules' | 'model' | 'fallback' | 'preview'

export function ClaraSettingsModal({ isDark, onClose, workflowId }: ClaraSettingsModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('prompt')

  const [settings, setSettings] = useState<ClaraSettings>({
    clara_global_enabled: true,
    clara_default_prompt: '',
    clara_personality: '',
    clara_rules: '',
    clara_model_global: 'gpt-4o-mini',
    clara_temperature_global: 0.7,
    clara_fallback_action: 'escalate',
    clara_fallback_message: { fr: '', en: '', he: '' }
  })

  const [defaults, setDefaults] = useState<Defaults>({
    clara_default_prompt: '',
    clara_personality: '',
    clara_rules: ''
  })

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      setLoading(true)
      const url = workflowId
        ? `/api/admin/messenger/workflows/${workflowId}/clara-settings`
        : '/api/admin/messenger/clara-settings'

      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        if (data.settings) {
          // Safety: handle old string format for fallback_message (before migration)
          const fm = data.settings.clara_fallback_message
          if (typeof fm === 'string') {
            data.settings.clara_fallback_message = { fr: '', en: '', he: fm }
          } else if (!fm || typeof fm !== 'object') {
            data.settings.clara_fallback_message = { fr: '', en: '', he: '' }
          }
          setSettings(data.settings)
        }
        if (data.defaults) setDefaults(data.defaults)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)

      const url = workflowId
        ? `/api/admin/messenger/workflows/${workflowId}/clara-settings`
        : '/api/admin/messenger/clara-settings'

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to save settings')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function handleReset(field: keyof Defaults) {
    if (defaults[field]) {
      setSettings(prev => ({ ...prev, [field]: defaults[field] }))
    }
  }

  // Build preview of what's actually sent to Clara
  function buildPreview(): string {
    const userLang = '{detected_language}'
    let preview = `ABSOLUTE RULE #1: You MUST respond in the SAME LANGUAGE as the user's last message. Detected language: ${userLang}.

--- PROMPT MÉTIER ---
${settings.clara_default_prompt}

--- PERSONALITY ---
## YOUR PERSONALITY
${settings.clara_personality}

--- FORMAT JSON ---
## MANDATORY JSON RESPONSE
{"reply_to_user": "text", "is_complete": true/false, "collected_data": {"KEY": "value"}}

--- RULES ---
## RULES
${settings.clara_rules}
- CRITICAL LANGUAGE RULE: Your ENTIRE response must be in ONE language only: ${userLang}.

--- MODULE CONTEXT (dynamique) ---
## CURRENT MODULE: "{question du module en cours}"
Options: 1."id"="label" ...

--- FAQ (dynamique, max 3) ---
## RELEVANT FAQ
Q: ...
A: ...

--- DONNÉES COLLECTÉES (dynamique) ---
Already collected: {"firstName": "...", ...}`

    return preview
  }

  const tabs: Array<{ id: TabId; label: string; emoji: string }> = [
    { id: 'prompt', label: 'Prompt Métier', emoji: '📝' },
    { id: 'personality', label: 'Personnalité', emoji: '🎭' },
    { id: 'rules', label: 'Règles', emoji: '📋' },
    { id: 'model', label: 'Modèle', emoji: '🤖' },
    { id: 'fallback', label: 'Fallback', emoji: '🔄' },
    { id: 'preview', label: 'Aperçu Final', emoji: '👁️' },
  ]

  const inputClass = `w-full px-4 py-3 rounded-lg border font-mono text-sm ${
    isDark
      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-4xl rounded-lg shadow-xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        } max-h-[92vh] flex flex-col`}
      >
        {/* Header */}
        <div className={`flex justify-between items-center p-5 border-b shrink-0 ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'
            }`}>
              <Sparkles className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Clara AI — Configuration complète
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Chaque section du prompt envoyé à Clara est modifiable
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Clara {settings.clara_global_enabled ? 'ON' : 'OFF'}
            </span>
            <button
              onClick={() => setSettings({ ...settings, clara_global_enabled: !settings.clara_global_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.clara_global_enabled ? 'bg-green-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.clara_global_enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 px-5 pt-3 shrink-0 overflow-x-auto ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-gray-700 text-white border-b-2 border-indigo-500'
                    : 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500'
                  : isDark
                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
          ) : (
            <>
              {/* Error / Success */}
              {error && (
                <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                  isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                }`}>
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                  isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                }`}>
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  Sauvegardé avec succès !
                </div>
              )}

              {/* Tab: Prompt Métier */}
              {activeTab === 'prompt' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Prompt Métier
                      </h4>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Instructions spécifiques à ton business : rôle de Clara, formats de données, règles métier
                      </p>
                    </div>
                    <button
                      onClick={() => handleReset('clara_default_prompt')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" /> Reset défaut
                    </button>
                  </div>
                  <textarea
                    value={settings.clara_default_prompt}
                    onChange={(e) => setSettings({ ...settings, clara_default_prompt: e.target.value })}
                    rows={18}
                    className={inputClass}
                  />
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {settings.clara_default_prompt.length} caractères
                  </p>
                </div>
              )}

              {/* Tab: Personality */}
              {activeTab === 'personality' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Personnalité
                      </h4>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Comment Clara parle : ton, style, approche avec les clients
                      </p>
                    </div>
                    <button
                      onClick={() => handleReset('clara_personality')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" /> Reset défaut
                    </button>
                  </div>
                  <textarea
                    value={settings.clara_personality}
                    onChange={(e) => setSettings({ ...settings, clara_personality: e.target.value })}
                    rows={10}
                    className={inputClass}
                  />
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {settings.clara_personality.length} caractères
                  </p>
                </div>
              )}

              {/* Tab: Rules */}
              {activeTab === 'rules' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Règles
                      </h4>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Règles de comportement : comment gérer les choix, les questions hors-sujet, la FAQ, etc.
                      </p>
                    </div>
                    <button
                      onClick={() => handleReset('clara_rules')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" /> Reset défaut
                    </button>
                  </div>
                  <textarea
                    value={settings.clara_rules}
                    onChange={(e) => setSettings({ ...settings, clara_rules: e.target.value })}
                    rows={14}
                    className={inputClass}
                  />
                  <div className={`p-3 rounded-lg text-xs ${isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700'}`}>
                    ⚠️ La règle de langue est ajoutée automatiquement (pas besoin de la mettre ici)
                  </div>
                </div>
              )}

              {/* Tab: Model */}
              {activeTab === 'model' && (
                <div className="space-y-5">
                  <div>
                    <h4 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Modèle IA global
                    </h4>
                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Modèle utilisé par défaut (peut être overridé par module)
                    </p>
                    <select
                      value={settings.clara_model_global}
                      onChange={(e) => setSettings({ ...settings, clara_model_global: e.target.value })}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                    >
                      <optgroup label="OpenAI">
                        <option value="gpt-4o-mini">GPT-4o Mini (rapide, économique)</option>
                        <option value="gpt-4o">GPT-4o (puissant)</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      </optgroup>
                      <optgroup label="Google">
                        <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (très rapide)</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      </optgroup>
                      <optgroup label="Anthropic">
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku (rapide)</option>
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Température ({settings.clara_temperature_global})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.clara_temperature_global}
                      onChange={(e) => setSettings({ ...settings, clara_temperature_global: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                    <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span>0 — Précis/Robot</span>
                      <span>1 — Créatif/Variable</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Fallback */}
              {activeTab === 'fallback' && (
                <div className="space-y-5">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Action si Clara échoue
                    </label>
                    <select
                      value={settings.clara_fallback_action}
                      onChange={(e) => setSettings({ ...settings, clara_fallback_action: e.target.value as any })}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                    >
                      <option value="escalate">Escalade → Message de fallback</option>
                      <option value="retry">Réessayer (re-poser la question)</option>
                      <option value="abort">Abandonner</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Message de fallback
                    </label>
                    <div>
                      <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        🇫🇷 Français
                      </label>
                      <textarea
                        value={settings.clara_fallback_message.fr}
                        onChange={(e) => setSettings({ ...settings, clara_fallback_message: { ...settings.clara_fallback_message, fr: e.target.value } })}
                        rows={2}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        🇬🇧 English
                      </label>
                      <textarea
                        value={settings.clara_fallback_message.en}
                        onChange={(e) => setSettings({ ...settings, clara_fallback_message: { ...settings.clara_fallback_message, en: e.target.value } })}
                        rows={2}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        🇮🇱 עברית
                      </label>
                      <textarea
                        value={settings.clara_fallback_message.he}
                        onChange={(e) => setSettings({ ...settings, clara_fallback_message: { ...settings.clara_fallback_message, he: e.target.value } })}
                        rows={2}
                        dir="rtl"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Preview */}
              {activeTab === 'preview' && (
                <div className="space-y-3">
                  <div>
                    <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Aperçu du prompt final envoyé à Clara
                    </h4>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Voici exactement ce que Clara reçoit. Les sections entre {'{ }'} sont dynamiques (remplies à chaque message).
                    </p>
                  </div>
                  <pre className={`p-4 rounded-lg text-xs leading-relaxed overflow-auto max-h-[55vh] whitespace-pre-wrap ${
                    isDark ? 'bg-gray-900 text-gray-300 border border-gray-700' : 'bg-gray-50 text-gray-800 border border-gray-200'
                  }`}>
                    {buildPreview()}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className={`flex justify-end gap-3 p-5 border-t shrink-0 ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Fermer
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-white transition-colors ${
                saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Sauvegarder
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
