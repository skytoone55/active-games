'use client'

import { useState } from 'react'
import {
  Loader2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Zap,
  ZapOff,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useEmailAutomations, type EmailAutomation } from '@/hooks/useEmailAutomations'

interface EmailAutomationsSectionProps {
  isDark: boolean
}

// Labels lisibles pour les événements trigger
const TRIGGER_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  booking_confirmed: {
    label: 'Réservation confirmée',
    description: 'Quand une réservation est confirmée dans le système',
    icon: '📋',
  },
  cgv_pending: {
    label: 'CGV en attente',
    description: 'Quand les CGV d\'une commande admin n\'ont pas été validées',
    icon: '📜',
  },
  order_created: {
    label: 'Commande créée',
    description: 'Quand une nouvelle commande est créée',
    icon: '🛒',
  },
  payment_received: {
    label: 'Paiement reçu',
    description: 'Quand un paiement est confirmé',
    icon: '💳',
  },
  booking_reminder: {
    label: 'Rappel de réservation',
    description: 'Rappel avant la date de la réservation',
    icon: '⏰',
  },
  post_visit: {
    label: 'Après la visite',
    description: 'Email envoyé après la date de la réservation',
    icon: '🌟',
  },
}

// Tous les triggers disponibles (pour le dropdown de création)
const AVAILABLE_TRIGGERS = Object.entries(TRIGGER_LABELS).map(([value, info]) => ({
  value,
  ...info,
}))

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immédiat'
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${m}m` : `${h}h`
  }
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  return h > 0 ? `${d}j ${h}h` : `${d}j`
}

export function EmailAutomationsSection({ isDark }: EmailAutomationsSectionProps) {
  const { automations, loading, error, createAutomation, updateAutomation, deleteAutomation, toggleAutomation } = useEmailAutomations()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_event: 'booking_confirmed',
    template_code: '',
    delay_minutes: 0,
    enabled: true,
    max_sends: '' as string | number,
  })

  const handleStartEdit = (automation: EmailAutomation) => {
    setEditingId(automation.id)
    setFormData({
      name: automation.name,
      description: automation.description || '',
      trigger_event: automation.trigger_event,
      template_code: automation.template_code,
      delay_minutes: automation.delay_minutes,
      enabled: automation.enabled,
      max_sends: automation.max_sends ?? '',
    })
    setExpandedId(automation.id)
  }

  const handleStartCreate = () => {
    setFormData({
      name: '',
      description: '',
      trigger_event: 'booking_confirmed',
      template_code: '',
      delay_minutes: 0,
      enabled: true,
      max_sends: '',
    })
    setShowCreate(true)
    setEditingId(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        name: formData.name,
        description: formData.description || null,
        trigger_event: formData.trigger_event,
        template_code: formData.template_code,
        delay_minutes: formData.delay_minutes,
        enabled: formData.enabled,
        max_sends: formData.max_sends === '' ? null : Number(formData.max_sends),
      }

      if (editingId) {
        const result = await updateAutomation(editingId, data as Partial<EmailAutomation>)
        if (!result.success) {
          alert(result.error || 'Erreur')
          return
        }
        setEditingId(null)
      } else {
        const result = await createAutomation(data as Partial<EmailAutomation>)
        if (!result.success) {
          alert(result.error || 'Erreur')
          return
        }
        setShowCreate(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Supprimer l'automatisation "${name}" ?`)) {
      const result = await deleteAutomation(id)
      if (!result.success) {
        alert(result.error || 'Erreur')
      }
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleAutomation(id, enabled)
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
        isDark ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
      }`}>
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    )
  }

  // Grouper par trigger_event
  const grouped: Record<string, EmailAutomation[]> = {}
  automations.forEach(a => {
    if (!grouped[a.trigger_event]) grouped[a.trigger_event] = []
    grouped[a.trigger_event].push(a)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Automatisations
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Configurez quand et quels emails sont envoyés automatiquement.
          </p>
        </div>

        <button
          onClick={handleStartCreate}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle automatisation
        </button>
      </div>

      {/* Formulaire de création */}
      {showCreate && (
        <AutomationForm
          isDark={isDark}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          onCancel={() => setShowCreate(false)}
          saving={saving}
          isNew
        />
      )}

      {/* Liste par groupe */}
      {Object.entries(grouped).map(([trigger, items]) => {
        const triggerInfo = TRIGGER_LABELS[trigger] || { label: trigger, description: '', icon: '📧' }

        return (
          <div key={trigger}>
            <h3 className={`text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <span>{triggerInfo.icon}</span>
              {triggerInfo.label}
            </h3>

            <div className={`rounded-lg border overflow-hidden ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {items.map((automation) => {
                  const isEditing = editingId === automation.id
                  const isExpanded = expandedId === automation.id

                  return (
                    <div key={automation.id}>
                      <div
                        className={`p-4 flex items-center justify-between ${
                          isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                        } transition-colors cursor-pointer`}
                        onClick={() => setExpandedId(isExpanded ? null : automation.id)}
                      >
                        <div className="flex items-center gap-4">
                          {/* Toggle ON/OFF */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggle(automation.id, !automation.enabled)
                            }}
                            className={`p-1.5 rounded-full transition-colors ${
                              automation.enabled
                                ? 'bg-green-500/20 text-green-500'
                                : isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                            }`}
                          >
                            {automation.enabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                          </button>

                          <div>
                            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {automation.name}
                            </h4>
                            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDelay(automation.delay_minutes)}
                              </span>
                              <ArrowRight className="w-3 h-3" />
                              <code className={`px-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                {automation.template_code}
                              </code>
                              {automation.max_sends && (
                                <span className={`px-1.5 py-0.5 rounded ${
                                  isDark ? 'bg-gray-700' : 'bg-gray-100'
                                }`}>
                                  max {automation.max_sends}×
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleStartEdit(automation)}
                            className={`p-2 rounded transition-colors ${
                              isDark ? 'text-orange-400 hover:bg-orange-500/20' : 'text-orange-500 hover:bg-orange-100'
                            }`}
                            title="Éditer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(automation.id, automation.name)}
                            className={`p-2 rounded transition-colors ${
                              isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-100'
                            }`}
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Expanded detail / edit form */}
                      {isExpanded && (
                        <div className={`px-4 pb-4 ${isDark ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
                          {isEditing ? (
                            <AutomationForm
                              isDark={isDark}
                              formData={formData}
                              setFormData={setFormData}
                              onSave={handleSave}
                              onCancel={() => {
                                setEditingId(null)
                                setExpandedId(null)
                              }}
                              saving={saving}
                            />
                          ) : (
                            <div className={`pt-3 space-y-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {automation.description && <p>{automation.description}</p>}
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <span className="font-medium">Trigger :</span>{' '}
                                  {triggerInfo.label}
                                </div>
                                <div>
                                  <span className="font-medium">Délai :</span>{' '}
                                  {formatDelay(automation.delay_minutes)}
                                </div>
                                <div>
                                  <span className="font-medium">Template :</span>{' '}
                                  <code>{automation.template_code}</code>
                                </div>
                              </div>
                              {automation.conditions && Object.keys(automation.conditions).length > 0 && (
                                <div>
                                  <span className="font-medium">Conditions :</span>{' '}
                                  <code className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {JSON.stringify(automation.conditions)}
                                  </code>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      {automations.length === 0 && !showCreate && (
        <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune automatisation configurée</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Formulaire d'automation réutilisable
// ============================================================
function AutomationForm({
  isDark,
  formData,
  setFormData,
  onSave,
  onCancel,
  saving,
  isNew = false,
}: {
  isDark: boolean
  formData: {
    name: string
    description: string
    trigger_event: string
    template_code: string
    delay_minutes: number
    enabled: boolean
    max_sends: string | number
  }
  setFormData: (data: typeof formData) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew?: boolean
}) {
  return (
    <div className={`p-4 mt-2 rounded-lg border space-y-4 ${
      isDark ? 'bg-gray-900/50 border-gray-600' : 'bg-gray-50 border-gray-200'
    }`}>
      {isNew && (
        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Nouvelle automatisation
        </h3>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Nom *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Confirmation de réservation"
            className={`w-full px-3 py-2 rounded-lg border ${
              isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-orange-500`}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Événement déclencheur *
          </label>
          <select
            value={formData.trigger_event}
            onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })}
            className={`w-full px-3 py-2 rounded-lg border ${
              isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-orange-500`}
          >
            {AVAILABLE_TRIGGERS.map(t => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Code template *
          </label>
          <input
            type="text"
            value={formData.template_code}
            onChange={(e) => setFormData({ ...formData, template_code: e.target.value })}
            placeholder="booking_confirmation_{{locale}}"
            className={`w-full px-3 py-2 rounded-lg border ${
              isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-orange-500`}
          />
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Code du template email à envoyer
          </p>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Délai (minutes)
          </label>
          <input
            type="number"
            min="0"
            value={formData.delay_minutes}
            onChange={(e) => setFormData({ ...formData, delay_minutes: parseInt(e.target.value) || 0 })}
            className={`w-full px-3 py-2 rounded-lg border ${
              isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-orange-500`}
          />
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            0 = immédiat, 1440 = 24h, etc.
          </p>
        </div>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Description
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Email envoyé automatiquement quand..."
          className={`w-full px-3 py-2 rounded-lg border ${
            isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
          } focus:outline-none focus:ring-2 focus:ring-orange-500`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Max envois
          </label>
          <input
            type="number"
            min="0"
            value={formData.max_sends}
            onChange={(e) => setFormData({ ...formData, max_sends: e.target.value })}
            placeholder="Illimité"
            className={`w-full px-3 py-2 rounded-lg border ${
              isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-orange-500`}
          />
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Laisser vide pour illimité (ex: 3 pour les rappels)
          </p>
        </div>

        <div className="flex items-end">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto_enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <label htmlFor="auto_enabled" className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Automatisation active
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className={`px-4 py-2 rounded-lg ${
            isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          Annuler
        </button>
        <button
          onClick={onSave}
          disabled={saving || !formData.name || !formData.trigger_event || !formData.template_code}
          className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Sauvegarder
        </button>
      </div>
    </div>
  )
}
