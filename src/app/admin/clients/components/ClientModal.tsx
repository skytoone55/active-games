'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, User, Phone, Mail, MessageSquare, Save, AlertCircle } from 'lucide-react'
import { useContacts } from '@/hooks/useContacts'
import type { Contact } from '@/lib/supabase/types'
import { validateEmail, validateIsraeliPhone, formatIsraeliPhone, VALIDATION_MESSAGES } from '@/lib/validation'

interface ClientModalProps {
  isOpen: boolean
  onClose: () => void
  contact: Contact | null // null = création, non-null = édition
  branchId: string
  onSave: (updatedContact?: Contact) => void | Promise<void>
  isDark: boolean
}

export function ClientModal({
  isOpen,
  onClose,
  contact,
  branchId,
  onSave,
  isDark,
}: ClientModalProps) {
  const { createContact, updateContact } = useContacts(branchId)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notesClient, setNotesClient] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ phone?: string; email?: string }>({})

  // Initialiser les champs quand le modal s'ouvre ou que le contact change
  useEffect(() => {
    if (isOpen) {
      if (contact) {
        // Mode édition
        setFirstName(contact.first_name || '')
        setLastName(contact.last_name || '')
        setPhone(contact.phone || '')
        setEmail(contact.email || '')
        setNotesClient(contact.notes_client || '')
      } else {
        // Mode création
        setFirstName('')
        setLastName('')
        setPhone('')
        setEmail('')
        setNotesClient('')
      }
      setError(null)
    }
  }, [isOpen, contact])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validations
    if (!firstName.trim()) {
      setError('Le prénom est requis')
      return
    }

    if (!phone.trim()) {
      setError('Le téléphone est requis')
      return
    }

    // Validation format téléphone
    if (!validateIsraeliPhone(phone)) {
      setError(VALIDATION_MESSAGES.phone.israeliFormat)
      return
    }

    // Validation format email si renseigné
    if (email.trim() && !validateEmail(email)) {
      setError(VALIDATION_MESSAGES.email.invalid)
      return
    }

    setLoading(true)

    try {
      const formattedPhone = formatIsraeliPhone(phone)
      
      if (contact) {
        // Mise à jour
        const updated = await updateContact(contact.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          phone: formattedPhone,
          email: email.trim() || null,
          notes_client: notesClient.trim() || null,
        })

        if (updated) {
          await onSave(updated)
          onClose()
        } else {
          setError('Erreur lors de la mise à jour du contact')
        }
      } else {
        // Création
        const newContact = await createContact({
          branch_id_main: branchId,
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          phone: formattedPhone,
          email: email.trim() || null,
          notes_client: notesClient.trim() || null,
          source: 'admin_agenda',
        })

        if (newContact) {
          await onSave(newContact)
          onClose()
        } else {
          setError('Erreur lors de la création du contact')
        }
      }
    } catch (err) {
      console.error('Error saving contact:', err)
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`relative w-full max-w-2xl mx-4 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {contact ? 'Modifier le contact' : 'Nouveau contact'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            } disabled:opacity-50`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Erreur */}
          {error && (
            <div className={`p-4 rounded-lg border ${
              isDark
                ? 'bg-red-500/10 border-red-500/50 text-red-400'
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              {error}
            </div>
          )}

          {/* Prénom et Nom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <User className="w-4 h-4 inline mr-1" />
                Prénom *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Nom
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Nom (optionnel)"
              />
            </div>
          </div>

          {/* Téléphone et Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Phone className="w-4 h-4 inline mr-1" />
                Téléphone *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  const newPhone = e.target.value
                  setPhone(newPhone)
                  // Validation en temps réel
                  if (newPhone.trim() && !validateIsraeliPhone(newPhone)) {
                    setValidationErrors({ ...validationErrors, phone: VALIDATION_MESSAGES.phone.israeliFormat })
                  } else {
                    const { phone: _, ...rest } = validationErrors
                    setValidationErrors(rest)
                  }
                }}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  validationErrors.phone
                    ? 'border-red-500'
                    : isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="05XXXXXXXX"
              />
              {validationErrors.phone && (
                <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{validationErrors.phone}</span>
                </div>
              )}
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  const newEmail = e.target.value
                  setEmail(newEmail)
                  // Validation en temps réel
                  if (newEmail.trim() && !validateEmail(newEmail)) {
                    setValidationErrors({ ...validationErrors, email: VALIDATION_MESSAGES.email.invalid })
                  } else {
                    const { email: _, ...rest } = validationErrors
                    setValidationErrors(rest)
                  }
                }}
                className={`w-full px-3 py-2 rounded-lg border ${
                  validationErrors.email
                    ? 'border-red-500'
                    : isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="email@exemple.com"
              />
              {validationErrors.email && (
                <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{validationErrors.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes client */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Notes client (préférences, allergies, etc.)
            </label>
            <textarea
              value={notesClient}
              onChange={(e) => setNotesClient(e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 rounded-lg border resize-none ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Notes globales sur le client (préférences, allergies, etc.)"
            />
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              } disabled:opacity-50`}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {contact ? 'Enregistrement...' : 'Création...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {contact ? 'Enregistrer' : 'Créer le contact'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
