'use client'

import { useState } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { X, Save, Loader2 } from 'lucide-react'
import type { FAQ } from '@/types/messenger'

interface FAQModalProps {
  faq: FAQ | null
  isDark: boolean
  onSave: () => void
  onCancel: () => void
}

export function FAQModal({ faq, isDark, onSave, onCancel }: FAQModalProps) {
  const { t, locale } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [activeLocale, setActiveLocale] = useState<'fr' | 'en' | 'he'>(locale as any)
  const [form, setForm] = useState({
    category: faq?.category || 'general',
    question: faq?.question || { fr: '', en: '', he: '' },
    answer: faq?.answer || { fr: '', en: '', he: '' },
    order_index: faq?.order_index || 0,
    is_active: faq?.is_active ?? true
  })

  async function handleSave() {
    setSaving(true)
    try {
      const url = faq ? `/api/admin/messenger/faq/${faq.id}` : '/api/admin/messenger/faq'
      const method = faq ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) onSave()
      else alert(data.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{ backgroundColor: isDark ? '#1F2937' : 'white' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between p-6 border-b" style={{ backgroundColor: isDark ? '#1F2937' : 'white', borderColor: isDark ? '#374151' : '#E5E7EB' }}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {faq ? t('messenger.faq.edit') : t('messenger.faq.add')}
          </h2>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-500/10">
            <X className="w-5 h-5" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.faq.category')}
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ backgroundColor: isDark ? '#111827' : 'white', borderColor: isDark ? '#374151' : '#D1D5DB', color: isDark ? 'white' : 'black' }}
            >
              {['general', 'booking', 'pricing', 'activities', 'location', 'safety', 'events'].map((cat) => (
                <option key={cat} value={cat}>
                  {t(`messenger.faq.categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('messenger.faq.question')} *
              </label>
              <div className="flex space-x-2">
                {(['fr', 'en', 'he'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLocale(lang)}
                    className={`px-2 py-1 rounded text-xs ${activeLocale === lang ? 'bg-blue-500 text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={form.question[activeLocale]}
              onChange={(e) => setForm({ ...form, question: { ...form.question, [activeLocale]: e.target.value } })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ backgroundColor: isDark ? '#111827' : 'white', borderColor: isDark ? '#374151' : '#D1D5DB', color: isDark ? 'white' : 'black' }}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.faq.answer')} *
            </label>
            <textarea
              value={form.answer[activeLocale]}
              onChange={(e) => setForm({ ...form, answer: { ...form.answer, [activeLocale]: e.target.value } })}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ backgroundColor: isDark ? '#111827' : 'white', borderColor: isDark ? '#374151' : '#D1D5DB', color: isDark ? 'white' : 'black' }}
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end space-x-3 p-6 border-t" style={{ backgroundColor: isDark ? '#1F2937' : 'white', borderColor: isDark ? '#374151' : '#E5E7EB' }}>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg" style={{ backgroundColor: isDark ? '#374151' : '#E5E7EB', color: isDark ? '#9CA3AF' : '#6B7280' }}>
            {t('messenger.faq.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{t('messenger.faq.save')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
