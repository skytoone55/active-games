'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  AlertCircle,
  Edit2,
  Eye,
  XCircle,
  CheckCircle2,
  FileText
} from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { getClient } from '@/lib/supabase/client'
import type { EmailTemplate } from '@/lib/supabase/types'

interface TermsConditionsSectionProps {
  isDark: boolean
}

type TermsType = 'game' | 'event'
type TermsLanguage = 'he' | 'en' | 'fr'

interface TermsTemplate {
  type: TermsType
  language: TermsLanguage
  template: EmailTemplate | null
}

const TERMS_CODES = {
  game: {
    he: 'terms_game_he',
    en: 'terms_game_en',
    fr: 'terms_game_fr'
  },
  event: {
    he: 'terms_event_he',
    en: 'terms_event_en',
    fr: 'terms_event_fr'
  }
}

const LANGUAGE_LABELS: Record<TermsLanguage, { name: string; flag: string }> = {
  he: { name: 'Hebrew', flag: '🇮🇱' },
  en: { name: 'English', flag: '🇬🇧' },
  fr: { name: 'French', flag: '🇫🇷' }
}

export function TermsConditionsSection({ isDark }: TermsConditionsSectionProps) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedType, setSelectedType] = useState<TermsType>('game')

  // Form state
  const [formData, setFormData] = useState({
    body_template: ''
  })

  const supabase = getClient()

  const fetchTemplates = async () => {
    setLoading(true)
    setError(null)

    try {
      const allCodes = [
        ...Object.values(TERMS_CODES.game),
        ...Object.values(TERMS_CODES.event)
      ]

      const { data, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .in('code', allCodes)

      if (fetchError) throw fetchError

      setTemplates(data || [])
    } catch (err) {
      console.error('Error fetching terms templates:', err)
      setError(t('admin.settings.terms.fetch_error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const getTemplate = (type: TermsType, language: TermsLanguage): EmailTemplate | undefined => {
    const code = TERMS_CODES[type][language]
    return templates.find(t => t.code === code)
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData({
      body_template: template.body_template
    })
  }

  const handleSave = async () => {
    if (!editingTemplate) return

    setSaving(true)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('email_templates')
        .update({
          body_template: formData.body_template,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplate.id)

      if (updateError) throw updateError

      // Refresh templates
      await fetchTemplates()
      setEditingTemplate(null)
    } catch (err) {
      console.error('Error saving template:', err)
      alert(t('admin.settings.terms.save_error'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('email_templates')
        .update({
          is_active: !template.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id)

      if (updateError) throw updateError

      await fetchTemplates()
    } catch (err) {
      console.error('Error toggling template:', err)
      alert(t('admin.settings.terms.toggle_error'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-4 rounded-lg border flex items-start gap-2 ${
        isDark
          ? 'bg-red-500/10 border-red-500/50 text-red-400'
          : 'bg-red-50 border-red-200 text-red-600'
      }`}>
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    )
  }

  const languages: TermsLanguage[] = ['he', 'en', 'fr']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('admin.settings.terms.title')}
        </h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('admin.settings.terms.subtitle')}
        </p>
      </div>

      {/* Type selector tabs */}
      <div className={`flex gap-2 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <button
          onClick={() => setSelectedType('game')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedType === 'game'
              ? 'bg-orange-600 text-white'
              : isDark
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          {t('admin.settings.terms.type_game')}
        </button>
        <button
          onClick={() => setSelectedType('event')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedType === 'event'
              ? 'bg-orange-600 text-white'
              : isDark
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          {t('admin.settings.terms.type_event')}
        </button>
      </div>

      {/* Description based on type */}
      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {selectedType === 'game'
            ? t('admin.settings.terms.desc_game')
            : t('admin.settings.terms.desc_event')
          }
        </p>
      </div>

      {/* Templates by language */}
      <div className={`rounded-lg border overflow-hidden ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="divide-y divide-gray-700">
          {languages.map((lang) => {
            const template = getTemplate(selectedType, lang)
            const langInfo = LANGUAGE_LABELS[lang]

            return (
              <div
                key={lang}
                className={`p-4 flex items-center justify-between ${
                  isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                } transition-colors`}
              >
                <div className="flex items-center gap-4">
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full ${
                    template?.is_active ? 'bg-green-500' : 'bg-gray-500'
                  }`} />

                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{langInfo.flag}</span>
                    <div>
                      <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {langInfo.name}
                      </h3>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {template
                          ? template.name
                          : t('admin.settings.terms.not_configured')
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {template && (
                  <div className="flex items-center gap-2">
                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`p-2 rounded transition-colors ${
                        template.is_active
                          ? isDark
                            ? 'text-green-400 hover:bg-green-500/20'
                            : 'text-green-600 hover:bg-green-100'
                          : isDark
                            ? 'text-gray-500 hover:bg-gray-600'
                            : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={template.is_active
                        ? t('admin.settings.email_templates.deactivate')
                        : t('admin.settings.email_templates.activate')
                      }
                    >
                      {template.is_active ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </button>

                    {/* Preview */}
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className={`p-2 rounded transition-colors ${
                        isDark
                          ? 'text-gray-400 hover:bg-gray-600 hover:text-white'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                      }`}
                      title={t('admin.settings.email_templates.preview')}
                    >
                      <Eye className="w-5 h-5" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => handleEdit(template)}
                      className={`p-2 rounded transition-colors ${
                        isDark
                          ? 'text-orange-400 hover:bg-orange-500/20'
                          : 'text-orange-500 hover:bg-orange-100'
                      }`}
                      title={t('admin.settings.email_templates.edit')}
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {!template && (
                  <span className={`text-sm px-3 py-1 rounded ${
                    isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {t('admin.settings.terms.run_migration')}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Usage info */}
      <div className={`p-4 rounded-lg border ${
        isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-start gap-3">
          <FileText className={`w-5 h-5 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <div>
            <h4 className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
              {t('admin.settings.terms.usage_title')}
            </h4>
            <p className={`text-sm mt-1 ${isDark ? 'text-blue-300/70' : 'text-blue-700'}`}>
              {t('admin.settings.terms.usage_desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditingTemplate(null)}
          />
          <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl p-6 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.settings.terms.edit_title')}: {editingTemplate.name}
            </h3>

            <div className="space-y-4">
              {/* Body */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.settings.terms.content')} (HTML)
                </label>
                <textarea
                  value={formData.body_template}
                  onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
                  rows={20}
                  className={`w-full px-3 py-2 rounded-lg border font-mono text-sm ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500`}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingTemplate(null)}
                className={`px-4 py-2 rounded-lg ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('admin.common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.body_template}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('admin.common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPreviewTemplate(null)}
          />
          <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.settings.email_templates.preview')}: {previewTemplate.name}
              </h3>
              <button
                onClick={() => setPreviewTemplate(null)}
                className={`p-1 rounded hover:bg-gray-600 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="border rounded-lg overflow-hidden" style={{ height: '60vh' }}>
                <iframe
                  srcDoc={previewTemplate.body_template}
                  className="w-full h-full bg-white"
                  title="Terms preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
