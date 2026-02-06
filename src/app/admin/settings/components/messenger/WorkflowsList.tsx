'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { Plus, Edit2, Trash2, Loader2, X, Save, ArrowLeft } from 'lucide-react'
import type { Workflow } from '@/types/messenger'
import { WorkflowBuilder } from './WorkflowBuilder'

interface WorkflowsListProps {
  isDark: boolean
}

export function WorkflowsList({ isDark }: WorkflowsListProps) {
  const { t } = useTranslation()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [editingWorkflow, setEditingWorkflow] = useState<{ id: string; name: string } | null>(null)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)

  useEffect(() => {
    loadWorkflows()
  }, [])

  async function loadWorkflows() {
    const res = await fetch('/api/admin/messenger/workflows')
    const data = await res.json()
    if (data.success) {
      const sorted = data.data.sort((a: Workflow, b: Workflow) => a.name.localeCompare(b.name))
      setWorkflows(sorted)
      const active = sorted.find((w: Workflow) => w.is_active)
      setActiveWorkflowId(active?.id || null)
    }
    setLoading(false)
  }

  async function handleSetMainWorkflow(id: string) {
    // Désactiver tous les workflows
    await Promise.all(
      workflows.map(w =>
        fetch(`/api/admin/messenger/workflows/${w.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false })
        })
      )
    )

    // Activer le workflow sélectionné
    await fetch(`/api/admin/messenger/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true })
    })

    loadWorkflows()
  }

  async function handleRename(id: string, newName: string) {
    await fetch(`/api/admin/messenger/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    })
    setEditingWorkflow(null)
    loadWorkflows()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('messenger.workflows.delete') + '?')) return
    await fetch(`/api/admin/messenger/workflows/${id}`, { method: 'DELETE' })
    loadWorkflows()
  }

  async function handleCreate() {
    if (!createForm.name.trim()) {
      alert('Le nom est requis')
      return
    }

    const res = await fetch('/api/admin/messenger/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...createForm, is_active: false })
    })

    const data = await res.json()
    if (data.success) {
      setShowCreateModal(false)
      setCreateForm({ name: '', description: '' })
      loadWorkflows()
    } else {
      alert(data.error || 'Erreur lors de la création')
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>

  // Si un workflow est sélectionné, afficher le WorkflowBuilder en pleine page
  if (selectedWorkflow) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setSelectedWorkflow(null)
            loadWorkflows()
          }}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-500/10"
          style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('messenger.workflows.back_to_list')}</span>
        </button>
        <WorkflowBuilder
          workflow={selectedWorkflow}
          isDark={isDark}
          onClose={() => {
            setSelectedWorkflow(null)
            loadWorkflows()
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t('messenger.workflows.subtitle')}</p>
          <div className="flex items-center space-x-2">
            <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Workflow principal:
            </label>
            <select
              value={activeWorkflowId || ''}
              onChange={(e) => handleSetMainWorkflow(e.target.value)}
              className="px-3 py-1 rounded-lg border text-sm"
              style={{
                backgroundColor: isDark ? '#1F2937' : 'white',
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? 'white' : 'black'
              }}
            >
              <option value="">-- Aucun --</option>
              {workflows.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>{t('messenger.workflows.add')}</span>
        </button>
      </div>

      <div className="grid gap-4">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className="p-4 rounded-lg border cursor-pointer hover:shadow-lg transition-shadow"
            style={{
              backgroundColor: isDark ? '#1F2937' : 'white',
              borderColor: workflow.is_active ? '#3B82F6' : (isDark ? '#374151' : '#E5E7EB')
            }}
            onClick={() => setSelectedWorkflow(workflow)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {workflow.is_active && (
                    <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-500 font-bold">
                      PRINCIPAL
                    </span>
                  )}
                </div>
                {editingWorkflow?.id === workflow.id ? (
                  <input
                    type="text"
                    value={editingWorkflow.name}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                    onBlur={() => handleRename(workflow.id, editingWorkflow.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(workflow.id, editingWorkflow.name)
                      if (e.key === 'Escape') setEditingWorkflow(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="font-medium px-2 py-1 rounded border"
                    style={{
                      backgroundColor: isDark ? '#111827' : 'white',
                      borderColor: isDark ? '#374151' : '#D1D5DB',
                      color: isDark ? 'white' : 'black'
                    }}
                  />
                ) : (
                  <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {workflow.name}
                  </h4>
                )}
                {workflow.description && (
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {workflow.description}
                  </p>
                )}
              </div>
              <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setEditingWorkflow({ id: workflow.id, name: workflow.name })}
                  className="p-2 rounded hover:bg-blue-500/10 text-blue-500"
                  title="Renommer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(workflow.id)}
                  className="p-2 rounded hover:bg-red-500/10 text-red-500"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div
            className="max-w-lg w-full rounded-xl shadow-2xl p-6"
            style={{ backgroundColor: isDark ? '#1F2937' : 'white' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('messenger.workflows.add')}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-gray-500/10">
                <X className="w-5 h-5" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('messenger.workflows.name')}
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Ex: Prise de rendez-vous"
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
                  {t('messenger.workflows.description')}
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Description optionnelle"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: isDark ? '#111827' : 'white',
                    borderColor: isDark ? '#374151' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }}
                />
              </div>

            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: isDark ? '#374151' : '#E5E7EB',
                  color: isDark ? '#9CA3AF' : '#6B7280'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                <span>Créer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
