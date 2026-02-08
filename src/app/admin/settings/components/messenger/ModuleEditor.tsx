'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { X, Save, Loader2, Plus, Trash2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import type { Module, ModuleFormData, ModuleChoice, ValidationFormat } from '@/types/messenger'

interface ModuleEditorProps {
  module: Module | null
  isDark: boolean
  onSave: () => void
  onCancel: () => void
}

export function ModuleEditor({ module, isDark, onSave, onCancel }: ModuleEditorProps) {
  const { t, locale } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [activeLocale, setActiveLocale] = useState<'fr' | 'en' | 'he'>(locale as any)
  const [formats, setFormats] = useState<ValidationFormat[]>([])
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([])
  const [contentTextareaRef, setContentTextareaRef] = useState<HTMLTextAreaElement | null>(null)
  const [defaultClaraPrompt, setDefaultClaraPrompt] = useState<string>('')
  const [claraExpanded, setClaraExpanded] = useState(false)
  const [form, setForm] = useState<ModuleFormData>({
    ref_code: module?.ref_code || '',
    name: module?.name || '',
    module_type: module?.module_type || 'message_text',
    content: module?.content || { fr: '', en: '', he: '' },
    validation_format_code: module?.validation_format_code || undefined,
    custom_error_message: module?.custom_error_message || undefined,
    choices: module?.choices || [],
    llm_config: module?.llm_config || undefined,
    success_message: module?.success_message || undefined,
    failure_message: module?.failure_message || undefined,
    // Clara AI fields
    clara_enabled: module?.clara_enabled ?? false,
    clara_prompt: module?.clara_prompt || '',
    clara_model: module?.clara_model || 'gpt-4o-mini',
    clara_temperature: module?.clara_temperature ?? 0.7,
    clara_timeout_ms: module?.clara_timeout_ms ?? 5000,
    category: module?.category || 'general',
    is_active: module?.is_active ?? true
  })

  // Variables dynamiques disponibles
  const availableVariables = [
    { key: '@branch', label: t('messenger.modules.variables.branch') },
    { key: '@name', label: t('messenger.modules.variables.name') },
    { key: '@phone', label: t('messenger.modules.variables.phone') },
    { key: '@game_area', label: t('messenger.modules.variables.game_area') },
    { key: '@participants', label: t('messenger.modules.variables.participants') },
    { key: '@number_of_games', label: t('messenger.modules.variables.number_of_games') },
    { key: '@date', label: t('messenger.modules.variables.date') },
    { key: '@time', label: t('messenger.modules.variables.time') },
    { key: '@email', label: t('messenger.modules.variables.email') },
    { key: '@order', label: t('messenger.modules.variables.order') }
  ]

  // Fonction pour insérer une variable à la position du curseur
  function insertVariable(variable: string) {
    if (!contentTextareaRef) return

    const start = contentTextareaRef.selectionStart
    const end = contentTextareaRef.selectionEnd
    const text = form.content[activeLocale] || ''

    // Si c'est @order, ajouter automatiquement les parenthèses
    let insertedText = variable
    let cursorOffset = variable.length
    if (variable === '@order') {
      insertedText = '@order()'
      cursorOffset = '@order('.length // Positionner le curseur entre les parenthèses
    }

    const newText = text.substring(0, start) + insertedText + text.substring(end)

    setForm({
      ...form,
      content: {
        ...form.content,
        [activeLocale]: newText
      }
    })

    // Remettre le focus et repositionner le curseur après la variable insérée
    setTimeout(() => {
      if (contentTextareaRef) {
        contentTextareaRef.focus()
        const newPosition = start + cursorOffset
        contentTextareaRef.setSelectionRange(newPosition, newPosition)
      }
    }, 0)
  }

  useEffect(() => {
    loadFormats()
    loadWorkflows()
    loadDefaultClaraPrompt()
  }, [])

  // Si création d'un nouveau module et Clara activé pour la première fois, pré-remplir avec le prompt par défaut
  useEffect(() => {
    if (!module && form.clara_enabled && !form.clara_prompt && defaultClaraPrompt) {
      setForm(prev => ({ ...prev, clara_prompt: defaultClaraPrompt }))
    }
  }, [form.clara_enabled, defaultClaraPrompt, module])

  async function loadFormats() {
    const res = await fetch('/api/admin/messenger/validation-formats')
    const data = await res.json()
    if (data.success) setFormats(data.data)
  }

  async function loadWorkflows() {
    const res = await fetch('/api/admin/messenger/workflows')
    const data = await res.json()
    if (data.success) setWorkflows(data.data)
  }

  async function loadDefaultClaraPrompt() {
    try {
      const res = await fetch('/api/admin/messenger/clara-settings')
      const data = await res.json()
      if (data.success && data.settings?.clara_default_prompt) {
        setDefaultClaraPrompt(data.settings.clara_default_prompt)
      }
    } catch (err) {
      console.error('Failed to load default Clara prompt:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const url = module ? `/api/admin/messenger/modules/${module.id}` : '/api/admin/messenger/modules'
      const method = module ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const data = await res.json()
      if (data.success) {
        onSave()
      } else {
        alert(data.error)
      }
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  function addChoice() {
    const newChoice: ModuleChoice = {
      id: `choice_${Date.now()}`,
      label: { fr: '', en: '', he: '' }
    }
    setForm({ ...form, choices: [...(form.choices || []), newChoice] })
  }

  function updateChoice(index: number, locale: 'fr' | 'en' | 'he', value: string) {
    const choices = [...(form.choices || [])]
    choices[index].label[locale] = value
    setForm({ ...form, choices })
  }

  function deleteChoice(index: number) {
    const choices = [...(form.choices || [])]
    choices.splice(index, 1)
    setForm({ ...form, choices })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{ backgroundColor: isDark ? '#1F2937' : 'white' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between p-6 border-b"
          style={{
            backgroundColor: isDark ? '#1F2937' : 'white',
            borderColor: isDark ? '#374151' : '#E5E7EB'
          }}
        >
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {module ? t('messenger.modules.edit') : t('messenger.modules.add')}
          </h2>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-500/10">
            <X className="w-5 h-5" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Ref code */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.modules.ref_code')} *
            </label>
            <input
              type="text"
              value={form.ref_code}
              onChange={(e) => setForm({ ...form, ref_code: e.target.value.toUpperCase() })}
              disabled={!!module}
              placeholder="ASK_NAME"
              className="w-full px-3 py-2 rounded-lg border font-mono"
              style={{
                backgroundColor: isDark ? '#111827' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            />
          </div>

          {/* Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.modules.name')} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Demander le prénom"
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: isDark ? '#111827' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            />
          </div>

          {/* Type */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.modules.type')} *
            </label>
            <select
              value={form.module_type}
              onChange={(e) => setForm({ ...form, module_type: e.target.value as any })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: isDark ? '#111827' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            >
              <option value="availability_check">✅ {t('messenger.modules.types.availability_check')}</option>
              <option value="availability_suggestions">📅 {t('messenger.modules.types.availability_suggestions')}</option>
              <option value="choix_multiples">🔘 {t('messenger.modules.types.choix_multiples')}</option>
              <option value="clara_llm">🤖 {t('messenger.modules.types.clara_llm')}</option>
              <option value="collect">📝 {t('messenger.modules.types.collect')}</option>
              <option value="message_auto">⏱️ {t('messenger.modules.types.message_auto')}</option>
              <option value="message_text">💬 {t('messenger.modules.types.message_text')}</option>
              <option value="message_text_auto">⚡ {t('messenger.modules.types.message_text_auto')}</option>
              <option value="order_generation">🛒 {t('messenger.modules.types.order_generation')}</option>
            </select>
          </div>

          {/* Content multilingue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('messenger.modules.content')} *
              </label>
              <div className="flex space-x-2">
                {(['fr', 'en', 'he'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLocale(lang)}
                    className={`px-2 py-1 rounded text-xs ${
                      activeLocale === lang
                        ? 'bg-blue-500 text-white'
                        : isDark
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Boutons de variables dynamiques */}
            <div className="mb-2 flex flex-wrap gap-1">
              {availableVariables.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  onClick={() => insertVariable(variable.key)}
                  title={variable.label}
                  className="px-2 py-1 text-xs rounded border transition-colors"
                  style={{
                    backgroundColor: isDark ? '#374151' : '#F3F4F6',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? '#9CA3AF' : '#6B7280'
                  }}
                >
                  {variable.label}
                </button>
              ))}
            </div>

            <textarea
              ref={(el) => setContentTextareaRef(el)}
              value={form.content[activeLocale]}
              onChange={(e) =>
                setForm({
                  ...form,
                  content: { ...form.content, [activeLocale]: e.target.value }
                })
              }
              rows={4}
              placeholder="Bonjour ! Comment puis-je vous aider ?"
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: isDark ? '#111827' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            />
          </div>

          {/* Validation format (si collect) */}
          {form.module_type === 'collect' && (
            <>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('messenger.modules.validation_format')}
                </label>
                <select
                  value={form.validation_format_code || ''}
                  onChange={(e) => setForm({ ...form, validation_format_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: isDark ? '#111827' : 'white',
                    borderColor: isDark ? '#374151' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }}
                >
                  <option value="">-- Sélectionner --</option>
                  {formats.map((fmt) => (
                    <option key={fmt.format_code} value={fmt.format_code}>
                      {t(`messenger.formats.names.${fmt.format_name}`) || fmt.format_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message d'erreur personnalisé */}
              <div className="space-y-3 p-4 rounded-lg border" style={{ borderColor: isDark ? '#374151' : '#D1D5DB' }}>
                <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Message d'erreur personnalisé (optionnel)
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Surcharge le message d'erreur du format de validation sélectionné
                </p>

                {/* Français */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Français (FR)
                  </label>
                  <input
                    type="text"
                    value={form.custom_error_message?.fr || ''}
                    onChange={(e) => setForm({
                      ...form,
                      custom_error_message: {
                        ...form.custom_error_message,
                        fr: e.target.value,
                        en: form.custom_error_message?.en || '',
                        he: form.custom_error_message?.he || ''
                      }
                    })}
                    className="w-full px-3 py-2 rounded border"
                    style={{
                      backgroundColor: isDark ? '#111827' : 'white',
                      borderColor: isDark ? '#374151' : '#D1D5DB',
                      color: isDark ? 'white' : 'black'
                    }}
                    placeholder="Ex: Veuillez entrer une adresse email valide"
                  />
                </div>

                {/* English */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    English (EN)
                  </label>
                  <input
                    type="text"
                    value={form.custom_error_message?.en || ''}
                    onChange={(e) => setForm({
                      ...form,
                      custom_error_message: {
                        ...form.custom_error_message,
                        fr: form.custom_error_message?.fr || '',
                        en: e.target.value,
                        he: form.custom_error_message?.he || ''
                      }
                    })}
                    className="w-full px-3 py-2 rounded border"
                    style={{
                      backgroundColor: isDark ? '#111827' : 'white',
                      borderColor: isDark ? '#374151' : '#D1D5DB',
                      color: isDark ? 'white' : 'black'
                    }}
                    placeholder="Ex: Please enter a valid email address"
                  />
                </div>

                {/* Hebrew */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    עברית (HE)
                  </label>
                  <input
                    type="text"
                    value={form.custom_error_message?.he || ''}
                    onChange={(e) => setForm({
                      ...form,
                      custom_error_message: {
                        ...form.custom_error_message,
                        fr: form.custom_error_message?.fr || '',
                        en: form.custom_error_message?.en || '',
                        he: e.target.value
                      }
                    })}
                    dir="rtl"
                    className="w-full px-3 py-2 rounded border"
                    style={{
                      backgroundColor: isDark ? '#111827' : 'white',
                      borderColor: isDark ? '#374151' : '#D1D5DB',
                      color: isDark ? 'white' : 'black'
                    }}
                    placeholder="לדוגמה: אנא הזן כתובת אימייל תקינה"
                  />
                </div>
              </div>
            </>
          )}

          {/* Choices (si choix_multiples) */}
          {form.module_type === 'choix_multiples' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('messenger.modules.choices')}
                </label>
                <button
                  onClick={addChoice}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('messenger.modules.add_choice')}</span>
                </button>
              </div>
              <div className="space-y-3">
                {(form.choices || []).map((choice, index) => (
                  <div
                    key={choice.id}
                    className="p-3 rounded-lg border"
                    style={{
                      backgroundColor: isDark ? '#111827' : '#F9FAFB',
                      borderColor: isDark ? '#374151' : '#E5E7EB'
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Choix #{index + 1}
                      </span>
                      <button
                        onClick={() => deleteChoice(index)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['fr', 'en', 'he'] as const).map((lang) => (
                        <input
                          key={lang}
                          type="text"
                          value={choice.label[lang]}
                          onChange={(e) => updateChoice(index, lang, e.target.value)}
                          placeholder={`Label ${lang.toUpperCase()}`}
                          className="px-2 py-1 rounded border text-sm"
                          style={{
                            backgroundColor: isDark ? '#1F2937' : 'white',
                            borderColor: isDark ? '#374151' : '#D1D5DB',
                            color: isDark ? 'white' : 'black'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Availability Check Config */}
          {form.module_type === 'availability_check' && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                ℹ️ Ce module vérifie la disponibilité de manière silencieuse. Les messages seront affichés par les étapes suivantes configurées dans les outputs (disponible / non disponible).
              </p>
            </div>
          )}

          {/* LLM Config (si clara_llm) */}
          {form.module_type === 'clara_llm' && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  System Prompt
                </label>
                <textarea
                  value={form.llm_config?.system_prompt || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      llm_config: {
                        ...form.llm_config,
                        system_prompt: e.target.value
                      }
                    })
                  }
                  rows={4}
                  placeholder="Tu es Clara, l'assistante virtuelle d'Active Laser..."
                  className="w-full px-3 py-2 rounded-lg border font-mono text-sm"
                  style={{
                    backgroundColor: isDark ? '#111827' : 'white',
                    borderColor: isDark ? '#374151' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('messenger.modules.llm_params.temperature')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={form.llm_config?.temperature ?? 0.7}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        llm_config: {
                          ...form.llm_config,
                          temperature: parseFloat(e.target.value)
                        }
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: isDark ? '#111827' : 'white',
                      borderColor: isDark ? '#374151' : '#D1D5DB',
                      color: isDark ? 'white' : 'black'
                    }}
                  />
                  <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {t('messenger.modules.llm_params.temperature_help')}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('messenger.modules.llm_params.max_tokens')}
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="4096"
                    step="100"
                    value={form.llm_config?.max_tokens ?? 1024}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        llm_config: {
                          ...form.llm_config,
                          max_tokens: parseInt(e.target.value)
                        }
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: isDark ? '#111827' : 'white',
                      borderColor: isDark ? '#374151' : '#D1D5DB',
                      color: isDark ? 'white' : 'black'
                    }}
                  />
                  <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {t('messenger.modules.llm_params.max_tokens_help')}
                  </p>
                </div>
              </div>
              <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
                <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                  ℹ️ {t('messenger.modules.llm_params.global_model_note')}
                </p>
              </div>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={form.llm_config?.use_faq_context || false}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      llm_config: {
                        ...form.llm_config,
                        use_faq_context: e.target.checked
                      }
                    })
                  }
                  className="rounded"
                />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Utiliser le contexte FAQ
                </span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={form.llm_config?.enable_workflow_navigation || false}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      llm_config: {
                        ...form.llm_config,
                        enable_workflow_navigation: e.target.checked
                      }
                    })
                  }
                  className="rounded"
                />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Permettre à Clara de changer de workflow
                </span>
              </label>

              {form.llm_config?.enable_workflow_navigation && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Workflows disponibles pour Clara
                  </label>
                  <div className="space-y-2">
                    {workflows.map((workflow) => (
                      <label key={workflow.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={form.llm_config?.available_workflows?.includes(workflow.id) || false}
                          onChange={(e) => {
                            const currentWorkflows = form.llm_config?.available_workflows || []
                            const newWorkflows = e.target.checked
                              ? [...currentWorkflows, workflow.id]
                              : currentWorkflows.filter(id => id !== workflow.id)
                            setForm({
                              ...form,
                              llm_config: {
                                ...form.llm_config,
                                available_workflows: newWorkflows
                              }
                            })
                          }}
                          className="rounded"
                        />
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {workflow.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clara AI Integration */}
          <div className={`rounded-lg border ${isDark ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/50'}`}>
            <button
              type="button"
              onClick={() => setClaraExpanded(!claraExpanded)}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                isDark ? 'hover:bg-indigo-500/10' : 'hover:bg-indigo-100/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'
                }`}>
                  <Sparkles className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                </div>
                <div>
                  <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Clara AI (Optional)
                  </h4>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Rendre ce module flexible avec traitement naturel du langage
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={form.clara_enabled || false}
                    onChange={(e) => {
                      setForm({ ...form, clara_enabled: e.target.checked })
                      if (e.target.checked) setClaraExpanded(true)
                    }}
                    className="rounded"
                  />
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Activé
                  </span>
                </label>
                {claraExpanded ? (
                  <ChevronUp className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                ) : (
                  <ChevronDown className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                )}
              </div>
            </button>

            {claraExpanded && (
              <div className="p-4 pt-0 space-y-4">
                {/* Clara Prompt */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Prompt Clara
                  </label>
                  <textarea
                    value={form.clara_prompt || ''}
                    onChange={(e) => setForm({ ...form, clara_prompt: e.target.value })}
                    rows={6}
                    placeholder={defaultClaraPrompt || "Instructions pour Clara sur comment traiter ce module..."}
                    className={`w-full px-4 py-3 rounded-lg border font-mono text-sm ${
                      isDark
                        ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                  />
                  <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Laissez vide pour utiliser le prompt par défaut des paramètres globaux Clara
                  </p>
                </div>

                {/* Clara Model */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Modèle IA
                  </label>
                  <select
                    value={form.clara_model || 'gpt-4o-mini'}
                    onChange={(e) => setForm({ ...form, clara_model: e.target.value })}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark
                        ? 'bg-gray-900 border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                  >
                    <optgroup label="OpenAI">
                      <option value="gpt-4o">GPT-4o (Premium - Plus intelligent)</option>
                      <option value="gpt-4o-mini">GPT-4o Mini (Recommandé - Bon rapport qualité/prix)</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Économique - Rapide)</option>
                    </optgroup>
                    <optgroup label="Anthropic Claude">
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Premium)</option>
                      <option value="claude-3-haiku">Claude 3 Haiku (Économique)</option>
                    </optgroup>
                    <optgroup label="Google Gemini">
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Premium)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Économique)</option>
                    </optgroup>
                  </select>
                  <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Modèles économiques recommandés pour réponses simples : gpt-4o-mini, claude-3-haiku, gemini-1.5-flash
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Clara Temperature */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Température ({form.clara_temperature ?? 0.7})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={form.clara_temperature ?? 0.7}
                      onChange={(e) => setForm({ ...form, clara_temperature: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs mt-1">
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Précis (0)</span>
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Créatif (2)</span>
                    </div>
                  </div>

                  {/* Clara Timeout */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      max="30000"
                      step="1000"
                      value={form.clara_timeout_ms ?? 5000}
                      onChange={(e) => setForm({ ...form, clara_timeout_ms: parseInt(e.target.value) })}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark
                          ? 'bg-gray-900 border-gray-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                    />
                    <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Fallback si Clara ne répond pas
                    </p>
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${isDark ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-indigo-100 border border-indigo-200'}`}>
                  <p className={`text-sm ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
                    💡 Clara permet un traitement flexible du langage naturel tout en suivant votre workflow. Si Clara échoue ou timeout, le module bascule automatiquement en mode guidé classique.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 flex items-center justify-end space-x-3 p-6 border-t"
          style={{
            backgroundColor: isDark ? '#1F2937' : 'white',
            borderColor: isDark ? '#374151' : '#E5E7EB'
          }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg"
            style={{
              backgroundColor: isDark ? '#374151' : '#E5E7EB',
              color: isDark ? '#9CA3AF' : '#6B7280'
            }}
          >
            {t('messenger.modules.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{t('messenger.modules.save')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
