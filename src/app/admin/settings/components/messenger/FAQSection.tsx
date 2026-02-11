'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { Plus, Edit2, Trash2, Loader2, Filter } from 'lucide-react'
import type { FAQ } from '@/types/messenger'
import { FAQModal } from './FAQModal'

const CATEGORIES = ['general', 'booking', 'pricing', 'activities', 'location', 'safety', 'events'] as const

interface FAQSectionProps {
  isDark: boolean
}

export function FAQSection({ isDark }: FAQSectionProps) {
  const { t, locale } = useTranslation()
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  useEffect(() => {
    loadFAQs()
  }, [])

  async function loadFAQs() {
    const res = await fetch('/api/admin/messenger/faq')
    const data = await res.json()
    if (data.success) setFaqs(data.data)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm(t('messenger.faq.delete') + '?')) return
    await fetch(`/api/admin/messenger/faq/${id}`, { method: 'DELETE' })
    loadFAQs()
  }

  const filteredFaqs = useMemo(() => {
    if (filterCategory === 'all') return faqs
    return faqs.filter(f => f.category === filterCategory)
  }, [faqs, filterCategory])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    faqs.forEach(f => { counts[f.category] = (counts[f.category] || 0) + 1 })
    return counts
  }, [faqs])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <>
      {showModal && (
        <FAQModal
          faq={editingFaq}
          isDark={isDark}
          onSave={() => {
            setShowModal(false)
            loadFAQs()
          }}
          onCancel={() => setShowModal(false)}
        />
      )}

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {t('messenger.faq.subtitle')} ({faqs.length})
          </p>
          <button
            onClick={() => { setEditingFaq(null); setShowModal(true) }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>{t('messenger.faq.add')}</span>
          </button>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <button
            onClick={() => setFilterCategory('all')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              filterCategory === 'all'
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('messenger.faq.filter_all') || 'Tout'} ({faqs.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat] || 0
            if (count === 0) return null
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  filterCategory === cat
                    ? 'bg-blue-600 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t(`messenger.faq.categories.${cat}`) || cat} ({count})
              </button>
            )
          })}
        </div>

        <div className="grid gap-4">
          {filteredFaqs.map((faq) => (
            <div
              key={faq.id}
              className={`p-4 rounded-lg border ${!faq.is_active ? 'opacity-50' : ''}`}
              style={{
                backgroundColor: isDark ? '#1F2937' : 'white',
                borderColor: isDark ? '#374151' : '#E5E7EB'
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-500">
                      {t(`messenger.faq.categories.${faq.category}`) || faq.category}
                    </span>
                    {!faq.is_active && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-500">
                        {t('messenger.faq.inactive') || 'Inactive'}
                      </span>
                    )}
                  </div>
                  <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {faq.question[locale] || faq.question.fr}
                  </h4>
                  <p className={`text-sm mt-1 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {faq.answer[locale] || faq.answer.fr}
                  </p>
                </div>
                <div className="flex space-x-2 ml-4 shrink-0">
                  <button
                    onClick={() => { setEditingFaq(faq); setShowModal(true) }}
                    className="p-2 rounded hover:bg-blue-500/10 text-blue-500"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(faq.id)}
                    className="p-2 rounded hover:bg-red-500/10 text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredFaqs.length === 0 && (
            <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('messenger.faq.no_results') || 'Aucune FAQ dans cette catégorie'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
