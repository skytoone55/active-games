'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react'
import type { FAQ } from '@/types/messenger'
import { FAQModal } from './FAQModal'

interface FAQSectionProps {
  isDark: boolean
}

export function FAQSection({ isDark }: FAQSectionProps) {
  const { t } = useTranslation()
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)
  const [showModal, setShowModal] = useState(false)

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
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t('messenger.faq.subtitle')}</p>
          <button
            onClick={() => { setEditingFaq(null); setShowModal(true) }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>{t('messenger.faq.add')}</span>
          </button>
        </div>

      <div className="grid gap-4">
        {faqs.map((faq) => (
          <div
            key={faq.id}
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: isDark ? '#1F2937' : 'white',
              borderColor: isDark ? '#374151' : '#E5E7EB'
            }}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-500">
                    {faq.category}
                  </span>
                  {!faq.is_active && <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-500">Inactive</span>}
                </div>
                <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {faq.question.fr}
                </h4>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {faq.answer.fr}
                </p>
              </div>
              <div className="flex space-x-2">
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
      </div>
    </div>
    </>
  )
}
