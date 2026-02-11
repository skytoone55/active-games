'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { useAdmin } from '@/contexts/AdminContext'
import {
  Loader2, Save, Phone, Plus, Trash2, MessageCircle
} from 'lucide-react'
import type { MessengerSettings } from '@/types/messenger'

const LOCALES = ['fr', 'en', 'he'] as const
type Locale = (typeof LOCALES)[number]

interface MultilingualText {
  fr: string
  en: string
  he: string
}

interface ActivityConfig {
  id: string
  label: MultilingualText
  emoji: string
}

interface BranchConfig {
  branch_id: string
  label: MultilingualText
  emoji: string
}

interface WhatsAppOnboardingConfig {
  enabled: boolean
  language: 'he' | 'fr' | 'en'
  activities: ActivityConfig[]
  branches: BranchConfig[]
  activity_prompt: MultilingualText
  branch_prompt: MultilingualText
  welcome_message_enabled: boolean
  welcome_message: MultilingualText
}

const emptyMultilingual = (): MultilingualText => ({ fr: '', en: '', he: '' })

const DEFAULT_CONFIG: WhatsAppOnboardingConfig = {
  enabled: false,
  language: 'he',
  activities: [],
  branches: [],
  activity_prompt: { fr: 'Choisissez votre activité :', en: 'Choose your activity:', he: 'בחרו את הפעילות:' },
  branch_prompt: { fr: 'Choisissez votre centre :', en: 'Choose your location:', he: 'בחרו את הסניף:' },
  welcome_message_enabled: true,
  welcome_message: emptyMultilingual(),
}

interface WhatsAppSectionProps {
  isDark: boolean
}

export function WhatsAppSection({ isDark }: WhatsAppSectionProps) {
  const { t, locale } = useTranslation()
  const { branches } = useAdmin()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<MessengerSettings | null>(null)
  const [config, setConfig] = useState<WhatsAppOnboardingConfig>(DEFAULT_CONFIG)
  const [activeLocale, setActiveLocale] = useState<Locale>((locale as Locale) || 'fr')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/messenger/settings')
      const data = await res.json()
      if (data.success && data.data) {
        setSettings(data.data)
        const saved = data.data.settings?.whatsapp_onboarding
        if (saved) {
          setConfig({ ...DEFAULT_CONFIG, ...saved })
        }
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
      const updatedSettings = {
        ...settings,
        settings: {
          ...settings.settings,
          whatsapp_onboarding: config,
        }
      }
      const res = await fetch('/api/admin/messenger/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      })
      const data = await res.json()
      if (data.success) {
        setSettings(updatedSettings)
        alert(t('whatsapp.onboarding.saved') || 'Saved!')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  // Helpers
  const updateConfig = (partial: Partial<WhatsAppOnboardingConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }))
  }

  const updateMultilingual = (
    field: 'activity_prompt' | 'branch_prompt' | 'welcome_message',
    loc: Locale,
    value: string
  ) => {
    setConfig(prev => ({
      ...prev,
      [field]: { ...prev[field], [loc]: value }
    }))
  }

  const addActivity = () => {
    if (config.activities.length >= 3) return
    const id = `activity_${Date.now()}`
    updateConfig({
      activities: [...config.activities, { id, label: emptyMultilingual(), emoji: '' }]
    })
  }

  const removeActivity = (index: number) => {
    updateConfig({
      activities: config.activities.filter((_, i) => i !== index)
    })
  }

  const updateActivity = (index: number, field: keyof ActivityConfig, value: string | MultilingualText) => {
    const updated = [...config.activities]
    updated[index] = { ...updated[index], [field]: value }
    updateConfig({ activities: updated })
  }

  const updateActivityLabel = (index: number, loc: Locale, value: string) => {
    const updated = [...config.activities]
    updated[index] = {
      ...updated[index],
      label: { ...updated[index].label, [loc]: value }
    }
    updateConfig({ activities: updated })
  }

  const addBranch = () => {
    if (config.branches.length >= 3) return
    updateConfig({
      branches: [...config.branches, { branch_id: '', label: emptyMultilingual(), emoji: '' }]
    })
  }

  const removeBranch = (index: number) => {
    updateConfig({
      branches: config.branches.filter((_, i) => i !== index)
    })
  }

  const updateBranch = (index: number, field: keyof BranchConfig, value: string | MultilingualText) => {
    const updated = [...config.branches]
    updated[index] = { ...updated[index], [field]: value }
    updateConfig({ branches: updated })
  }

  const updateBranchLabel = (index: number, loc: Locale, value: string) => {
    const updated = [...config.branches]
    updated[index] = {
      ...updated[index],
      label: { ...updated[index].label, [loc]: value }
    }
    updateConfig({ branches: updated })
  }

  // Card styling
  const cardStyle = {
    backgroundColor: isDark ? '#1F2937' : 'white',
    borderColor: isDark ? '#374151' : '#E5E7EB'
  }
  const inputStyle = {
    backgroundColor: isDark ? '#111827' : 'white',
    borderColor: isDark ? '#374151' : '#D1D5DB',
    color: isDark ? 'white' : 'black'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    )
  }

  const LanguageTabs = () => (
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
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          WhatsApp
        </h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('whatsapp.onboarding.subtitle') || "Configuration du flux d'onboarding WhatsApp"}
        </p>
      </div>

      {/* Toggle global */}
      <div className="p-6 rounded-lg border" style={cardStyle}>
        <div className="flex items-center justify-between">
          <div>
            <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('whatsapp.onboarding.enabled') || "Activer l'onboarding interactif"}
            </label>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('whatsapp.onboarding.enabled_help') || "Envoie des messages interactifs aux nouveaux contacts pour identifier l'activité et le centre"}
            </p>
          </div>
          <button
            onClick={() => updateConfig({ enabled: !config.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.enabled ? 'bg-green-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {config.enabled && (
        <>
          {/* Langue d'envoi */}
          <div className="p-6 rounded-lg border" style={cardStyle}>
            <label className={`block font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('whatsapp.onboarding.language') || "Langue des messages WhatsApp"}
            </label>
            <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('whatsapp.onboarding.language_help') || "Langue utilisée pour envoyer les boutons et messages"}
            </p>
            <div className="flex gap-2">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  onClick={() => updateConfig({ language: loc })}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    config.language === loc
                      ? 'bg-green-600 text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {loc === 'he' ? '🇮🇱 עברית' : loc === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                </button>
              ))}
            </div>
          </div>

          {/* Activités */}
          <div className="p-6 rounded-lg border" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('whatsapp.onboarding.activities_title') || 'Activités'}
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('whatsapp.onboarding.activities_help') || 'Maximum 3 activités (limite des boutons WhatsApp)'}
                </p>
              </div>
              <LanguageTabs />
            </div>

            <div className="space-y-3">
              {config.activities.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={activity.emoji}
                    onChange={(e) => updateActivity(idx, 'emoji', e.target.value)}
                    placeholder="🎮"
                    className="w-12 px-2 py-2 rounded-lg border text-center"
                    style={inputStyle}
                    maxLength={2}
                  />
                  <input
                    type="text"
                    value={activity.id}
                    onChange={(e) => updateActivity(idx, 'id', e.target.value.replace(/\s/g, '_').toLowerCase())}
                    placeholder="activity_id"
                    className="w-36 px-3 py-2 rounded-lg border text-sm font-mono"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={activity.label[activeLocale]}
                    onChange={(e) => updateActivityLabel(idx, activeLocale, e.target.value)}
                    placeholder={`${t('whatsapp.onboarding.button_label') || 'Nom du bouton'} (${activeLocale.toUpperCase()})`}
                    className="flex-1 px-3 py-2 rounded-lg border"
                    style={inputStyle}
                    maxLength={20}
                  />
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {activity.label[activeLocale]?.length || 0}/20
                  </span>
                  <button
                    onClick={() => removeActivity(idx)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {config.activities.length < 3 && (
              <button
                onClick={addActivity}
                className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Plus className="w-4 h-4" />
                {t('whatsapp.onboarding.add_activity') || 'Ajouter une activité'}
              </button>
            )}
          </div>

          {/* Branches */}
          <div className="p-6 rounded-lg border" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('whatsapp.onboarding.branches_title') || 'Centres / Succursales'}
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('whatsapp.onboarding.branches_help') || 'Maximum 3 centres (limite des boutons WhatsApp)'}
                </p>
              </div>
              <LanguageTabs />
            </div>

            <div className="space-y-3">
              {config.branches.map((branch, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={branch.emoji}
                    onChange={(e) => updateBranch(idx, 'emoji', e.target.value)}
                    placeholder="📍"
                    className="w-12 px-2 py-2 rounded-lg border text-center"
                    style={inputStyle}
                    maxLength={2}
                  />
                  <select
                    value={branch.branch_id}
                    onChange={(e) => updateBranch(idx, 'branch_id', e.target.value)}
                    className="w-48 px-3 py-2 rounded-lg border text-sm"
                    style={inputStyle}
                  >
                    <option value="">{t('whatsapp.onboarding.select_branch') || '-- Choisir --'}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.name_en ? `(${b.name_en})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={branch.label[activeLocale]}
                    onChange={(e) => updateBranchLabel(idx, activeLocale, e.target.value)}
                    placeholder={`${t('whatsapp.onboarding.button_label') || 'Nom du bouton'} (${activeLocale.toUpperCase()})`}
                    className="flex-1 px-3 py-2 rounded-lg border"
                    style={inputStyle}
                    maxLength={20}
                  />
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {branch.label[activeLocale]?.length || 0}/20
                  </span>
                  <button
                    onClick={() => removeBranch(idx)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {config.branches.length < 3 && (
              <button
                onClick={addBranch}
                className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Plus className="w-4 h-4" />
                {t('whatsapp.onboarding.add_branch') || 'Ajouter un centre'}
              </button>
            )}
          </div>

          {/* Messages de prompt */}
          <div className="p-6 rounded-lg border" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('whatsapp.onboarding.prompts_title') || 'Messages interactifs'}
              </h3>
              <LanguageTabs />
            </div>

            <div className="space-y-4">
              {/* Activity prompt */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('whatsapp.onboarding.activity_prompt') || "Message de choix d'activité"}
                </label>
                <textarea
                  rows={2}
                  value={config.activity_prompt[activeLocale]}
                  onChange={(e) => updateMultilingual('activity_prompt', activeLocale, e.target.value)}
                  placeholder={t('whatsapp.onboarding.activity_prompt_placeholder') || "Ex: Bonjour ! Quelle activité vous intéresse ?"}
                  className="w-full px-3 py-2 rounded-lg border resize-none"
                  style={inputStyle}
                />
              </div>

              {/* Branch prompt */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('whatsapp.onboarding.branch_prompt') || 'Message de choix de centre'}
                </label>
                <textarea
                  rows={2}
                  value={config.branch_prompt[activeLocale]}
                  onChange={(e) => updateMultilingual('branch_prompt', activeLocale, e.target.value)}
                  placeholder={t('whatsapp.onboarding.branch_prompt_placeholder') || 'Ex: Super ! Dans quel centre souhaitez-vous venir ?'}
                  className="w-full px-3 py-2 rounded-lg border resize-none"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Message de bienvenue */}
          <div className="p-6 rounded-lg border" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('whatsapp.onboarding.welcome_message') || 'Message de bienvenue'}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('whatsapp.onboarding.welcome_message_help') || "Envoyé après la fin de l'onboarding"}
                </p>
                <button
                  onClick={() => updateConfig({ welcome_message_enabled: !config.welcome_message_enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.welcome_message_enabled ? 'bg-green-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.welcome_message_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {config.welcome_message_enabled && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t('whatsapp.onboarding.welcome_text') || 'Texte du message'}
                    </label>
                    <LanguageTabs />
                  </div>
                  <textarea
                    rows={3}
                    value={config.welcome_message[activeLocale]}
                    onChange={(e) => updateMultilingual('welcome_message', activeLocale, e.target.value)}
                    placeholder={t('whatsapp.onboarding.welcome_placeholder') || 'Merci ! Un conseiller va vous répondre rapidement.'}
                    className="w-full px-3 py-2 rounded-lg border resize-none"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        <span>{t('whatsapp.onboarding.save') || 'Enregistrer'}</span>
      </button>
    </div>
  )
}
