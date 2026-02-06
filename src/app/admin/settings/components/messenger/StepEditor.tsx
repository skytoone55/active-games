'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { X, Save, Loader2 } from 'lucide-react'
import type { WorkflowStep, Module } from '@/types/messenger'

interface StepEditorProps {
  workflowId: string
  step: WorkflowStep | null
  isDark: boolean
  onSave: () => void
  onCancel: () => void
}

export function StepEditor({ workflowId, step, isDark, onSave, onCancel }: StepEditorProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [modules, setModules] = useState<Module[]>([])
  const [form, setForm] = useState({
    step_ref: step?.step_ref || '',
    step_name: step?.step_name || '',
    module_ref: step?.module_ref || '',
    is_entry_point: step?.is_entry_point || false,
    order_index: step?.order_index || 0
  })

  useEffect(() => {
    loadModules()
  }, [])

  async function loadModules() {
    const res = await fetch('/api/admin/messenger/modules')
    const data = await res.json()
    if (data.success) setModules(data.data || [])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const url = step
        ? `/api/admin/messenger/workflows/${workflowId}/steps/${step.id}`
        : `/api/admin/messenger/workflows/${workflowId}/steps`
      const method = step ? 'PUT' : 'POST'

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
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
            {step ? t('messenger.workflows.edit_step') : t('messenger.workflows.add_step')}
          </h2>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-500/10">
            <X className="w-5 h-5" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Step Ref */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.workflows.step_ref')} *
            </label>
            <input
              type="text"
              value={form.step_ref}
              onChange={(e) => setForm({ ...form, step_ref: e.target.value.toUpperCase() })}
              disabled={!!step}
              placeholder="STEP_1"
              className="w-full px-3 py-2 rounded-lg border font-mono"
              style={{
                backgroundColor: isDark ? '#111827' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            />
          </div>

          {/* Step Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.workflows.step_name')} *
            </label>
            <input
              type="text"
              value={form.step_name}
              onChange={(e) => setForm({ ...form, step_name: e.target.value })}
              placeholder="Demander le prénom"
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: isDark ? '#111827' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            />
          </div>

          {/* Module */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.workflows.module')} *
            </label>
            <select
              value={form.module_ref}
              onChange={(e) => setForm({ ...form, module_ref: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: isDark ? '#111827' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            >
              <option value="">-- Sélectionner un module --</option>
              {modules.map(module => (
                <option key={module.id} value={module.ref_code}>
                  {module.ref_code} - {module.name}
                </option>
              ))}
            </select>
          </div>


          {/* Entry Point */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={form.is_entry_point}
              onChange={(e) => setForm({ ...form, is_entry_point: e.target.checked })}
              className="rounded"
            />
            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('messenger.workflows.is_entry_point')}
            </span>
          </label>
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
            {t('messenger.workflows.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.step_ref || !form.step_name || !form.module_ref}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{t('messenger.workflows.save')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
