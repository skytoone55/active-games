'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { Loader2, Save } from 'lucide-react'
import type { MessengerSettings } from '@/types/messenger'

interface SettingsPanelProps {
  isDark: boolean
}

export function SettingsPanel({ isDark }: SettingsPanelProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<MessengerSettings | null>(null)

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
    </div>
  )
}
