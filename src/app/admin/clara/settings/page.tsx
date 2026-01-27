'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Key, MessageSquare, Link2, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/contexts/LanguageContext'

interface ClaraSettings {
  anthropic_api_key: string
  system_prompt: string
  model: string
  max_tokens: number
  connectors: {
    supabase: boolean
    github: boolean
    vercel: boolean
  }
}

export default function ClaraSettingsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<ClaraSettings>({
    anthropic_api_key: '',
    system_prompt: `Tu es Clara, l'assistante IA virtuelle pour ActiveLaser.

Tu peux:
- Analyser les données de l'entreprise (commandes, clients, revenus)
- Effectuer des actions administratives (fermer commandes, corriger statuts, etc.)
- Aider les utilisateurs à comprendre le logiciel
- Répondre aux questions en français de manière professionnelle

Sois proactive: si tu détectes des problèmes dans les données, mentionne-les.`,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    connectors: {
      supabase: true,
      github: false,
      vercel: false
    }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load settings from API/localStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // For now, load from localStorage (in production, this would be from API)
        const saved = localStorage.getItem('clara_settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          setSettings(prev => ({ ...prev, ...parsed }))
        }
      } catch (error) {
        console.error('Error loading Clara settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Save settings
  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // Save to localStorage (in production, would save to API/database)
      localStorage.setItem('clara_settings', JSON.stringify(settings))

      // Also update environment variable via API (if needed)
      // For security, the API key should be stored server-side
      // This is a simplified version for demo purposes

      setMessage({ type: 'success', text: t('admin.clara.settings.save_success') })
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: t('admin.clara.settings.save_error') })
    } finally {
      setSaving(false)
    }
  }

  // Test API connection
  const handleTestConnection = async () => {
    setTestResult(null)

    if (!settings.anthropic_api_key) {
      setTestResult({ success: false, message: t('admin.clara.settings.api_key.required') })
      return
    }

    try {
      const response = await fetch('/api/admin/statistics/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'Dis simplement "Connexion réussie!" en une phrase.',
          dateRange: 'today'
        })
      })

      const data = await response.json()

      if (data.success && data.answer) {
        setTestResult({ success: true, message: t('admin.clara.settings.api_key.success') })
      } else {
        setTestResult({ success: false, message: data.error || t('admin.clara.settings.api_key.error') })
      }
    } catch (error) {
      console.error('Test error:', error)
      setTestResult({ success: false, message: t('admin.clara.settings.api_key.error') })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-100">
      {/* Header */}
      <header className="bg-dark-200 border-b border-primary/20 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/orders"
              className="p-2 hover:bg-dark-300 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-purple-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{t('admin.clara.settings.title')}</h1>
                <p className="text-sm text-gray-400">{t('admin.clara.settings.subtitle')}</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-purple-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('admin.clara.settings.save')}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Message */}
        {message && (
          <div className={`flex items-center gap-3 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/20 border border-green-500/30 text-green-400'
              : 'bg-red-900/20 border border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* API Key Section */}
        <section className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-white">{t('admin.clara.settings.api_key.section_title')}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('admin.clara.settings.api_key.label')}
              </label>
              <input
                type="password"
                value={settings.anthropic_api_key}
                onChange={(e) => setSettings(prev => ({ ...prev, anthropic_api_key: e.target.value }))}
                placeholder="sk-ant-api03-..."
                className="w-full bg-dark-300 border border-primary/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-gray-500 mt-2">
                {t('admin.clara.settings.api_key.help_text')} <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.anthropic.com</a>
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleTestConnection}
                className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors"
              >
                {t('admin.clara.settings.api_key.test_button')}
              </button>

              {testResult && (
                <div className={`flex items-center gap-2 text-sm ${
                  testResult.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* System Prompt Section */}
        <section className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-white">{t('admin.clara.settings.system_prompt.section_title')}</h2>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {t('admin.clara.settings.system_prompt.label')}
            </label>
            <textarea
              value={settings.system_prompt}
              onChange={(e) => setSettings(prev => ({ ...prev, system_prompt: e.target.value }))}
              rows={10}
              className="w-full bg-dark-300 border border-primary/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-y"
            />
            <p className="text-xs text-gray-500 mt-2">
              {t('admin.clara.settings.system_prompt.help_text')}
            </p>
          </div>
        </section>

        {/* Model Settings */}
        <section className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-white">{t('admin.clara.settings.model.section_title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('admin.clara.settings.model.label')}
              </label>
              <select
                value={settings.model}
                onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                className="w-full bg-dark-300 border border-primary/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
              >
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommandé)</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku (Rapide)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('admin.clara.settings.model.max_tokens')}
              </label>
              <input
                type="number"
                value={settings.max_tokens}
                onChange={(e) => setSettings(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 2048 }))}
                min={256}
                max={8192}
                className="w-full bg-dark-300 border border-primary/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </section>

        {/* Connectors Section */}
        <section className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Link2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-white">{t('admin.clara.settings.connectors.section_title')}</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-dark-300/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                  <span className="text-lg">🗄️</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">Supabase</h3>
                  <p className="text-sm text-gray-400">Base de données & Auth</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs ${
                settings.connectors.supabase
                  ? 'bg-green-600/20 text-green-400'
                  : 'bg-gray-600/20 text-gray-400'
              }`}>
                {settings.connectors.supabase ? t('admin.clara.settings.connectors.connected') : t('admin.clara.settings.connectors.not_connected')}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-300/50 rounded-lg opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-600/20 flex items-center justify-center">
                  <span className="text-lg">🐙</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">GitHub</h3>
                  <p className="text-sm text-gray-400">{t('admin.clara.settings.connectors.github_subtitle')}</p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full text-xs bg-gray-600/20 text-gray-400">
                {t('admin.clara.settings.connectors.coming_soon')}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-300/50 rounded-lg opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-600/20 flex items-center justify-center">
                  <span className="text-lg">▲</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">Vercel</h3>
                  <p className="text-sm text-gray-400">{t('admin.clara.settings.connectors.vercel_subtitle')}</p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full text-xs bg-gray-600/20 text-gray-400">
                {t('admin.clara.settings.connectors.coming_soon')}
              </div>
            </div>
          </div>
        </section>

        {/* Info */}
        <div className="text-center text-gray-500 text-sm">
          <p>{t('admin.clara.settings.info.line1')}</p>
          <p>{t('admin.clara.settings.info.line2')}</p>
        </div>
      </main>
    </div>
  )
}
