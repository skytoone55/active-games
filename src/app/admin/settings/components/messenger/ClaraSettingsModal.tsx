'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'

interface ClaraSettingsModalProps {
  isDark: boolean
  onClose: () => void
  workflowId?: string // Optional: if editing a specific workflow
}

interface ClaraSettings {
  clara_default_prompt: string
  clara_fallback_action: 'escalate' | 'retry' | 'abort'
  clara_fallback_message: string
}

export function ClaraSettingsModal({ isDark, onClose, workflowId }: ClaraSettingsModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [settings, setSettings] = useState<ClaraSettings>({
    clara_default_prompt: '',
    clara_fallback_action: 'escalate',
    clara_fallback_message: ''
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

      if (data.success && data.settings) {
        setSettings(data.settings)
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
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-3xl rounded-lg shadow-xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        } max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'
            }`}>
              <Sparkles className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('messenger.clara_settings.title')}
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('messenger.clara_settings.subtitle')}
              </p>
            </div>
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
          ) : (
            <>
              {/* Error */}
              {error && (
                <div className={`flex items-center gap-2 p-4 rounded-lg ${
                  isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                }`}>
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className={`flex items-center gap-2 p-4 rounded-lg ${
                  isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                }`}>
                  <CheckCircle className="w-5 h-5" />
                  {t('messenger.clara_settings.save_success')}
                </div>
              )}

              {/* Default Prompt */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('messenger.clara_settings.default_prompt_label')}
                </label>
                <textarea
                  value={settings.clara_default_prompt}
                  onChange={(e) => setSettings({ ...settings, clara_default_prompt: e.target.value })}
                  rows={8}
                  placeholder={t('messenger.clara_settings.default_prompt_placeholder')}
                  className={`w-full px-4 py-3 rounded-lg border font-mono text-sm ${
                    isDark
                      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                />
                <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('messenger.clara_settings.default_prompt_help')}
                </p>
              </div>

              {/* Fallback Action */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('messenger.clara_settings.fallback_action_label')}
                </label>
                <select
                  value={settings.clara_fallback_action}
                  onChange={(e) => setSettings({ ...settings, clara_fallback_action: e.target.value as any })}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-gray-900 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                >
                  <option value="escalate">{t('messenger.clara_settings.fallback_escalate')}</option>
                  <option value="retry">{t('messenger.clara_settings.fallback_retry')}</option>
                  <option value="abort">{t('messenger.clara_settings.fallback_abort')}</option>
                </select>
                <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('messenger.clara_settings.fallback_action_help')}
                </p>
              </div>

              {/* Fallback Message */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('messenger.clara_settings.fallback_message_label')}
                </label>
                <textarea
                  value={settings.clara_fallback_message}
                  onChange={(e) => setSettings({ ...settings, clara_fallback_message: e.target.value })}
                  rows={3}
                  placeholder={t('messenger.clara_settings.fallback_message_placeholder')}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                />
                <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('messenger.clara_settings.fallback_message_help')}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className={`flex justify-end gap-3 p-6 border-t ${
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
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
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
              {t('common.save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
