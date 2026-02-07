'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { Plus, Edit2, Trash2, Loader2, Settings } from 'lucide-react'
import type { Module } from '@/types/messenger'
import { ModuleEditor } from './ModuleEditor'
import { ValidationFormatsModal } from './ValidationFormatsModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface ModulesLibraryProps {
  isDark: boolean
}

export function ModulesLibrary({ isDark }: ModulesLibraryProps) {
  const { t } = useTranslation()
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showValidationFormats, setShowValidationFormats] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ module: Module } | null>(null)

  useEffect(() => {
    loadModules()
  }, [])

  async function loadModules() {
    const res = await fetch('/api/admin/messenger/modules')
    const data = await res.json()
    if (data.success) setModules(data.data)
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await fetch(`/api/admin/messenger/modules/${confirmDelete.module.id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    loadModules()
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'message_text': return '💬'
      case 'collect': return '📝'
      case 'choix_multiples': return '🔘'
      case 'clara_llm': return '🤖'
      case 'availability_check': return '✅'
      case 'availability_suggestions': return '📅'
      default: return '📄'
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <>
      {showEditor && (
        <ModuleEditor
          module={editingModule}
          isDark={isDark}
          onSave={() => {
            setShowEditor(false)
            loadModules()
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {showValidationFormats && (
        <ValidationFormatsModal
          isDark={isDark}
          onClose={() => setShowValidationFormats(false)}
        />
      )}

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t('messenger.modules.subtitle')}</p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowValidationFormats(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-opacity-90"
              style={{
                backgroundColor: isDark ? '#374151' : '#E5E7EB',
                color: isDark ? '#9CA3AF' : '#6B7280'
              }}
            >
              <Settings className="w-4 h-4" />
              <span>Formats de validation</span>
            </button>
            <button
              onClick={() => {
                setEditingModule(null)
                setShowEditor(true)
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>{t('messenger.modules.add')}</span>
            </button>
          </div>
        </div>

      <div className="grid gap-4">
        {modules.map((module) => (
          <div
            key={module.id}
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: isDark ? '#1F2937' : 'white',
              borderColor: isDark ? '#374151' : '#E5E7EB'
            }}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">{getTypeIcon(module.module_type)}</span>
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-500 font-mono">
                    {module.ref_code}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-500">
                    {t(`messenger.modules.types.${module.module_type}`)}
                  </span>
                </div>
                <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {module.name}
                </h4>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {module.content.fr}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingModule(module)
                    setShowEditor(true)
                  }}
                  className="p-2 rounded hover:bg-blue-500/10 text-blue-500"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete({ module })}
                  className="p-2 rounded hover:bg-red-500/10 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={t('messenger.modules.delete')}
        message={`Voulez-vous vraiment supprimer le module "${confirmDelete?.module.name}" (${confirmDelete?.module.ref_code}) ? Cette action est irréversible.`}
        confirmLabel={t('messenger.modules.delete')}
        cancelLabel={t('messenger.workflows.cancel')}
        isDark={isDark}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
    </>
  )
}
