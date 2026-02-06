'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Edit2, Trash2, Save, Loader2 } from 'lucide-react'
import type { ValidationFormat } from '@/types/messenger'

interface ValidationFormatsModalProps {
  isDark: boolean
  onClose: () => void
}

export function ValidationFormatsModal({ isDark, onClose }: ValidationFormatsModalProps) {
  const [formats, setFormats] = useState<ValidationFormat[]>([])
  const [loading, setLoading] = useState(true)
  const [editingFormat, setEditingFormat] = useState<ValidationFormat | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => {
    loadFormats()
  }, [])

  async function loadFormats() {
    const res = await fetch('/api/admin/messenger/validation-formats')
    const data = await res.json()
    if (data.success) setFormats(data.data || [])
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce format de validation?')) return
    await fetch(`/api/admin/messenger/validation-formats/${id}`, { method: 'DELETE' })
    loadFormats()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
        style={{ backgroundColor: isDark ? '#1F2937' : 'white' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between p-6 border-b"
          style={{
            backgroundColor: isDark ? '#1F2937' : 'white',
            borderColor: isDark ? '#374151' : '#E5E7EB'
          }}
        >
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Formats de validation
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-opacity-10"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
          >
            <X className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {showEditor ? (
            <FormatEditor
              format={editingFormat}
              isDark={isDark}
              onSave={() => {
                setShowEditor(false)
                loadFormats()
              }}
              onCancel={() => setShowEditor(false)}
            />
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Définir les règles de validation pour les modules de type "collect"
                </p>
                <button
                  onClick={() => {
                    setEditingFormat(null)
                    setShowEditor(true)
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouveau format</span>
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  {formats.map((format) => (
                    <div
                      key={format.id}
                      className="p-4 rounded-lg border"
                      style={{
                        backgroundColor: isDark ? '#111827' : '#F9FAFB',
                        borderColor: isDark ? '#374151' : '#E5E7EB'
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {format.format_name}
                            </h3>
                            <span
                              className="text-xs px-2 py-1 rounded"
                              style={{
                                backgroundColor: isDark ? '#374151' : '#E5E7EB',
                                color: isDark ? '#9CA3AF' : '#6B7280'
                              }}
                            >
                              {format.format_code}
                            </span>
                          </div>
                          {format.description && (
                            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {format.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingFormat(format)
                              setShowEditor(true)
                            }}
                            className="p-2 rounded hover:bg-opacity-10"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                          >
                            <Edit2 className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                          </button>
                          <button
                            onClick={() => handleDelete(format.id)}
                            className="p-2 rounded hover:bg-opacity-10"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                          >
                            <Trash2 className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Regex:
                          </span>
                          <code
                            className="ml-2 text-sm px-2 py-1 rounded"
                            style={{
                              backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                              color: isDark ? '#10B981' : '#059669'
                            }}
                          >
                            {format.validation_regex || 'N/A'}
                          </code>
                        </div>

                        <div>
                          <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Messages d'erreur:
                          </span>
                          <div className="mt-1 space-y-1">
                            <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              🇫🇷 {format.error_message.fr}
                            </div>
                            <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              🇬🇧 {format.error_message.en}
                            </div>
                            <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`} dir="rtl">
                              🇮🇱 {format.error_message.he}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface FormatEditorProps {
  format: ValidationFormat | null
  isDark: boolean
  onSave: () => void
  onCancel: () => void
}

function FormatEditor({ format, isDark, onSave, onCancel }: FormatEditorProps) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    format_code: format?.format_code || '',
    format_name: format?.format_name || '',
    validation_regex: format?.validation_regex || '',
    description: format?.description || '',
    error_message: format?.error_message || { fr: '', en: '', he: '' },
    is_active: format?.is_active ?? true
  })

  async function handleSave() {
    setSaving(true)
    try {
      const url = format
        ? `/api/admin/messenger/validation-formats/${format.id}`
        : '/api/admin/messenger/validation-formats'
      const method = format ? 'PUT' : 'POST'

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
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Code du format
        </label>
        <input
          type="text"
          value={form.format_code}
          onChange={(e) => setForm({ ...form, format_code: e.target.value })}
          placeholder="Ex: email, phone_fr, etc."
          disabled={!!format}
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
          Nom du format
        </label>
        <input
          type="text"
          value={form.format_name}
          onChange={(e) => setForm({ ...form, format_name: e.target.value })}
          placeholder="Ex: Email, Téléphone français"
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
          Expression régulière (Regex)
        </label>
        <input
          type="text"
          value={form.validation_regex}
          onChange={(e) => setForm({ ...form, validation_regex: e.target.value })}
          placeholder="Ex: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
          className="w-full px-3 py-2 rounded-lg border font-mono text-sm"
          style={{
            backgroundColor: isDark ? '#111827' : 'white',
            borderColor: isDark ? '#374151' : '#D1D5DB',
            color: isDark ? 'white' : 'black'
          }}
        />
        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Utilise la syntaxe JavaScript RegExp
        </p>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Description (optionnel)
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Ex: Email au format standard RFC 5322"
          className="w-full px-3 py-2 rounded-lg border"
          style={{
            backgroundColor: isDark ? '#111827' : 'white',
            borderColor: isDark ? '#374151' : '#D1D5DB',
            color: isDark ? 'white' : 'black'
          }}
        />
      </div>

      <div className="space-y-3 p-4 rounded-lg border" style={{ borderColor: isDark ? '#374151' : '#D1D5DB' }}>
        <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Messages d'erreur (multilingue)
        </div>

        {/* FR */}
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            🇫🇷 Français
          </label>
          <input
            type="text"
            value={form.error_message.fr}
            onChange={(e) => setForm({
              ...form,
              error_message: { ...form.error_message, fr: e.target.value }
            })}
            placeholder="Ex: Veuillez entrer une adresse email valide"
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: isDark ? '#111827' : 'white',
              borderColor: isDark ? '#374151' : '#D1D5DB',
              color: isDark ? 'white' : 'black'
            }}
          />
        </div>

        {/* EN */}
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            🇬🇧 English
          </label>
          <input
            type="text"
            value={form.error_message.en}
            onChange={(e) => setForm({
              ...form,
              error_message: { ...form.error_message, en: e.target.value }
            })}
            placeholder="Ex: Please enter a valid email address"
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: isDark ? '#111827' : 'white',
              borderColor: isDark ? '#374151' : '#D1D5DB',
              color: isDark ? 'white' : 'black'
            }}
          />
        </div>

        {/* HE */}
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            🇮🇱 עברית
          </label>
          <input
            type="text"
            value={form.error_message.he}
            onChange={(e) => setForm({
              ...form,
              error_message: { ...form.error_message, he: e.target.value }
            })}
            dir="rtl"
            placeholder="לדוגמה: אנא הזן כתובת אימייל תקינה"
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: isDark ? '#111827' : 'white',
              borderColor: isDark ? '#374151' : '#D1D5DB',
              color: isDark ? 'white' : 'black'
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg"
          style={{
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
            color: isDark ? '#9CA3AF' : '#6B7280'
          }}
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.format_code || !form.format_name}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Enregistrer</span>
        </button>
      </div>
    </div>
  )
}
