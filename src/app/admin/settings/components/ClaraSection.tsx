'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  Save,
  RotateCcw,
  Sparkles,
  MessageSquare,
  BookOpen,
  Sliders,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Key,
  Thermometer,
  Hash,
  Clock,
  Users,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react'

interface ClaraSectionProps {
  isDark: boolean
}

type LLMProvider = 'gemini' | 'openai' | 'anthropic'

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

interface ClaraSettings {
  enabled: boolean
  provider: LLMProvider
  model: string
  max_tokens: number
  temperature: number
  rate_limit_per_minute: number
  rate_limit_per_hour: number
  session_timeout_minutes: number
  max_conversation_messages: number
  public_chat: {
    enabled: boolean
    welcome_message: string
    quick_replies: string[]
  }
  crm_chat: {
    enabled: boolean
    features: string[]
  }
}

type Tab = 'general' | 'prompt' | 'knowledge' | 'model'

// Interface pour le modal de confirmation
interface ConfirmModalProps {
  isOpen: boolean
  isDark: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

// Composant Modal de confirmation
function ConfirmModal({
  isOpen,
  isDark,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md mx-4 rounded-xl shadow-2xl ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center gap-3 p-4 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            variant === 'danger'
              ? isDark ? 'bg-red-500/20' : 'bg-red-100'
              : isDark ? 'bg-orange-500/20' : 'bg-orange-100'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${
              variant === 'danger'
                ? isDark ? 'text-red-400' : 'text-red-600'
                : isDark ? 'text-orange-400' : 'text-orange-600'
            }`} />
          </div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          <button
            onClick={onCancel}
            className={`ml-auto p-1 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-3 p-4 border-t ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isDark
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              variant === 'danger'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClaraSection({ isDark }: ClaraSectionProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('general')

  // Data states
  const [settings, setSettings] = useState<ClaraSettings | null>(null)
  const [activePrompt, setActivePrompt] = useState<string>('') // Le prompt actuellement actif (custom ou default)
  const [activeKnowledge, setActiveKnowledge] = useState<string>('') // Le knowledge actuellement actif
  const [defaultPrompt, setDefaultPrompt] = useState<string>('')
  const [defaultKnowledge, setDefaultKnowledge] = useState<string>('')
  const [isUsingCustomPrompt, setIsUsingCustomPrompt] = useState(false)
  const [isUsingCustomKnowledge, setIsUsingCustomKnowledge] = useState(false)
  const [providers, setProviders] = useState<Record<LLMProvider, ProviderConfig>>({} as Record<LLMProvider, ProviderConfig>)
  const [apiKeys, setApiKeys] = useState<Record<LLMProvider, ApiKeyStatus>>({} as Record<LLMProvider, ApiKeyStatus>)

  // Original values for cancel/discard when switching tabs
  const [originalSettings, setOriginalSettings] = useState<ClaraSettings | null>(null)
  const [originalPrompt, setOriginalPrompt] = useState<string>('')
  const [originalKnowledge, setOriginalKnowledge] = useState<string>('')

  // Per-section saving states
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [savingKnowledge, setSavingKnowledge] = useState(false)
  const [savingModel, setSavingModel] = useState(false)

  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    variant?: 'danger' | 'warning'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  // Load settings
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/clara/settings')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }
      setSettings(data.settings)
      setDefaultPrompt(data.defaultPrompt || '')
      setDefaultKnowledge(data.defaultKnowledge || '')

      // Si un prompt personnalisé existe, l'utiliser, sinon utiliser le défaut
      const hasCustomPrompt = !!data.customPrompt
      setIsUsingCustomPrompt(hasCustomPrompt)
      setActivePrompt(hasCustomPrompt ? data.customPrompt : data.defaultPrompt || '')

      // Pareil pour le knowledge
      const hasCustomKnowledge = !!data.customKnowledge
      setIsUsingCustomKnowledge(hasCustomKnowledge)
      setActiveKnowledge(hasCustomKnowledge ? data.customKnowledge : data.defaultKnowledge || '')

      setProviders(data.providers || {})
      setApiKeys(data.apiKeys || {})

      // Store original values for cancel/discard
      setOriginalSettings(data.settings)
      setOriginalPrompt(hasCustomPrompt ? data.customPrompt : data.defaultPrompt || '')
      setOriginalKnowledge(hasCustomKnowledge ? data.customKnowledge : data.defaultKnowledge || '')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  // Save General settings only
  const saveGeneralSettings = async () => {
    try {
      setSavingGeneral(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/clara/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      if (!response.ok) throw new Error('Failed to save settings')

      setOriginalSettings(settings)
      setSuccess('Paramètres généraux sauvegardés')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSavingGeneral(false)
    }
  }

  // Save Prompt only
  const savePrompt = async () => {
    try {
      setSavingPrompt(true)
      setError(null)
      setSuccess(null)

      const promptIsCustom = activePrompt !== defaultPrompt

      const response = await fetch('/api/admin/clara/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customPrompt: promptIsCustom ? activePrompt : null,
        }),
      })

      if (!response.ok) throw new Error('Failed to save prompt')

      setOriginalPrompt(activePrompt)
      setIsUsingCustomPrompt(promptIsCustom)
      setSuccess('Prompt sauvegardé')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt')
    } finally {
      setSavingPrompt(false)
    }
  }

  // Save Knowledge only
  const saveKnowledge = async () => {
    try {
      setSavingKnowledge(true)
      setError(null)
      setSuccess(null)

      const knowledgeIsCustom = activeKnowledge !== defaultKnowledge

      const response = await fetch('/api/admin/clara/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customKnowledge: knowledgeIsCustom ? activeKnowledge : null,
        }),
      })

      if (!response.ok) throw new Error('Failed to save knowledge')

      setOriginalKnowledge(activeKnowledge)
      setIsUsingCustomKnowledge(knowledgeIsCustom)
      setSuccess('Base de connaissances sauvegardée')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save knowledge')
    } finally {
      setSavingKnowledge(false)
    }
  }

  // Save Model settings only
  const saveModelSettings = async () => {
    try {
      setSavingModel(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/clara/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      if (!response.ok) throw new Error('Failed to save settings')

      setOriginalSettings(settings)
      setSuccess('Paramètres du modèle sauvegardés')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSavingModel(false)
    }
  }

  // Check if current tab has unsaved changes
  const hasUnsavedChanges = (tab: Tab): boolean => {
    switch (tab) {
      case 'general':
        return JSON.stringify(settings) !== JSON.stringify(originalSettings)
      case 'prompt':
        return activePrompt !== originalPrompt
      case 'knowledge':
        return activeKnowledge !== originalKnowledge
      case 'model':
        return JSON.stringify(settings) !== JSON.stringify(originalSettings)
      default:
        return false
    }
  }

  // Handle tab change with discard warning
  const handleTabChange = (newTab: Tab) => {
    if (hasUnsavedChanges(activeTab)) {
      setConfirmModal({
        isOpen: true,
        title: 'Modifications non sauvegardées',
        message: 'Vous avez des modifications non sauvegardées. Voulez-vous les annuler et changer d\'onglet ?',
        confirmText: 'Annuler les modifications',
        variant: 'warning',
        onConfirm: () => {
          // Discard changes
          if (activeTab === 'general' || activeTab === 'model') {
            setSettings(originalSettings)
          } else if (activeTab === 'prompt') {
            setActivePrompt(originalPrompt)
          } else if (activeTab === 'knowledge') {
            setActiveKnowledge(originalKnowledge)
          }
          setActiveTab(newTab)
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        },
      })
      return
    }
    setActiveTab(newTab)
  }

  // Fonction interne pour exécuter le reset du prompt
  const executeResetPrompt = async () => {
    try {
      setSavingPrompt(true)
      const response = await fetch('/api/admin/clara/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPrompt: true }),
      })

      if (!response.ok) throw new Error('Failed to reset')

      setActivePrompt(defaultPrompt)
      setOriginalPrompt(defaultPrompt)
      setIsUsingCustomPrompt(false)
      setSuccess('Prompt remis par défaut')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      setError('Erreur lors de la réinitialisation')
    } finally {
      setSavingPrompt(false)
    }
  }

  const resetPrompt = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Réinitialiser le prompt',
      message: 'Êtes-vous sûr de vouloir remettre le prompt par défaut ? Votre prompt personnalisé sera définitivement supprimé.',
      confirmText: 'Réinitialiser',
      variant: 'danger',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        executeResetPrompt()
      },
    })
  }

  // Fonction interne pour exécuter le reset du knowledge
  const executeResetKnowledge = async () => {
    try {
      setSavingKnowledge(true)
      const response = await fetch('/api/admin/clara/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetKnowledge: true }),
      })

      if (!response.ok) throw new Error('Failed to reset')

      setActiveKnowledge(defaultKnowledge)
      setOriginalKnowledge(defaultKnowledge)
      setIsUsingCustomKnowledge(false)
      setSuccess('Base de connaissances remise par défaut')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      setError('Erreur lors de la réinitialisation')
    } finally {
      setSavingKnowledge(false)
    }
  }

  const resetKnowledge = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Réinitialiser la base de connaissances',
      message: 'Êtes-vous sûr de vouloir remettre la base de connaissances par défaut ? Votre version personnalisée sera définitivement supprimée.',
      confirmText: 'Réinitialiser',
      variant: 'danger',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        executeResetKnowledge()
      },
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-pink-400' : 'text-pink-600'}`} />
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof Sparkles }[] = [
    { id: 'general', label: 'Général', icon: Sparkles },
    { id: 'prompt', label: 'Prompt Système', icon: MessageSquare },
    { id: 'knowledge', label: 'Base de Connaissances', icon: BookOpen },
    { id: 'model', label: 'Modèle IA', icon: Sliders },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          isDark ? 'bg-pink-500/20' : 'bg-pink-100'
        }`}>
          <Sparkles className={`w-6 h-6 ${isDark ? 'text-pink-400' : 'text-pink-600'}`} />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Clara AI
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Assistante virtuelle du site
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

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                isActive
                  ? isDark
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'bg-white text-pink-600 shadow'
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

      {/* Tab Content */}
      <div className={`rounded-xl border p-6 ${
        isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        {/* General Tab */}
        {activeTab === 'general' && settings && (
          <div className="space-y-6">
            {/* API Keys Status */}
            <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <h4 className={`font-medium mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Key className="w-5 h-5" />
                Clés API Configurées
              </h4>
              <div className="grid gap-3">
                {Object.entries(providers).map(([providerId, provider]) => {
                  const keyStatus = apiKeys[providerId as LLMProvider]
                  const isConfigured = keyStatus?.configured
                  const isActive = settings.provider === providerId
                  return (
                    <div
                      key={providerId}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isActive
                          ? isDark ? 'bg-pink-500/10 border-pink-500/50' : 'bg-pink-50 border-pink-200'
                          : isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          isConfigured ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {provider.name}
                            {isActive && (
                              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-100 text-pink-700'
                              }`}>
                                Actif
                              </span>
                            )}
                          </p>
                          {keyStatus?.masked && (
                            <p className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {keyStatus.masked}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-sm ${
                        isConfigured
                          ? isDark ? 'text-green-400' : 'text-green-600'
                          : isDark ? 'text-red-400' : 'text-red-600'
                      }`}>
                        {isConfigured ? '✓ Configurée' : '✗ Manquante'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Les clés API se configurent dans Vercel (Settings → Environment Variables). Variables requises :<br />
                <code className="text-pink-400">GOOGLE_AI_API_KEY</code>, <code className="text-pink-400">OPENAI_API_KEY</code>, <code className="text-pink-400">ANTHROPIC_API_KEY</code>
              </p>
            </div>

            {/* Enable/Disable Clara */}
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Activer Clara
                </p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Active ou désactive le chatbot sur le site public
                </p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                className={`p-1 rounded-lg transition-colors ${
                  settings.enabled
                    ? isDark ? 'text-green-400' : 'text-green-600'
                    : isDark ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                {settings.enabled ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10" />
                )}
              </button>
            </div>

            {/* Public Chat Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Chat Public
                </p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Permet aux visiteurs de discuter avec Clara
                </p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  public_chat: { ...settings.public_chat, enabled: !settings.public_chat.enabled }
                })}
                className={`p-1 rounded-lg transition-colors ${
                  settings.public_chat.enabled
                    ? isDark ? 'text-green-400' : 'text-green-600'
                    : isDark ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                {settings.public_chat.enabled ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10" />
                )}
              </button>
            </div>

            {/* Welcome Message */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Message de bienvenue
              </label>
              <textarea
                value={settings.public_chat.welcome_message}
                onChange={(e) => setSettings({
                  ...settings,
                  public_chat: { ...settings.public_chat, welcome_message: e.target.value }
                })}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-pink-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-pink-500'
                } focus:outline-none focus:ring-2 focus:ring-pink-500/20`}
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-gray-700">
              <button
                onClick={saveGeneralSettings}
                disabled={savingGeneral || !hasUnsavedChanges('general')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark
                    ? 'bg-pink-500 text-white hover:bg-pink-600 disabled:bg-gray-700 disabled:text-gray-500'
                    : 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-200 disabled:text-gray-400'
                }`}
              >
                {savingGeneral ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Sauvegarder
              </button>
            </div>
          </div>
        )}

        {/* Prompt Tab */}
        {activeTab === 'prompt' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Prompt Système Actif
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isUsingCustomPrompt || activePrompt !== defaultPrompt
                    ? '⚡ Prompt personnalisé actif'
                    : '📝 Prompt par défaut actif'
                  }
                </p>
              </div>
              <button
                onClick={resetPrompt}
                disabled={savingPrompt || activePrompt === defaultPrompt}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  isDark
                    ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                Réinitialiser par défaut
              </button>
            </div>

            <textarea
              value={activePrompt}
              onChange={(e) => setActivePrompt(e.target.value)}
              rows={20}
              className={`w-full px-4 py-3 rounded-lg border font-mono text-sm transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-pink-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-pink-500'
              } focus:outline-none focus:ring-2 focus:ring-pink-500/20`}
            />

            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {activePrompt.length} caractères. Le prompt inclura automatiquement la base de connaissances à la fin.
            </p>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-gray-700">
              <button
                onClick={savePrompt}
                disabled={savingPrompt || !hasUnsavedChanges('prompt')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark
                    ? 'bg-pink-500 text-white hover:bg-pink-600 disabled:bg-gray-700 disabled:text-gray-500'
                    : 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-200 disabled:text-gray-400'
                }`}
              >
                {savingPrompt ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Sauvegarder
              </button>
            </div>
          </div>
        )}

        {/* Knowledge Tab */}
        {activeTab === 'knowledge' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Base de Connaissances Active
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isUsingCustomKnowledge || activeKnowledge !== defaultKnowledge
                    ? '⚡ Knowledge personnalisée active'
                    : '📚 Knowledge par défaut active'
                  }
                </p>
              </div>
              <button
                onClick={resetKnowledge}
                disabled={savingKnowledge || activeKnowledge === defaultKnowledge}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  isDark
                    ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                Réinitialiser par défaut
              </button>
            </div>

            <textarea
              value={activeKnowledge}
              onChange={(e) => setActiveKnowledge(e.target.value)}
              rows={20}
              className={`w-full px-4 py-3 rounded-lg border font-mono text-sm transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-pink-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-pink-500'
              } focus:outline-none focus:ring-2 focus:ring-pink-500/20`}
            />

            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {activeKnowledge.length} caractères. Contient les infos sur l'entreprise, tarifs, horaires, activités...
            </p>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-gray-700">
              <button
                onClick={saveKnowledge}
                disabled={savingKnowledge || !hasUnsavedChanges('knowledge')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark
                    ? 'bg-pink-500 text-white hover:bg-pink-600 disabled:bg-gray-700 disabled:text-gray-500'
                    : 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-200 disabled:text-gray-400'
                }`}
              >
                {savingKnowledge ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Sauvegarder
              </button>
            </div>
          </div>
        )}

        {/* Model Tab */}
        {activeTab === 'model' && settings && (
          <div className="space-y-6">
            {/* Provider Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Key className="w-4 h-4 inline mr-2" />
                Provider IA
              </label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(providers).map(([providerId, provider]) => {
                  const keyStatus = apiKeys[providerId as LLMProvider]
                  const isSelected = settings.provider === providerId
                  const isConfigured = keyStatus?.configured
                  return (
                    <button
                      key={providerId}
                      onClick={() => {
                        if (isConfigured) {
                          const newProvider = providerId as LLMProvider
                          const defaultModel = providers[newProvider]?.models[0]?.id || ''
                          setSettings({ ...settings, provider: newProvider, model: defaultModel })
                        }
                      }}
                      disabled={!isConfigured}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? isDark
                            ? 'border-pink-500 bg-pink-500/10'
                            : 'border-pink-500 bg-pink-50'
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
                        <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {provider.models.length} modèles
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Sparkles className="w-4 h-4 inline mr-2" />
                Modèle ({providers[settings.provider]?.name || settings.provider})
              </label>
              <select
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-pink-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-pink-500'
                } focus:outline-none focus:ring-2 focus:ring-pink-500/20`}
              >
                {providers[settings.provider]?.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Thermometer className="w-4 h-4 inline mr-2" />
                Température: {settings.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                className="w-full accent-pink-500"
              />
              <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <span>0 (Précis)</span>
                <span>1 (Créatif)</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Hash className="w-4 h-4 inline mr-2" />
                Tokens maximum (longueur réponse)
              </label>
              <input
                type="number"
                value={settings.max_tokens}
                onChange={(e) => setSettings({ ...settings, max_tokens: parseInt(e.target.value) || 4096 })}
                min={256}
                max={8192}
                className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-pink-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-pink-500'
                } focus:outline-none focus:ring-2 focus:ring-pink-500/20`}
              />
            </div>

            {/* Rate Limiting */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Clock className="w-4 h-4 inline mr-2" />
                  Limite / minute
                </label>
                <input
                  type="number"
                  value={settings.rate_limit_per_minute}
                  onChange={(e) => setSettings({ ...settings, rate_limit_per_minute: parseInt(e.target.value) || 30 })}
                  min={1}
                  max={100}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-pink-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-pink-500'
                  } focus:outline-none focus:ring-2 focus:ring-pink-500/20`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Clock className="w-4 h-4 inline mr-2" />
                  Limite / heure
                </label>
                <input
                  type="number"
                  value={settings.rate_limit_per_hour}
                  onChange={(e) => setSettings({ ...settings, rate_limit_per_hour: parseInt(e.target.value) || 200 })}
                  min={10}
                  max={1000}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-pink-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-pink-500'
                  } focus:outline-none focus:ring-2 focus:ring-pink-500/20`}
                />
              </div>
            </div>

            {/* Max Messages */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Users className="w-4 h-4 inline mr-2" />
                Messages max par conversation
              </label>
              <input
                type="number"
                value={settings.max_conversation_messages}
                onChange={(e) => setSettings({ ...settings, max_conversation_messages: parseInt(e.target.value) || 50 })}
                min={10}
                max={200}
                className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-pink-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-pink-500'
                } focus:outline-none focus:ring-2 focus:ring-pink-500/20`}
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-gray-700">
              <button
                onClick={saveModelSettings}
                disabled={savingModel || !hasUnsavedChanges('model')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark
                    ? 'bg-pink-500 text-white hover:bg-pink-600 disabled:bg-gray-700 disabled:text-gray-500'
                    : 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-200 disabled:text-gray-400'
                }`}
              >
                {savingModel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Sauvegarder
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmation */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        isDark={isDark}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
