'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react'
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
  const [form, setForm] = useState<ModuleFormData>({
    ref_code: module?.ref_code || '',
    name: module?.name || '',
    module_type: module?.module_type || 'message_text',
    content: module?.content || { fr: '', en: '', he: '' },
    validation_format_code: module?.validation_format_code || undefined,
    custom_error_message: module?.custom_error_message || undefined,
    choices: module?.choices || [],
    llm_config: module?.llm_config || undefined,
    category: module?.category || 'general',
    is_active: module?.is_active ?? true
  })

  useEffect(() => {
    loadFormats()
  }, [])

  async function loadFormats() {
    const res = await fetch('/api/admin/messenger/validation-formats')
    const data = await res.json()
    if (data.success) setFormats(data.data)
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
              <option value="message_text">💬 {t('messenger.modules.types.message_text')}</option>
              <option value="collect">📝 {t('messenger.modules.types.collect')}</option>
              <option value="choix_multiples">🔘 {t('messenger.modules.types.choix_multiples')}</option>
              <option value="clara_llm">🤖 {t('messenger.modules.types.clara_llm')}</option>
              <option value="availability_check">✅ Vérification disponibilité</option>
              <option value="availability_suggestions">📅 Suggestions alternatives</option>
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
            <textarea
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
                      {fmt.format_name}
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
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Message de succès (disponible)
                </label>
                <textarea
                  value={form.success_message?.[activeLocale] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      success_message: {
                        ...form.success_message,
                        [activeLocale]: e.target.value
                      }
                    })
                  }
                  rows={2}
                  placeholder="Parfait ! Ce créneau est disponible."
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: isDark ? '#111827' : 'white',
                    borderColor: isDark ? '#374151' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Message d'échec (non disponible)
                </label>
                <textarea
                  value={form.failure_message?.[activeLocale] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      failure_message: {
                        ...form.failure_message,
                        [activeLocale]: e.target.value
                      }
                    })
                  }
                  rows={2}
                  placeholder="Désolé, ce créneau n'est pas disponible."
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: isDark ? '#111827' : 'white',
                    borderColor: isDark ? '#374151' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Branch Slug
                </label>
                <input
                  type="text"
                  value={form.metadata?.branch_slug || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      metadata: {
                        ...form.metadata,
                        branch_slug: e.target.value
                      }
                    })
                  }
                  placeholder="tel-aviv"
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: isDark ? '#111827' : 'white',
                    borderColor: isDark ? '#374151' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }}
                />
              </div>
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
            </div>
          )}
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
