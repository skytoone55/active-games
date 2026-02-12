'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { useAdmin } from '@/contexts/AdminContext'
import {
  Loader2, Save, Plus, Trash2, MessageCircle, ChevronUp, ChevronDown, Sparkles, BookOpen,
  Settings, Clock, FileText, Copy, Building2
} from 'lucide-react'
import type { MessengerSettings } from '@/types/messenger'

const LOCALES = ['fr', 'en', 'he'] as const
type Locale = (typeof LOCALES)[number]

interface MultilingualText {
  fr: string
  en: string
  he: string
}

interface OnboardingStepOption {
  id: string
  label: MultilingualText
  emoji: string
  branch_id?: string // only for branch type
}

interface OnboardingStep {
  id: string
  type: 'activity' | 'branch' | 'custom'
  enabled: boolean
  order: number
  name: MultilingualText
  prompt: MultilingualText
  options: OnboardingStepOption[]
}

interface WhatsAppOnboardingConfig {
  enabled: boolean
  language: 'he' | 'fr' | 'en'
  steps: OnboardingStep[]
  welcome_message_enabled: boolean
  welcome_message: MultilingualText
}

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

interface WhatsAppClaraConfig {
  enabled: boolean
  prompt: string
  temperature: number
  model: string
  faq_enabled: boolean
  auto_resume_minutes: number
  active_branches: string[]
  schedule_enabled: boolean
  schedule: Record<string, DaySchedule>
}

type ClaraTab = 'general' | 'schedule' | 'prompt'

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

const DEFAULT_DAY_SCHEDULE: DaySchedule = { enabled: true, start: '09:00', end: '22:00' }

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = Object.fromEntries(
  DAYS_OF_WEEK.map(day => [day, { ...DEFAULT_DAY_SCHEDULE }])
)

const DEFAULT_CLARA_CONFIG: WhatsAppClaraConfig = {
  enabled: false,
  prompt: '',
  temperature: 0.7,
  model: 'gemini-2.0-flash-lite',
  faq_enabled: false,
  auto_resume_minutes: 5,
  active_branches: [],
  schedule_enabled: false,
  schedule: DEFAULT_SCHEDULE,
}

const AVAILABLE_MODELS = [
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'Google' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic' },
]

const emptyMultilingual = (): MultilingualText => ({ fr: '', en: '', he: '' })

const DEFAULT_CONFIG: WhatsAppOnboardingConfig = {
  enabled: false,
  language: 'he',
  steps: [
    {
      id: 'activity',
      type: 'activity',
      enabled: true,
      order: 0,
      name: { fr: 'Activite', en: 'Activity', he: 'פעילות' },
      prompt: { fr: 'Choisissez votre activite :', en: 'Choose your activity:', he: 'בחרו את הפעילות:' },
      options: [],
    },
    {
      id: 'branch',
      type: 'branch',
      enabled: true,
      order: 1,
      name: { fr: 'Centre', en: 'Location', he: 'סניף' },
      prompt: { fr: 'Choisissez votre centre :', en: 'Choose your location:', he: 'בחרו את הסניף:' },
      options: [],
    },
  ],
  welcome_message_enabled: true,
  welcome_message: emptyMultilingual(),
}

// Migrate old config format (activities/branches arrays) to new steps format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateConfig(saved: any): WhatsAppOnboardingConfig {
  // Already in new format
  if (saved.steps) return { ...DEFAULT_CONFIG, ...saved }

  // Migrate from old format
  const steps: OnboardingStep[] = []

  // Activity step
  steps.push({
    id: 'activity',
    type: 'activity',
    enabled: true,
    order: 0,
    name: { fr: 'Activite', en: 'Activity', he: 'פעילות' },
    prompt: saved.activity_prompt || DEFAULT_CONFIG.steps[0].prompt,
    options: (saved.activities || []).map((a: { id: string; label: MultilingualText; emoji?: string }) => ({
      id: a.id,
      label: a.label,
      emoji: a.emoji || '',
    })),
  })

  // Branch step
  steps.push({
    id: 'branch',
    type: 'branch',
    enabled: true,
    order: 1,
    name: { fr: 'Centre', en: 'Location', he: 'סניף' },
    prompt: saved.branch_prompt || DEFAULT_CONFIG.steps[1].prompt,
    options: (saved.branches || []).map((b: { branch_id: string; label: MultilingualText; emoji?: string }) => ({
      id: b.branch_id,
      label: b.label,
      emoji: b.emoji || '',
      branch_id: b.branch_id,
    })),
  })

  return {
    enabled: saved.enabled ?? false,
    language: saved.language || 'he',
    steps,
    welcome_message_enabled: saved.welcome_message_enabled ?? true,
    welcome_message: saved.welcome_message || emptyMultilingual(),
  }
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
  const [claraConfig, setClaraConfig] = useState<WhatsAppClaraConfig>(DEFAULT_CLARA_CONFIG)
  const [claraTab, setClaraTab] = useState<ClaraTab>('general')
  const [activeTab, setActiveTab] = useState<'onboarding' | 'clara'>('onboarding')
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
          setConfig(migrateConfig(saved))
        }
        const savedClara = data.data.settings?.whatsapp_clara
        if (savedClara) {
          setClaraConfig({ ...DEFAULT_CLARA_CONFIG, ...savedClara })
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
          whatsapp_clara: claraConfig,
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

  // Config updater
  const updateConfig = (partial: Partial<WhatsAppOnboardingConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }))
  }

  // ============================================================
  // Step management
  // ============================================================
  const sortedSteps = [...config.steps].sort((a, b) => a.order - b.order)

  const addStep = (type: 'activity' | 'branch' | 'custom') => {
    // Don't allow duplicate built-in types
    if (type !== 'custom' && config.steps.some(s => s.id === type)) return

    const maxOrder = config.steps.length > 0
      ? Math.max(...config.steps.map(s => s.order)) + 1
      : 0
    const id = type === 'custom' ? `custom_${Date.now()}` : type

    const newStep: OnboardingStep = {
      id,
      type,
      enabled: true,
      order: maxOrder,
      name: type === 'activity'
        ? { fr: 'Activite', en: 'Activity', he: 'פעילות' }
        : type === 'branch'
          ? { fr: 'Centre', en: 'Location', he: 'סניף' }
          : emptyMultilingual(),
      prompt: emptyMultilingual(),
      options: [],
    }
    updateConfig({ steps: [...config.steps, newStep] })
  }

  const removeStep = (stepId: string) => {
    updateConfig({ steps: config.steps.filter(s => s.id !== stepId) })
  }

  const toggleStep = (stepId: string) => {
    updateConfig({
      steps: config.steps.map(s =>
        s.id === stepId ? { ...s, enabled: !s.enabled } : s
      )
    })
  }

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const sorted = [...config.steps].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(s => s.id === stepId)
    if (direction === 'up' && idx > 0) {
      const prevOrder = sorted[idx - 1].order
      sorted[idx - 1] = { ...sorted[idx - 1], order: sorted[idx].order }
      sorted[idx] = { ...sorted[idx], order: prevOrder }
    } else if (direction === 'down' && idx < sorted.length - 1) {
      const nextOrder = sorted[idx + 1].order
      sorted[idx + 1] = { ...sorted[idx + 1], order: sorted[idx].order }
      sorted[idx] = { ...sorted[idx], order: nextOrder }
    }
    updateConfig({ steps: sorted })
  }

  const updateStep = (stepId: string, partial: Partial<OnboardingStep>) => {
    updateConfig({
      steps: config.steps.map(s => s.id === stepId ? { ...s, ...partial } : s)
    })
  }

  const updateStepPrompt = (stepId: string, loc: Locale, value: string) => {
    const step = config.steps.find(s => s.id === stepId)
    if (!step) return
    updateStep(stepId, { prompt: { ...step.prompt, [loc]: value } })
  }

  const updateStepName = (stepId: string, loc: Locale, value: string) => {
    const step = config.steps.find(s => s.id === stepId)
    if (!step) return
    updateStep(stepId, { name: { ...step.name, [loc]: value } })
  }

  // ============================================================
  // Option management
  // ============================================================
  const addOption = (stepId: string) => {
    const step = config.steps.find(s => s.id === stepId)
    if (!step || step.options.length >= 3) return
    const newOption: OnboardingStepOption = {
      id: `opt_${Date.now()}`,
      label: emptyMultilingual(),
      emoji: '',
    }
    updateStep(stepId, { options: [...step.options, newOption] })
  }

  const removeOption = (stepId: string, optionIndex: number) => {
    const step = config.steps.find(s => s.id === stepId)
    if (!step) return
    updateStep(stepId, { options: step.options.filter((_, i) => i !== optionIndex) })
  }

  const updateOption = (stepId: string, optionIndex: number, field: string, value: string) => {
    const step = config.steps.find(s => s.id === stepId)
    if (!step) return
    const updated = [...step.options]
    updated[optionIndex] = { ...updated[optionIndex], [field]: value }
    updateStep(stepId, { options: updated })
  }

  const updateOptionLabel = (stepId: string, optionIndex: number, loc: Locale, value: string) => {
    const step = config.steps.find(s => s.id === stepId)
    if (!step) return
    const updated = [...step.options]
    updated[optionIndex] = {
      ...updated[optionIndex],
      label: { ...updated[optionIndex].label, [loc]: value }
    }
    updateStep(stepId, { options: updated })
  }

  // Styling
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

  const typeBadgeColor = (type: string) => {
    if (type === 'activity') return isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
    if (type === 'branch') return isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
    return isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
  }

  const typeLabel = (type: string) => {
    if (type === 'activity') return t('whatsapp.onboarding.type_activity') || 'Activite'
    if (type === 'branch') return t('whatsapp.onboarding.type_branch') || 'Centre'
    return t('whatsapp.onboarding.type_custom') || 'Personnalise'
  }

  // Check which built-in types are already added
  const hasActivity = config.steps.some(s => s.type === 'activity')
  const hasBranch = config.steps.some(s => s.type === 'branch')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          WhatsApp
        </h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('whatsapp.subtitle') || "Configuration WhatsApp Business"}
        </p>
      </div>

      {/* Root Tabs (like Messenger) */}
      <div className="flex space-x-1 border-b" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
        {[
          { key: 'onboarding' as const, label: t('whatsapp.tabs.onboarding') || 'Onboarding' },
          { key: 'clara' as const, label: t('whatsapp.tabs.clara') || 'Clara AI' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.key
                ? isDark
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-blue-600 border-b-2 border-blue-600'
                : isDark
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB: Onboarding */}
      {/* ============================================================ */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">

      {/* Toggle global */}
      <div className="p-6 rounded-lg border" style={cardStyle}>
        <div className="flex items-center justify-between">
          <div>
            <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('whatsapp.onboarding.enabled') || "Activer l'onboarding interactif"}
            </label>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('whatsapp.onboarding.enabled_help') || "Envoie des messages interactifs aux nouveaux contacts"}
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
              {t('whatsapp.onboarding.language_help') || "Langue utilisee pour envoyer les boutons et messages"}
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
                  {loc === 'he' ? '🇮🇱 עברית' : loc === 'fr' ? '🇫🇷 Francais' : '🇬🇧 English'}
                </button>
              ))}
            </div>
          </div>

          {/* Steps title */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('whatsapp.onboarding.steps_title') || "Etapes d'onboarding"}
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('whatsapp.onboarding.steps_help') || 'Ajoutez, activez ou desactivez des etapes. Max 3 boutons par etape.'}
              </p>
            </div>
            <LanguageTabs />
          </div>

          {/* Steps list */}
          {sortedSteps.map((step, stepIndex) => (
            <div
              key={step.id}
              className={`p-6 rounded-lg border transition-opacity ${!step.enabled ? 'opacity-50' : ''}`}
              style={cardStyle}
            >
              {/* Step header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeBadgeColor(step.type)}`}>
                    {typeLabel(step.type)}
                  </span>
                  {step.type === 'custom' ? (
                    <input
                      type="text"
                      value={step.name[activeLocale]}
                      onChange={(e) => updateStepName(step.id, activeLocale, e.target.value)}
                      placeholder={t('whatsapp.onboarding.step_name') || "Nom de l'etape"}
                      className={`font-semibold bg-transparent border-b px-1 py-0.5 text-sm ${isDark ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900'}`}
                      style={{ color: isDark ? 'white' : 'black' }}
                    />
                  ) : (
                    <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {step.name[activeLocale] || step.id}
                    </h4>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Move up */}
                  <button
                    onClick={() => moveStep(step.id, 'up')}
                    disabled={stepIndex === 0}
                    className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
                      isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                    }`}
                    title={t('whatsapp.onboarding.move_up') || 'Monter'}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  {/* Move down */}
                  <button
                    onClick={() => moveStep(step.id, 'down')}
                    disabled={stepIndex === sortedSteps.length - 1}
                    className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
                      isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                    }`}
                    title={t('whatsapp.onboarding.move_down') || 'Descendre'}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {/* Enable/disable toggle */}
                  <button
                    onClick={() => toggleStep(step.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ml-2 ${
                      step.enabled ? 'bg-green-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'
                    }`}
                    title={step.enabled
                      ? (t('whatsapp.onboarding.disable_step') || 'Desactiver')
                      : (t('whatsapp.onboarding.enable_step') || 'Activer')
                    }
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      step.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`} />
                  </button>
                  {/* Delete (custom only) */}
                  {step.type === 'custom' && (
                    <button
                      onClick={() => removeStep(step.id)}
                      className="p-1.5 rounded text-red-500 hover:bg-red-500/10 transition-colors ml-1"
                      title={t('whatsapp.onboarding.delete_step') || 'Supprimer'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {step.enabled && (
                <>
                  {/* Step prompt */}
                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t('whatsapp.onboarding.step_prompt') || 'Message de la question'}
                    </label>
                    <textarea
                      rows={2}
                      value={step.prompt[activeLocale]}
                      onChange={(e) => updateStepPrompt(step.id, activeLocale, e.target.value)}
                      placeholder={t('whatsapp.onboarding.step_prompt_placeholder') || 'Ex: Quel est votre choix ?'}
                      className="w-full px-3 py-2 rounded-lg border resize-none text-sm"
                      style={inputStyle}
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t('whatsapp.onboarding.options') || 'Options'} ({step.options.length}/3)
                    </label>
                    {step.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {/* Emoji */}
                        <input
                          type="text"
                          value={opt.emoji}
                          onChange={(e) => updateOption(step.id, idx, 'emoji', e.target.value)}
                          placeholder="🎮"
                          className="w-11 px-1.5 py-2 rounded-lg border text-center text-sm"
                          style={inputStyle}
                          maxLength={2}
                        />
                        {/* Branch selector for branch type */}
                        {step.type === 'branch' ? (
                          <select
                            value={opt.branch_id || ''}
                            onChange={(e) => {
                              const updated = [...step.options]
                              updated[idx] = { ...updated[idx], branch_id: e.target.value, id: e.target.value }
                              updateStep(step.id, { options: updated })
                            }}
                            className="w-40 px-2 py-2 rounded-lg border text-sm"
                            style={inputStyle}
                          >
                            <option value="">{t('whatsapp.onboarding.select_branch') || '-- Choisir --'}</option>
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} {b.name_en ? `(${b.name_en})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={opt.id}
                            onChange={(e) => updateOption(step.id, idx, 'id', e.target.value.replace(/\s/g, '_').toLowerCase())}
                            placeholder={t('whatsapp.onboarding.option_id') || 'identifiant'}
                            className="w-32 px-2 py-2 rounded-lg border text-sm font-mono"
                            style={inputStyle}
                          />
                        )}
                        {/* Label */}
                        <input
                          type="text"
                          value={opt.label[activeLocale]}
                          onChange={(e) => updateOptionLabel(step.id, idx, activeLocale, e.target.value)}
                          placeholder={`${t('whatsapp.onboarding.button_label') || 'Nom du bouton'} (${activeLocale.toUpperCase()})`}
                          className="flex-1 px-2 py-2 rounded-lg border text-sm"
                          style={inputStyle}
                          maxLength={20}
                        />
                        <span className={`text-xs w-8 text-right ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {opt.label[activeLocale]?.length || 0}/20
                        </span>
                        <button
                          onClick={() => removeOption(step.id, idx)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {step.options.length < 3 && (
                    <button
                      onClick={() => addOption(step.id)}
                      className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t('whatsapp.onboarding.add_option') || 'Ajouter une option'}
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Add step buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => addStep('custom')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Plus className="w-4 h-4" />
              {t('whatsapp.onboarding.add_custom_step') || 'Ajouter une etape personnalisee'}
            </button>
            {!hasActivity && (
              <button
                onClick={() => addStep('activity')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  isDark ? 'border-purple-800 text-purple-400 hover:bg-purple-500/10' : 'border-purple-200 text-purple-600 hover:bg-purple-50'
                }`}
              >
                <Plus className="w-4 h-4" />
                {t('whatsapp.onboarding.type_activity') || 'Activite'}
              </button>
            )}
            {!hasBranch && (
              <button
                onClick={() => addStep('branch')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  isDark ? 'border-blue-800 text-blue-400 hover:bg-blue-500/10' : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                }`}
              >
                <Plus className="w-4 h-4" />
                {t('whatsapp.onboarding.type_branch') || 'Centre'}
              </button>
            )}
          </div>

          {/* Welcome message */}
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
                  {t('whatsapp.onboarding.welcome_message_help') || "Envoye apres la fin de l'onboarding"}
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
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      welcome_message: { ...prev.welcome_message, [activeLocale]: e.target.value }
                    }))}
                    placeholder={t('whatsapp.onboarding.welcome_placeholder') || 'Merci ! Un conseiller va vous repondre rapidement.'}
                    className="w-full px-3 py-2 rounded-lg border resize-none"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: Clara AI */}
      {/* ============================================================ */}
      {activeTab === 'clara' && (
        <div className="space-y-6">

      <div>
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Clara AI
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('whatsapp.clara.subtitle') || "Assistant IA qui repond automatiquement sur WhatsApp apres l'onboarding"}
            </p>
          </div>
        </div>

        {/* Toggle Clara */}
        <div className="p-6 rounded-lg border" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('whatsapp.clara.enabled') || "Activer Clara sur WhatsApp"}
              </label>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('whatsapp.clara.enabled_help') || "Clara repond automatiquement aux messages apres le onboarding"}
              </p>
            </div>
            <button
              onClick={() => setClaraConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                claraConfig.enabled ? 'bg-purple-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                claraConfig.enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {claraConfig.enabled && (
          <div className="space-y-4 mt-4">
            {/* Clara Tabs */}
            <div className={`flex gap-1 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
              {([
                { id: 'general' as ClaraTab, label: t('whatsapp.clara.tabs.general') || 'General', icon: Settings },
                { id: 'schedule' as ClaraTab, label: t('whatsapp.clara.tabs.schedule') || 'Horaires', icon: Clock },
                { id: 'prompt' as ClaraTab, label: t('whatsapp.clara.tabs.prompt') || 'Prompt', icon: FileText },
              ]).map((tab) => {
                const Icon = tab.icon
                const isActive = claraTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setClaraTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                      isActive
                        ? isDark
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-white text-purple-600 shadow'
                        : isDark
                          ? 'text-gray-400 hover:text-gray-300'
                          : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* ========== TAB: General ========== */}
            {claraTab === 'general' && (
              <div className="space-y-4">
                {/* Model & Temperature */}
                <div className="p-6 rounded-lg border" style={cardStyle}>
                  <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('whatsapp.clara.model_settings') || "Modele IA"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t('whatsapp.clara.model') || "Modele"}
                      </label>
                      <select
                        value={claraConfig.model}
                        onChange={(e) => setClaraConfig(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={inputStyle}
                      >
                        {AVAILABLE_MODELS.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.provider})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t('whatsapp.clara.temperature') || "Temperature"} : {claraConfig.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={claraConfig.temperature}
                        onChange={(e) => setClaraConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                        className="w-full accent-purple-600"
                      />
                      <div className={`flex justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span>{t('whatsapp.clara.precise') || "Precis"}</span>
                        <span>{t('whatsapp.clara.creative') || "Creatif"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FAQ Toggle */}
                <div className="p-6 rounded-lg border" style={cardStyle}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BookOpen className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                      <div>
                        <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {t('whatsapp.clara.faq_enabled') || "Activer la FAQ"}
                        </label>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {t('whatsapp.clara.faq_help') || "Clara utilise la meme FAQ que le Messenger pour repondre aux questions"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setClaraConfig(prev => ({ ...prev, faq_enabled: !prev.faq_enabled }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        claraConfig.faq_enabled ? 'bg-blue-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        claraConfig.faq_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Auto-resume timeout */}
                <div className="p-6 rounded-lg border" style={cardStyle}>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('whatsapp.clara.auto_resume') || "Reprise automatique"}
                      </label>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('whatsapp.clara.auto_resume_help') || "Clara reprend automatiquement apres ce delai si un admin prend la main"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={claraConfig.auto_resume_minutes}
                        onChange={(e) => setClaraConfig(prev => ({ ...prev, auto_resume_minutes: Math.max(1, Math.min(60, parseInt(e.target.value) || 5)) }))}
                        className="w-16 px-2 py-1.5 rounded-lg border text-sm text-center"
                        style={inputStyle}
                      />
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>min</span>
                    </div>
                  </div>
                </div>

                {/* Active Branches */}
                <div className="p-6 rounded-lg border" style={cardStyle}>
                  <div className="flex items-center gap-3 mb-3">
                    <Building2 className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                    <div>
                      <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('whatsapp.clara.active_branches') || "Branches actives"}
                      </label>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('whatsapp.clara.active_branches_help') || "Selectionner les branches. Vide = toutes"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {/* All branches toggle */}
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={claraConfig.active_branches.length === 0}
                        onChange={() => setClaraConfig(prev => ({ ...prev, active_branches: [] }))}
                        className="w-4 h-4 rounded accent-purple-600"
                      />
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {t('whatsapp.clara.all_branches') || "Toutes les branches"}
                      </span>
                    </label>
                    {branches.map((branch) => (
                      <label
                        key={branch.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={claraConfig.active_branches.includes(branch.id)}
                          onChange={(e) => {
                            setClaraConfig(prev => ({
                              ...prev,
                              active_branches: e.target.checked
                                ? [...prev.active_branches, branch.id]
                                : prev.active_branches.filter(id => id !== branch.id)
                            }))
                          }}
                          className="w-4 h-4 rounded accent-purple-600"
                        />
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {branch.name} {branch.name_en ? `(${branch.name_en})` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ========== TAB: Schedule ========== */}
            {claraTab === 'schedule' && (
              <div className="space-y-4">
                {/* Toggle schedule */}
                <div className="p-6 rounded-lg border" style={cardStyle}>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className={`block font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('whatsapp.clara.schedule_enabled') || "Activer les horaires"}
                      </label>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('whatsapp.clara.schedule_help') || "Definir quand Clara est active. Desactive = 24/7"}
                      </p>
                    </div>
                    <button
                      onClick={() => setClaraConfig(prev => ({ ...prev, schedule_enabled: !prev.schedule_enabled }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        claraConfig.schedule_enabled ? 'bg-purple-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        claraConfig.schedule_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {claraConfig.schedule_enabled && (
                  <div className="p-6 rounded-lg border" style={cardStyle}>
                    {/* Apply to all button */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('whatsapp.clara.schedule_title') || "Horaires par jour"}
                      </h3>
                      <button
                        onClick={() => {
                          // Copy first enabled day's schedule to all days
                          const firstEnabled = DAYS_OF_WEEK.find(d => claraConfig.schedule[d]?.enabled)
                          if (firstEnabled) {
                            const src = claraConfig.schedule[firstEnabled]
                            setClaraConfig(prev => ({
                              ...prev,
                              schedule: Object.fromEntries(
                                DAYS_OF_WEEK.map(d => [d, { ...prev.schedule[d], start: src.start, end: src.end }])
                              )
                            }))
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isDark ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {t('whatsapp.clara.apply_to_all') || "Appliquer a tous"}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const daySchedule = claraConfig.schedule[day] || DEFAULT_DAY_SCHEDULE
                        return (
                          <div
                            key={day}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-opacity ${
                              !daySchedule.enabled ? 'opacity-50' : ''
                            } ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}
                          >
                            {/* Day toggle */}
                            <button
                              onClick={() => setClaraConfig(prev => ({
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [day]: { ...daySchedule, enabled: !daySchedule.enabled }
                                }
                              }))}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                                daySchedule.enabled ? 'bg-purple-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                daySchedule.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                              }`} />
                            </button>

                            {/* Day name */}
                            <span className={`w-24 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                              {t(`whatsapp.clara.days.${day}`) || day.charAt(0).toUpperCase() + day.slice(1)}
                            </span>

                            {/* Time inputs */}
                            {daySchedule.enabled && (
                              <div className="flex items-center gap-2 flex-1">
                                <label className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {t('whatsapp.clara.schedule_start') || "Debut"}
                                </label>
                                <input
                                  type="time"
                                  value={daySchedule.start}
                                  onChange={(e) => setClaraConfig(prev => ({
                                    ...prev,
                                    schedule: {
                                      ...prev.schedule,
                                      [day]: { ...daySchedule, start: e.target.value }
                                    }
                                  }))}
                                  className="px-2 py-1 rounded border text-sm"
                                  style={inputStyle}
                                />
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</span>
                                <label className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {t('whatsapp.clara.schedule_end') || "Fin"}
                                </label>
                                <input
                                  type="time"
                                  value={daySchedule.end}
                                  onChange={(e) => setClaraConfig(prev => ({
                                    ...prev,
                                    schedule: {
                                      ...prev.schedule,
                                      [day]: { ...daySchedule, end: e.target.value }
                                    }
                                  }))}
                                  className="px-2 py-1 rounded border text-sm"
                                  style={inputStyle}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========== TAB: Prompt ========== */}
            {claraTab === 'prompt' && (
              <div className="p-6 rounded-lg border" style={cardStyle}>
                <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('whatsapp.clara.prompt_title') || "Prompt systeme"}
                </h3>
                <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('whatsapp.clara.prompt_help') || "Instructions personnalisees pour Clara sur WhatsApp. Laissez vide pour utiliser le prompt par defaut."}
                </p>
                <textarea
                  rows={12}
                  value={claraConfig.prompt}
                  onChange={(e) => setClaraConfig(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder={t('whatsapp.clara.prompt_placeholder') || "Ex: Tu es Clara, assistante d'Active Games sur WhatsApp. Tu reponds aux questions des clients et les aides a reserver..."}
                  className="w-full px-3 py-2 rounded-lg border resize-none text-sm font-mono"
                  style={inputStyle}
                />
              </div>
            )}
          </div>
        )}
      </div>

        </div>
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
