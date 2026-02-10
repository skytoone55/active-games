'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, User, Phone, Mail, Save, AlertCircle, Building2 } from 'lucide-react'
import { useContacts } from '@/hooks/useContacts'
import type { Contact, Branch } from '@/lib/supabase/types'
import { validateEmail, validateIsraeliPhone, formatIsraeliPhone, VALIDATION_MESSAGES } from '@/lib/validation'
import { useTranslation } from '@/contexts/LanguageContext'

interface QuickContactModalProps {
  isOpen: boolean
  onClose: () => void
  onContactCreated: (contact: Contact) => void
  phone: string // Pre-filled from conversation
  contactName: string | null // Pre-filled from WhatsApp profile
  branches: Branch[]
  isDark: boolean
}

export function QuickContactModal({
  isOpen,
  onClose,
  onContactCreated,
  phone: initialPhone,
  contactName,
  branches,
  isDark,
}: QuickContactModalProps) {
  const { t, locale } = useTranslation()

  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ phone?: string; email?: string }>({})

  // Use the hook with the selected branch
  const { createContact } = useContacts(selectedBranchId || null)

  // Initialize fields when modal opens
  useEffect(() => {
    if (isOpen) {
      // Parse WhatsApp name into first/last
      if (contactName) {
        const parts = contactName.trim().split(/\s+/)
        setFirstName(parts[0] || '')
        setLastName(parts.slice(1).join(' ') || '')
      } else {
        setFirstName('')
        setLastName('')
      }

      // Format phone from international to local
      let formattedPhone = initialPhone
      if (formattedPhone.startsWith('972')) {
        formattedPhone = '0' + formattedPhone.substring(3)
      }
      setPhone(formattedPhone)

      setEmail('')
      setError(null)
      setValidationErrors({})

      // Default to first branch if only one available
      if (branches.length === 1) {
        setSelectedBranchId(branches[0].id)
      } else {
        setSelectedBranchId('')
      }
    }
  }, [isOpen, contactName, initialPhone, branches])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validations
    if (!selectedBranchId) {
      setError(t('admin.chat.quick_contact.branch_required') || 'Please select a branch')
      return
    }

    if (!firstName.trim()) {
      setError(t('admin.clients.modal.errors.first_name_required') || 'First name is required')
      return
    }

    if (!phone.trim()) {
      setError(t('admin.clients.modal.errors.phone_required') || 'Phone is required')
      return
    }

    if (!validateIsraeliPhone(phone)) {
      setError(VALIDATION_MESSAGES.phone.israeliFormat)
      return
    }

    if (email.trim() && !validateEmail(email)) {
      setError(VALIDATION_MESSAGES.email.invalid)
      return
    }

    setLoading(true)

    try {
      const formattedPhone = formatIsraeliPhone(phone)

      const newContact = await createContact({
        branch_id_main: selectedBranchId,
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone: formattedPhone,
        email: email.trim() || null,
        source: 'admin_agenda',
        client_type: 'individual',
      })

      if (newContact) {
        onContactCreated(newContact)
        onClose()
      } else {
        setError(t('admin.clients.modal.errors.error_creating') || 'Error creating contact')
      }
    } catch (err) {
      console.error('Error creating contact:', err)
      setError(t('admin.clients.modal.errors.generic_error') || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const getBranchName = (branch: Branch) => {
    if (locale === 'en' && branch.name_en) return branch.name_en
    return branch.name
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('admin.chat.quick_contact.title') || 'Create Contact'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            } disabled:opacity-50`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Error */}
          {error && (
            <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
              isDark
                ? 'bg-red-500/10 border-red-500/50 text-red-400'
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Branch selector (required) */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Building2 className="w-4 h-4 inline mr-1" />
              {t('admin.chat.quick_contact.branch') || 'Branch'} *
            </label>
            {branches.length === 1 ? (
              <div className={`px-3 py-2 rounded-lg border text-sm ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}>
                {getBranchName(branches[0])}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      selectedBranchId === branch.id
                        ? 'bg-green-600 text-white border-green-600'
                        : isDark
                          ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {getBranchName(branch)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* First name & Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <User className="w-3.5 h-3.5 inline mr-1" />
                {t('admin.clients.modal.first_name') || 'First name'} *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-green-500`}
                placeholder={t('admin.clients.modal.first_name_placeholder') || 'First name'}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.clients.modal.last_name') || 'Last name'}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-green-500`}
                placeholder={t('admin.clients.modal.last_name_placeholder') || 'Last name'}
              />
            </div>
          </div>

          {/* Phone (pre-filled, editable) */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Phone className="w-3.5 h-3.5 inline mr-1" />
              {t('admin.clients.modal.phone') || 'Phone'} *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const newPhone = e.target.value
                setPhone(newPhone)
                if (newPhone.trim() && !validateIsraeliPhone(newPhone)) {
                  setValidationErrors(prev => ({ ...prev, phone: VALIDATION_MESSAGES.phone.israeliFormat }))
                } else {
                  setValidationErrors(prev => {
                    const { phone: _, ...rest } = prev
                    return rest
                  })
                }
              }}
              required
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                validationErrors.phone
                  ? 'border-red-500'
                  : isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-green-500`}
              placeholder="05XXXXXXXX"
            />
            {validationErrors.phone && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {validationErrors.phone}
              </p>
            )}
          </div>

          {/* Email (optional) */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Mail className="w-3.5 h-3.5 inline mr-1" />
              {t('admin.clients.modal.email') || 'Email'}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const newEmail = e.target.value
                setEmail(newEmail)
                if (newEmail.trim() && !validateEmail(newEmail)) {
                  setValidationErrors(prev => ({ ...prev, email: VALIDATION_MESSAGES.email.invalid }))
                } else {
                  setValidationErrors(prev => {
                    const { email: _, ...rest } = prev
                    return rest
                  })
                }
              }}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                validationErrors.email
                  ? 'border-red-500'
                  : isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-green-500`}
              placeholder="email@example.com"
            />
            {validationErrors.email && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {validationErrors.email}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              } disabled:opacity-50`}
            >
              {t('admin.clients.modal.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('admin.clients.modal.creating') || 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t('admin.chat.quick_contact.create_and_link') || 'Create & Link'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
