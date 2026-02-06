'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { Plus, Edit2, Trash2, Loader2, ArrowRight, Play } from 'lucide-react'
import type { Workflow, WorkflowStep, WorkflowOutput, Module } from '@/types/messenger'
import { StepEditor } from './StepEditor'
import { OutputsEditor } from './OutputsEditor'

interface WorkflowBuilderProps {
  workflow: Workflow
  isDark: boolean
  onClose: () => void
}

export function WorkflowBuilder({ workflow, isDark, onClose }: WorkflowBuilderProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [outputs, setOutputs] = useState<WorkflowOutput[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [showStepModal, setShowStepModal] = useState(false)
  const [editingOutputs, setEditingOutputs] = useState<{ step: WorkflowStep; outputs: WorkflowOutput[] } | null>(null)

  useEffect(() => {
    loadData()
  }, [workflow.id])

  async function loadData() {
    setLoading(true)
    try {
      // Charger les steps et outputs du workflow
      const workflowRes = await fetch(`/api/admin/messenger/workflows/${workflow.id}`)
      const workflowData = await workflowRes.json()

      if (workflowData.success) {
        setSteps(workflowData.data.steps || [])
        setOutputs(workflowData.data.outputs || [])
      }

      // Charger tous les modules disponibles
      const modulesRes = await fetch('/api/admin/messenger/modules')
      const modulesData = await modulesRes.json()
      if (modulesData.success) {
        setModules(modulesData.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteStep(step: WorkflowStep) {
    if (!confirm(t('messenger.workflows.confirm_delete_step'))) return

    await fetch(`/api/admin/messenger/workflows/${workflow.id}/steps/${step.id}`, {
      method: 'DELETE'
    })

    loadData()
  }

  function getModuleName(moduleRef: string) {
    const module = modules.find(m => m.ref_code === moduleRef)
    return module ? module.name : moduleRef
  }

  function getStepOutputs(stepRef: string) {
    return outputs.filter(o => o.from_step_ref === stepRef)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {workflow.name}
          </h2>
          {workflow.description && (
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {workflow.description}
            </p>
          )}
        </div>
        <button
          onClick={() => { setEditingStep(null); setShowStepModal(true) }}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>{t('messenger.workflows.add_step')}</span>
        </button>
      </div>

      {/* Steps List */}
      {steps.length === 0 ? (
        <div className={`text-center py-12 rounded-lg border-2 border-dashed ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-400'}`}>
          <p>{t('messenger.workflows.no_steps')}</p>
          <button
            onClick={() => { setEditingStep(null); setShowStepModal(true) }}
            className="mt-4 text-blue-500 hover:text-blue-600"
          >
            {t('messenger.workflows.add_first_step')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {steps.map((step, index) => {
            const stepOutputs = getStepOutputs(step.step_ref)

            return (
              <div
                key={step.id}
                className="rounded-lg border p-4"
                style={{
                  backgroundColor: isDark ? '#1F2937' : 'white',
                  borderColor: isDark ? '#374151' : '#E5E7EB'
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-500 font-mono">
                        {step.step_ref}
                      </span>
                      {step.is_entry_point && (
                        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-500 flex items-center space-x-1">
                          <Play className="w-3 h-3" />
                          <span>ENTRY POINT</span>
                        </span>
                      )}
                    </div>

                    <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {step.step_name}
                    </h4>

                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Module: {getModuleName(step.module_ref)}
                    </p>

                    {/* Outputs */}
                    {stepOutputs.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sorties:
                        </p>
                        {stepOutputs.map(output => (
                          <div
                            key={output.id}
                            className="flex items-center space-x-2 text-sm"
                          >
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span className={`font-mono text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                              {output.output_type}
                            </span>
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>→</span>
                            {output.destination_type === 'end' ? (
                              <span className="text-red-500 font-medium">FIN</span>
                            ) : (
                              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                {output.destination_ref || '?'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingOutputs({ step, outputs: stepOutputs })}
                      className="p-2 rounded hover:bg-purple-500/10 text-purple-500"
                      title="Configurer sorties"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditingStep(step); setShowStepModal(true) }}
                      className="p-2 rounded hover:bg-blue-500/10 text-blue-500"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStep(step)}
                      className="p-2 rounded hover:bg-red-500/10 text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* StepEditor Modal */}
      {showStepModal && (
        <StepEditor
          workflowId={workflow.id}
          step={editingStep}
          isDark={isDark}
          onSave={() => {
            setShowStepModal(false)
            setEditingStep(null)
            loadData()
          }}
          onCancel={() => {
            setShowStepModal(false)
            setEditingStep(null)
          }}
        />
      )}

      {/* OutputsEditor Modal */}
      {editingOutputs && (
        <OutputsEditor
          workflowId={workflow.id}
          step={editingOutputs.step}
          existingOutputs={editingOutputs.outputs}
          allSteps={steps}
          isDark={isDark}
          onSave={() => {
            setEditingOutputs(null)
            loadData()
          }}
          onCancel={() => {
            setEditingOutputs(null)
          }}
        />
      )}
    </div>
  )
}
