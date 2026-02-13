'use client'

import { useState, useMemo } from 'react'
import {
  Loader2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Code,
  Lock,
  ArrowLeft,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import type { EmailTemplate } from '@/lib/supabase/types'

interface EmailTemplatesEditorProps {
  isDark: boolean
}

// Variables disponibles par catégorie de template
const TEMPLATE_VARIABLES: Record<string, { label: string; variables: { key: string; description: string }[] }> = {
  booking: {
    label: 'Réservation',
    variables: [
      { key: 'booking_reference', description: 'Référence de la réservation' },
      { key: 'booking_date', description: 'Date formatée' },
      { key: 'booking_time', description: 'Heure formatée' },
      { key: 'participants', description: 'Nombre de participants' },
      { key: 'booking_type', description: 'Type (Game/Event)' },
      { key: 'game_type', description: 'Type de jeu (Laser/Active/Mix)' },
      { key: 'branch_name', description: 'Nom de la branche' },
      { key: 'branch_address', description: 'Adresse' },
      { key: 'branch_phone', description: 'Téléphone' },
      { key: 'client_name', description: 'Nom complet du client' },
      { key: 'client_first_name', description: 'Prénom' },
      { key: 'client_last_name', description: 'Nom' },
      { key: 'client_email', description: 'Email client' },
      { key: 'terms_conditions', description: 'HTML des CGV' },
      { key: 'cgv_url', description: 'URL de validation CGV' },
      { key: 'cgv_section', description: 'Section CGV complète (HTML)' },
      { key: 'logo_activegames_url', description: 'URL logo Active Games' },
      { key: 'logo_lasercity_url', description: 'URL logo Laser City' },
      { key: 'current_year', description: 'Année en cours' },
    ]
  },
  reminder: {
    label: 'Rappels',
    variables: [
      { key: 'client_first_name', description: 'Prénom du client' },
      { key: 'request_reference', description: 'Référence de la commande' },
      { key: 'cgv_url', description: 'URL de validation CGV' },
      { key: 'branch_name', description: 'Nom de la branche' },
      { key: 'reminder_number', description: 'Numéro du rappel' },
    ]
  },
  general: {
    label: 'Général',
    variables: [
      { key: 'client_name', description: 'Nom complet' },
      { key: 'client_first_name', description: 'Prénom' },
      { key: 'client_email', description: 'Email' },
      { key: 'branch_name', description: 'Nom de la branche' },
      { key: 'current_year', description: 'Année en cours' },
    ]
  }
}

// Catégories avec labels
const CATEGORIES: Record<string, string> = {
  booking: '📋 Réservation',
  reminder: '🔔 Rappels',
  cgv: '📜 Pages CGV',
  terms: '📝 Conditions',
  general: '📧 Général',
}

export function EmailTemplatesEditor({ isDark }: EmailTemplatesEditorProps) {
  const { t } = useTranslation()
  const { templates, loading, error, createTemplate, updateTemplate, deleteTemplate } = useEmailTemplates()

  // Filtrer les templates de termes (gérés dans leur propre section)
  const emailTemplates = templates.filter(t => !t.code.startsWith('terms_'))

  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedVar, setCopiedVar] = useState<string | null>(null)
  const [showVariables, setShowVariables] = useState(true)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    subject_template: '',
    body_template: '',
    is_active: true,
    category: 'general'
  })

  // Grouper par catégorie
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, EmailTemplate[]> = {}
    const filtered = filterCategory === 'all'
      ? emailTemplates
      : emailTemplates.filter(t => (t as EmailTemplate & { category?: string }).category === filterCategory)

    filtered.forEach(template => {
      const cat = (template as EmailTemplate & { category?: string }).category || 'general'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(template)
    })
    return groups
  }, [emailTemplates, filterCategory])

  // Catégories présentes
  const availableCategories = useMemo(() => {
    const cats = new Set<string>()
    emailTemplates.forEach(t => {
      cats.add((t as EmailTemplate & { category?: string }).category || 'general')
    })
    return Array.from(cats)
  }, [emailTemplates])

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData({
      code: template.code,
      name: template.name,
      description: template.description || '',
      subject_template: template.subject_template,
      body_template: template.body_template,
      is_active: template.is_active,
      category: (template as EmailTemplate & { category?: string }).category || 'general'
    })
  }

  const handleCreate = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      subject_template: '',
      body_template: '',
      is_active: true,
      category: 'general'
    })
    setShowCreateModal(true)
    setEditingTemplate(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingTemplate) {
        const result = await updateTemplate(editingTemplate.id, {
          name: formData.name,
          description: formData.description || null,
          subject_template: formData.subject_template,
          body_template: formData.body_template,
          is_active: formData.is_active
        })
        if (!result.success) {
          alert(result.error || 'Erreur lors de la sauvegarde')
          return
        }
        setEditingTemplate(null)
      } else {
        const result = await createTemplate({
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          subject_template: formData.subject_template,
          body_template: formData.body_template,
          is_active: formData.is_active
        })
        if (!result.success) {
          alert(result.error || 'Erreur lors de la création')
          return
        }
        setShowCreateModal(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (template: EmailTemplate) => {
    if (template.is_system) {
      alert('Impossible de supprimer un template système')
      return
    }
    if (confirm(`Supprimer le template "${template.name}" ?`)) {
      const result = await deleteTemplate(template.id)
      if (!result.success) {
        alert(result.error || 'Erreur lors de la suppression')
      }
    }
  }

  const handleToggleActive = async (template: EmailTemplate) => {
    await updateTemplate(template.id, { is_active: !template.is_active })
  }

  const copyVariable = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`)
    setCopiedVar(key)
    setTimeout(() => setCopiedVar(null), 2000)
  }

  const insertVariable = (key: string) => {
    const textarea = document.getElementById('body-editor') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = formData.body_template
      const newText = text.substring(0, start) + `{{${key}}}` + text.substring(end)
      setFormData({ ...formData, body_template: newText })
      // Remettre le focus
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + key.length + 4, start + key.length + 4)
      }, 0)
    } else {
      // Fallback: ajouter à la fin
      setFormData({ ...formData, body_template: formData.body_template + `{{${key}}}` })
    }
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

  // ============================================================
  // MODE ÉDITION : éditeur HTML + preview côte à côte
  // ============================================================
  if (editingTemplate || showCreateModal) {
    const currentCategory = formData.category || 'general'
    const vars = TEMPLATE_VARIABLES[currentCategory] || TEMPLATE_VARIABLES.general

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setEditingTemplate(null)
              setShowCreateModal(false)
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingTemplate(null)
                setShowCreateModal(false)
              }}
              className={`px-4 py-2 rounded-lg ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name || !formData.subject_template || !formData.body_template || (!editingTemplate && !formData.code)}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Sauvegarder
            </button>
          </div>
        </div>

        {/* Titre */}
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {editingTemplate ? `Éditer : ${editingTemplate.name}` : 'Nouveau template'}
        </h2>

        {/* Champs de base */}
        <div className="grid grid-cols-2 gap-4">
          {!editingTemplate && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                placeholder="booking_confirmation_fr"
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-orange-500`}
              />
            </div>
          )}
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Nom *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Confirmation de réservation (FR)"
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-orange-500`}
            />
          </div>
          <div className={editingTemplate ? '' : 'col-span-2'}>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Email envoyé lors de la confirmation"
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-orange-500`}
            />
          </div>
        </div>

        {/* Sujet */}
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Sujet *
          </label>
          <input
            type="text"
            value={formData.subject_template}
            onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
            placeholder="Votre réservation est confirmée - Réf. {{booking_reference}}"
            className={`w-full px-3 py-2 rounded-lg border ${
              isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-orange-500`}
          />
        </div>

        {/* Éditeur + Preview côte à côte */}
        <div className="grid grid-cols-2 gap-4" style={{ minHeight: '500px' }}>
          {/* Code HTML */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Code className="w-4 h-4 inline mr-1" />
                Code HTML *
              </label>
            </div>
            <textarea
              id="body-editor"
              value={formData.body_template}
              onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
              placeholder="<html>...</html>"
              className={`flex-1 w-full px-3 py-2 rounded-lg border font-mono text-xs leading-relaxed resize-none ${
                isDark ? 'bg-gray-900 border-gray-600 text-green-400' : 'bg-gray-50 border-gray-200 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-orange-500`}
              style={{ minHeight: '500px', tabSize: 2 }}
            />
          </div>

          {/* Preview */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Eye className="w-4 h-4 inline mr-1" />
                Aperçu en direct
              </label>
            </div>
            <div className={`flex-1 rounded-lg border overflow-hidden ${
              isDark ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <iframe
                srcDoc={formData.body_template || '<html><body style="color:#999;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Aperçu du template...</p></body></html>'}
                className="w-full h-full bg-white"
                title="Email preview"
                style={{ minHeight: '500px' }}
              />
            </div>
          </div>
        </div>

        {/* Panel de variables (collapsable) */}
        <div className={`rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <button
            onClick={() => setShowVariables(!showVariables)}
            className={`w-full flex items-center justify-between p-3 ${
              isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
            } transition-colors rounded-lg`}
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-orange-500" />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Variables disponibles — cliquer pour insérer
              </span>
            </div>
            {showVariables ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showVariables && (
            <div className="px-3 pb-3">
              <div className="flex flex-wrap gap-2">
                {vars.variables.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      copyVariable(v.key)
                    }}
                    className={`group flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                      isDark
                        ? 'bg-gray-700 hover:bg-orange-500/20 text-gray-300 hover:text-orange-400'
                        : 'bg-gray-100 hover:bg-orange-100 text-gray-600 hover:text-orange-700'
                    }`}
                    title={`${v.description}\nClic = insérer, Clic droit = copier`}
                  >
                    <code className="font-mono">{`{{${v.key}}}`}</code>
                    {copiedVar === v.key ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Checkbox actif */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          <label htmlFor="is_active" className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Template actif
          </label>
        </div>
      </div>
    )
  }

  // ============================================================
  // MODE LISTE : affichage des templates groupés par catégorie
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Templates email
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Gérez vos templates d&apos;emails. Cliquez pour éditer le HTML avec aperçu en direct.
          </p>
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau template
        </button>
      </div>

      {/* Filtres par catégorie */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            filterCategory === 'all'
              ? 'bg-orange-600 text-white'
              : isDark
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tous ({emailTemplates.length})
        </button>
        {availableCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterCategory === cat
                ? 'bg-orange-600 text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {CATEGORIES[cat] || cat} ({emailTemplates.filter(t => ((t as EmailTemplate & { category?: string }).category || 'general') === cat).length})
          </button>
        ))}
      </div>

      {/* Templates groupés */}
      {Object.entries(groupedTemplates).map(([category, catTemplates]) => (
        <div key={category}>
          <h3 className={`text-sm font-semibold uppercase tracking-wider mb-2 ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {CATEGORIES[category] || category}
          </h3>

          <div className={`rounded-lg border overflow-hidden ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {catTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 flex items-center justify-between ${
                    isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  } transition-colors cursor-pointer`}
                  onClick={() => handleEdit(template)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      template.is_active ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {template.name}
                        </h3>
                        {template.is_system && (
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                            isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                          }`}>
                            <Lock className="w-3 h-3" />
                            Système
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <code className={`px-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          {template.code}
                        </code>
                        {template.description && ` — ${template.description}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`p-2 rounded transition-colors ${
                        template.is_active
                          ? isDark ? 'text-green-400 hover:bg-green-500/20' : 'text-green-600 hover:bg-green-100'
                          : isDark ? 'text-gray-500 hover:bg-gray-600' : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={template.is_active ? 'Désactiver' : 'Activer'}
                    >
                      {template.is_active ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={() => handleEdit(template)}
                      className={`p-2 rounded transition-colors ${
                        isDark ? 'text-orange-400 hover:bg-orange-500/20' : 'text-orange-500 hover:bg-orange-100'
                      }`}
                      title="Éditer"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>

                    {!template.is_system && (
                      <button
                        onClick={() => handleDelete(template)}
                        className={`p-2 rounded transition-colors ${
                          isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-100'
                        }`}
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {emailTemplates.length === 0 && (
        <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <Code className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun template email</p>
        </div>
      )}
    </div>
  )
}
