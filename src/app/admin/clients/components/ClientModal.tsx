'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, User, Phone, Mail, MessageSquare, Save, AlertCircle, Building2 } from 'lucide-react'
import { useContacts } from '@/hooks/useContacts'
import type { Contact, ClientType } from '@/lib/supabase/types'
import { validateEmail, validateIsraeliPhone, formatIsraeliPhone, VALIDATION_MESSAGES } from '@/lib/validation'
import { useTranslation } from '@/contexts/LanguageContext'

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
  const { t } = useTranslation()
  const { createContact, updateContact } = useContacts(branchId)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notesClient, setNotesClient] = useState('')
  const [preferredLocale, setPreferredLocale] = useState<'he' | 'fr' | 'en'>('he')
  const [isCompany, setIsCompany] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [vatId, setVatId] = useState('')
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
        setPreferredLocale(contact.preferred_locale || 'he')
        setIsCompany(contact.client_type === 'company')
        setCompanyName(contact.company_name || '')
        setVatId(contact.vat_id || '')
      } else {
        // Mode création
        setFirstName('')
        setLastName('')
        setPhone('')
        setEmail('')
        setNotesClient('')
        setPreferredLocale('he')
        setIsCompany(false)
        setCompanyName('')
        setVatId('')
      }
      setError(null)
      setValidationErrors({})
    }
  }, [isOpen, contact])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validations
    if (!firstName.trim()) {
      setError(t('admin.clients.modal.errors.first_name_required'))
      return
    }

    if (!phone.trim()) {
      setError(t('admin.clients.modal.errors.phone_required'))
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

    // Validation entreprise
    if (isCompany) {
      if (!companyName.trim()) {
        setError(t('admin.clients.modal.errors.company_name_required'))
        return
      }
      if (!vatId.trim()) {
        setError(t('admin.clients.modal.errors.vat_id_required'))
        return
      }
    }

    setLoading(true)

    try {
      const formattedPhone = formatIsraeliPhone(phone)
      const clientType: ClientType = isCompany ? 'company' : 'individual'

      if (contact) {
        // Mise à jour
        const updated = await updateContact(contact.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          phone: formattedPhone,
          email: email.trim() || null,
          notes_client: notesClient.trim() || null,
          preferred_locale: preferredLocale,
          client_type: clientType,
          company_name: isCompany ? companyName.trim() : null,
          vat_id: isCompany ? vatId.trim() : null,
        })

        if (updated) {
          await onSave(updated)
          onClose()
        } else {
          setError(t('admin.clients.modal.errors.error_updating'))
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
          preferred_locale: preferredLocale,
          source: 'admin_agenda',
          client_type: clientType,
          company_name: isCompany ? companyName.trim() : null,
          vat_id: isCompany ? vatId.trim() : null,
        })

        if (newContact) {
          await onSave(newContact)
          onClose()
        } else {
          setError(t('admin.clients.modal.errors.error_creating'))
        }
      }
    } catch (err) {
      console.error('Error saving contact:', err)
      setError(t('admin.clients.modal.errors.generic_error'))
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
            {contact ? t('admin.clients.modal.title.edit') : t('admin.clients.modal.title.new')}
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

          {/* Company Checkbox */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${
            isDark ? 'border-gray-700 bg-gray-700/50' : 'border-gray-200 bg-gray-50'
          }`}>
            <input
              type="checkbox"
              id="isCompany"
              checked={isCompany}
              onChange={(e) => setIsCompany(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isCompany" className={`flex items-center gap-2 cursor-pointer ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Building2 className="w-5 h-5" />
              <span className="font-medium">{t('admin.clients.modal.company.label')}</span>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.clients.modal.company.help')}
              </span>
            </label>
          </div>

          {/* Company Fields (conditional) */}
          {isCompany && (
            <div className={`grid grid-cols-2 gap-4 p-4 rounded-lg border ${
              isDark ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-200 bg-blue-50'
            }`}>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Building2 className="w-4 h-4 inline mr-1" />
                  {t('admin.clients.modal.company_name')}
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder={t('admin.clients.modal.company_name_placeholder')}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.clients.modal.vat_id')}
                </label>
                <input
                  type="text"
                  value={vatId}
                  onChange={(e) => setVatId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder={t('admin.clients.modal.vat_id_placeholder')}
                />
              </div>
            </div>
          )}

          {/* Prénom et Nom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <User className="w-4 h-4 inline mr-1" />
                {isCompany ? t('admin.clients.modal.contact_first_name') : t('admin.clients.modal.first_name')}
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
                placeholder={t('admin.clients.modal.first_name_placeholder')}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {isCompany ? t('admin.clients.modal.contact_last_name') : t('admin.clients.modal.last_name')}
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
                placeholder={t('admin.clients.modal.last_name_placeholder')}
              />
            </div>
          </div>

          {/* Téléphone et Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Phone className="w-4 h-4 inline mr-1" />
                {t('admin.clients.modal.phone')}
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
                placeholder={t('admin.clients.modal.phone_placeholder')}
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
                {t('admin.clients.modal.email')}
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
                placeholder={t('admin.clients.modal.email_placeholder')}
              />
              {validationErrors.email && (
                <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{validationErrors.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Langue préférée pour les emails */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Mail className="w-4 h-4 inline mr-1" />
              {t('admin.clients.modal.email_language')}
            </label>
            <div className="flex items-center gap-2">
              {([
                { code: 'he', flag: '🇮🇱', label: 'עברית (Hebrew)' },
                { code: 'fr', flag: '🇫🇷', label: 'Français (French)' },
                { code: 'en', flag: '🇬🇧', label: 'English' }
              ] as const).map(({ code, flag, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPreferredLocale(code)}
                  title={label}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    preferredLocale === code
                      ? isDark
                        ? 'bg-blue-600/30 border-blue-500 ring-2 ring-blue-500'
                        : 'bg-blue-100 border-blue-500 ring-2 ring-blue-500'
                      : isDark
                        ? 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                        : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{flag}</span>
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {code === 'he' ? 'עברית' : code === 'fr' ? 'Français' : 'English'}
                  </span>
                </button>
              ))}
            </div>
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('admin.clients.modal.email_language_help')}
            </p>
          </div>

          {/* Notes client */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <MessageSquare className="w-4 h-4 inline mr-1" />
              {t('admin.clients.modal.client_notes')}
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
              placeholder={t('admin.clients.modal.client_notes_placeholder')}
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
              {t('admin.clients.modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {contact ? t('admin.clients.modal.saving') : t('admin.clients.modal.creating')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {contact ? t('admin.clients.modal.save') : t('admin.clients.modal.create')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
