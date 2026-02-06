'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import type { WorkflowStep, WorkflowOutput, Module, ModuleChoice } from '@/types/messenger'

interface OutputsEditorProps {
  workflowId: string
  step: WorkflowStep
  existingOutputs: WorkflowOutput[]
  allSteps: WorkflowStep[]
  isDark: boolean
  onSave: () => void
  onCancel: () => void
}

export function OutputsEditor({
  workflowId,
  step,
  existingOutputs,
  allSteps,
  isDark,
  onSave,
  onCancel
}: OutputsEditorProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [module, setModule] = useState<Module | null>(null)
  const [outputs, setOutputs] = useState<WorkflowOutput[]>(existingOutputs)
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    loadWorkflows()
  }, [])

  useEffect(() => {
    loadModule()
  }, [step.module_ref])

  async function loadWorkflows() {
    const res = await fetch('/api/admin/messenger/workflows')
    const data = await res.json()
    if (data.success) {
      setWorkflows(data.data || [])
    }
  }

  async function loadModule() {
    const res = await fetch('/api/admin/messenger/modules')
    const data = await res.json()
    if (data.success) {
      const found = data.data.find((m: Module) => m.ref_code === step.module_ref)
      setModule(found || null)

      // Si pas d'outputs existants, créer la structure par défaut basée sur le module
      if (existingOutputs.length === 0 && found) {
        const defaultOutputs: WorkflowOutput[] = []

        if (found.module_type === 'message_text' || found.module_type === 'collect') {
          // Une seule sortie "success"
          defaultOutputs.push({
            id: '',
            workflow_id: workflowId,
            from_step_ref: step.step_ref,
            output_type: 'success',
            output_label: null,
            destination_type: 'end',
            destination_ref: null,
            priority: 0,
            created_at: ''
          })
        } else if (found.module_type === 'choix_multiples' && found.choices) {
          // Une sortie par choix
          found.choices.forEach((choice: ModuleChoice, index: number) => {
            defaultOutputs.push({
              id: '',
              workflow_id: workflowId,
              from_step_ref: step.step_ref,
              output_type: `choice_${choice.id}`,
              output_label: choice.label.fr || choice.label.en || choice.label.he || '',
              destination_type: 'end',
              destination_ref: null,
              priority: index,
              created_at: ''
            })
          })
        } else if (found.module_type === 'clara_llm') {
          // Clara décide, mais on peut définir des destinations par défaut
          defaultOutputs.push({
            id: '',
            workflow_id: workflowId,
            from_step_ref: step.step_ref,
            output_type: 'clara_default',
            output_label: 'Par défaut',
            destination_type: 'end',
            destination_ref: null,
            priority: 0,
            created_at: ''
          })
        }

        setOutputs(defaultOutputs)
      }
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/messenger/workflows/${workflowId}/outputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_step_ref: step.step_ref,
          outputs: outputs.map((output, index) => ({
            output_type: output.output_type,
            output_label: output.output_label,
            destination_type: output.destination_type,
            destination_ref: output.destination_ref,
            priority: index
          }))
        })
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

  function updateOutput(index: number, field: keyof WorkflowOutput, value: any) {
    const updated = [...outputs]
    updated[index] = { ...updated[index], [field]: value }
    setOutputs(updated)
  }

  function addOutput() {
    setOutputs([
      ...outputs,
      {
        id: '',
        workflow_id: workflowId,
        from_step_ref: step.step_ref,
        output_type: 'custom',
        output_label: '',
        destination_type: 'end',
        destination_ref: null,
        priority: outputs.length,
        created_at: ''
      }
    ])
  }

  function deleteOutput(index: number) {
    setOutputs(outputs.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
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
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('messenger.workflows.configure_outputs')}
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {step.step_name} ({step.step_ref})
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-500/10">
            <X className="w-5 h-5" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Info sur le type de module */}
          {module && (
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: isDark ? '#111827' : '#F9FAFB',
                borderColor: isDark ? '#374151' : '#E5E7EB'
              }}
            >
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>{t('messenger.workflows.module_type')}:</strong> {module.module_type}
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {module.module_type === 'message_text' && 'Message simple → 1 sortie "success"'}
                {module.module_type === 'collect' && 'Collecte d\'info → 1 sortie "success" après validation'}
                {module.module_type === 'choix_multiples' && 'Choix multiples → 1 sortie par choix'}
                {module.module_type === 'clara_llm' && 'Clara LLM → Sorties définies par l\'IA'}
              </p>
            </div>
          )}

          {/* Liste des outputs */}
          <div className="space-y-3">
            {outputs.map((output, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: isDark ? '#111827' : 'white',
                  borderColor: isDark ? '#374151' : '#D1D5DB'
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Type de sortie
                    </label>
                    <input
                      type="text"
                      value={output.output_type}
                      onChange={(e) => updateOutput(index, 'output_type', e.target.value)}
                      disabled={module?.module_type === 'choix_multiples'}
                      className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                      style={{
                        backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
                        borderColor: isDark ? '#374151' : '#D1D5DB',
                        color: isDark ? 'white' : 'black'
                      }}
                    />
                  </div>
                  {module?.module_type !== 'message_text' && module?.module_type !== 'collect' && (
                    <button
                      onClick={() => deleteOutput(index)}
                      className="ml-3 p-2 rounded-lg hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>

                {output.output_label && (
                  <div className="mb-3">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Label (affiché à l'utilisateur)
                    </label>
                    <input
                      type="text"
                      value={output.output_label}
                      readOnly
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
                        borderColor: isDark ? '#374151' : '#D1D5DB',
                        color: isDark ? '#9CA3AF' : '#6B7280'
                      }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Type de destination
                    </label>
                    <select
                      value={output.destination_type}
                      onChange={(e) => {
                        updateOutput(index, 'destination_type', e.target.value)
                        if (e.target.value === 'end') {
                          updateOutput(index, 'destination_ref', null)
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: isDark ? '#1F2937' : 'white',
                        borderColor: isDark ? '#374151' : '#D1D5DB',
                        color: isDark ? 'white' : 'black'
                      }}
                    >
                      <option value="step">Aller à une step</option>
                      <option value="workflow">Aller à un workflow</option>
                      <option value="end">Fin de conversation</option>
                    </select>
                  </div>

                  {output.destination_type === 'step' && (
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Step de destination
                      </label>
                      <select
                        value={output.destination_ref || ''}
                        onChange={(e) => updateOutput(index, 'destination_ref', e.target.value || null)}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{
                          backgroundColor: isDark ? '#1F2937' : 'white',
                          borderColor: isDark ? '#374151' : '#D1D5DB',
                          color: isDark ? 'white' : 'black'
                        }}
                      >
                        <option value="">-- Choisir une step --</option>
                        {allSteps
                          .filter((s) => s.step_ref !== step.step_ref)
                          .map((s) => (
                            <option key={s.id} value={s.step_ref}>
                              {s.step_ref} - {s.step_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {output.destination_type === 'workflow' && (
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Workflow de destination
                      </label>
                      <select
                        value={output.destination_ref || ''}
                        onChange={(e) => updateOutput(index, 'destination_ref', e.target.value || null)}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{
                          backgroundColor: isDark ? '#1F2937' : 'white',
                          borderColor: isDark ? '#374151' : '#D1D5DB',
                          color: isDark ? 'white' : 'black'
                        }}
                      >
                        <option value="">-- Choisir un workflow --</option>
                        {workflows
                          .filter((w) => w.id !== workflowId)
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bouton ajouter output (seulement pour clara_llm ou custom) */}
          {module?.module_type === 'clara_llm' && (
            <button
              onClick={addOutput}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 border-dashed hover:bg-gray-500/5"
              style={{
                borderColor: isDark ? '#374151' : '#D1D5DB',
                color: isDark ? '#9CA3AF' : '#6B7280'
              }}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Ajouter une sortie</span>
            </button>
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
            {t('messenger.workflows.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
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
