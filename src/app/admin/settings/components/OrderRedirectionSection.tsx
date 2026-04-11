'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Mail, Loader2 } from 'lucide-react'

interface OrderRedirectionSectionProps {
  isDark: boolean
  branchId?: string
}

export function OrderRedirectionSection({ isDark, branchId }: OrderRedirectionSectionProps) {
  const [emails, setEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    fetch(`/api/branch-notification?branch_id=${branchId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setEmails(data.emails || [])
      })
      .catch(() => setError('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }, [branchId])

  const addEmail = () => {
    const trimmed = newEmail.trim()
    if (!trimmed || !trimmed.includes('@')) return
    if (emails.includes(trimmed)) { setNewEmail(''); return }
    setEmails(prev => [...prev, trimmed])
    setNewEmail('')
    setSaved(false)
  }

  const removeEmail = (idx: number) => {
    setEmails(prev => prev.filter((_, i) => i !== idx))
    setSaved(false)
  }

  const save = async () => {
    if (!branchId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/branch-notification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId, emails }),
      })
      const data = await res.json()
      if (data.success) {
        setEmails(data.emails)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const base = isDark
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-900'

  const inputBase = isDark
    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Redirection de notifications
        </h3>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Pour chaque nouvelle commande reçue (quel que soit son statut), un email de notification sera envoyé aux adresses configurées ci-dessous.
        </p>
      </div>

      {!branchId && (
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
          Sélectionnez une branche pour configurer les redirections.
        </div>
      )}

      {branchId && (
        <div className={`rounded-xl border p-5 space-y-4 ${base}`}>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* Liste des emails configurés */}
              {emails.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Aucune adresse de redirection configurée.
                </p>
              ) : (
                <ul className="space-y-2">
                  {emails.map((email, idx) => (
                    <li
                      key={idx}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Mail className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                        <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{email}</span>
                      </div>
                      <button
                        onClick={() => removeEmail(idx)}
                        className={`p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors`}
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Ajouter un email */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEmail()}
                  placeholder="exemple@email.com"
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-blue-500 ${inputBase}`}
                />
                <button
                  onClick={addEmail}
                  disabled={!newEmail.trim() || !newEmail.includes('@')}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {/* Bouton sauvegarder */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={save}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    saved
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } disabled:opacity-50`}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saved ? 'Sauvegardé !' : 'Sauvegarder'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
