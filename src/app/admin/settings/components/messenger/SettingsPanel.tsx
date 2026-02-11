'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { Loader2, Save, MessageCircle } from 'lucide-react'
import type { MessengerSettings } from '@/types/messenger'

const LOCALES = ['fr', 'en', 'he'] as const
type Locale = typeof LOCALES[number]

interface SettingsPanelProps {
  isDark: boolean
}

export function SettingsPanel({ isDark }: SettingsPanelProps) {
  const { t, locale } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<MessengerSettings | null>(null)
  const [activeLocale, setActiveLocale] = useState<Locale>((locale as Locale) || 'fr')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/messenger/settings')
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/messenger/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await res.json()
      if (data.success) {
        alert(t('messenger.settings.saved'))
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!settings) return null

  // Helper to get auto-reply message for a locale
  const getAutoReplyMessage = (loc: Locale): string => {
    const msg = settings.settings?.whatsapp_auto_reply?.message
    if (!msg) return ''
    // Support both old (string) and new (multilingual object) format
    if (typeof msg === 'string') return loc === 'fr' ? msg : ''
    return msg[loc] || ''
  }

  const setAutoReplyMessage = (loc: Locale, value: string) => {
    const currentSettings = settings.settings || {}
    const currentAutoReply = currentSettings.whatsapp_auto_reply || { enabled: true, message: { fr: '', en: '', he: '' } }
    // Migrate from string to object if needed
    let currentMessage = currentAutoReply.message
    if (typeof currentMessage === 'string') {
      currentMessage = { fr: currentMessage, en: '', he: '' }
    }
    setSettings({
      ...settings,
      settings: {
        ...currentSettings,
        whatsapp_auto_reply: {
          ...currentAutoReply,
          message: {
            ...currentMessage,
            [loc]: value,
          }
        }
      }
    })
  }

  return (
    <div className="space-y-6">
      <div
        className="p-6 rounded-lg border"
        style={{
          backgroundColor: isDark ? '#1F2937' : 'white',
          borderColor: isDark ? '#374151' : '#E5E7EB'
        }}
      >
        <div className="space-y-4">
          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('messenger.settings.is_active')}
              </label>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('messenger.settings.is_active_help')}
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, is_active: !settings.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.is_active ? 'bg-blue-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Welcome delay */}
          <div>
            <label className={`block font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('messenger.settings.welcome_delay')}
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={settings.welcome_delay_seconds}
              onChange={(e) =>
                setSettings({ ...settings, welcome_delay_seconds: parseInt(e.target.value) })
              }
              className="w-32 px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: isDark ? '#111827' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{t('messenger.settings.save')}</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Auto-Reply */}
      <div
        className="p-6 rounded-lg border"
        style={{
          backgroundColor: isDark ? '#1F2937' : 'white',
          borderColor: isDark ? '#374151' : '#E5E7EB'
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('messenger.settings.whatsapp_auto_reply.title')}
          </h3>
        </div>
        <div className="space-y-4">
          {/* Auto-reply toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('messenger.settings.whatsapp_auto_reply.toggle_label')}
              </label>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('messenger.settings.whatsapp_auto_reply.toggle_help')}
              </p>
            </div>
            <button
              onClick={() => {
                const currentSettings = settings.settings || {}
                const currentAutoReply = currentSettings.whatsapp_auto_reply || { enabled: false, message: { fr: '', en: '', he: '' } }
                setSettings({
                  ...settings,
                  settings: {
                    ...currentSettings,
                    whatsapp_auto_reply: {
                      ...currentAutoReply,
                      enabled: !currentAutoReply.enabled,
                    }
                  }
                })
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.settings?.whatsapp_auto_reply?.enabled ? 'bg-green-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.settings?.whatsapp_auto_reply?.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Auto-reply message with language tabs */}
          {settings.settings?.whatsapp_auto_reply?.enabled && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('messenger.settings.whatsapp_auto_reply.message_label')}
                </label>
                <div className="flex gap-1">
                  {LOCALES.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setActiveLocale(loc)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        activeLocale === loc
                          ? 'bg-green-600 text-white'
                          : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {loc.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={3}
                value={getAutoReplyMessage(activeLocale)}
                onChange={(e) => setAutoReplyMessage(activeLocale, e.target.value)}
                placeholder={t('messenger.settings.whatsapp_auto_reply.message_placeholder')}
                className="w-full px-3 py-2 rounded-lg border resize-none"
                style={{
                  backgroundColor: isDark ? '#111827' : 'white',
                  borderColor: isDark ? '#374151' : '#D1D5DB',
                  color: isDark ? 'white' : 'black'
                }}
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {t('messenger.settings.whatsapp_auto_reply.message_hint')}
              </p>
            </div>
          )}

          {/* Save button for auto-reply */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{t('messenger.settings.save')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
