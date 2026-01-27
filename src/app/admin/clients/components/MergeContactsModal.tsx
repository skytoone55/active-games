'use client'

import { useState } from 'react'
import { X, Loader2, User, Phone, Mail, AlertTriangle, Check } from 'lucide-react'
import { useContacts, type UpdateContactData } from '@/hooks/useContacts'
import type { Contact, BookingContactUpdate } from '@/lib/supabase/types'
import { useTranslation } from '@/contexts/LanguageContext'
import { getClient } from '@/lib/supabase/client'

type ContactField = 'first_name' | 'last_name' | 'phone' | 'email' | 'notes_client'

interface MergeContactsModalProps {
  isOpen: boolean
  onClose: () => void
  contacts: Contact[]
  onMergeComplete: () => void
  branchId: string
  isDark: boolean
}

export function MergeContactsModal({
  isOpen,
  onClose,
  contacts,
  onMergeComplete,
  branchId,
  isDark,
}: MergeContactsModalProps) {
  const { t } = useTranslation()
  const { updateContact, archiveContact } = useContacts(branchId)
  const [selectedFields, setSelectedFields] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || contacts.length < 2) return null

  const primaryContact = contacts[0]
  const duplicateContacts = contacts.slice(1)

  const initializeFields = () => {
    const fields: Record<string, string> = {}
    fields.first_name = primaryContact.id
    fields.last_name = primaryContact.id
    fields.phone = primaryContact.id
    fields.email = primaryContact.email ? primaryContact.id : (duplicateContacts.find(c => c.email)?.id || primaryContact.id)
    fields.notes_client = primaryContact.notes_client ? primaryContact.id : (duplicateContacts.find(c => c.notes_client)?.id || primaryContact.id)
    setSelectedFields(fields)
  }

  if (Object.keys(selectedFields).length === 0) {
    initializeFields()
  }

  const handleFieldSelect = (field: string, contactId: string) => {
    setSelectedFields(prev => ({ ...prev, [field]: contactId }))
  }

  const handleMerge = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = getClient()

      const allContacts = [primaryContact, ...duplicateContacts]
      const mergedData: UpdateContactData = {}

      Object.entries(selectedFields).forEach(([field, contactId]) => {
        const selectedContact = allContacts.find(c => c.id === contactId)
        if (selectedContact) {
          const value = selectedContact[field as ContactField]
          if (field === 'first_name' && value) {
            mergedData.first_name = value
          } else if (field === 'last_name') {
            mergedData.last_name = value
          } else if (field === 'phone' && value) {
            mergedData.phone = value
          } else if (field === 'email') {
            mergedData.email = value
          } else if (field === 'notes_client') {
            mergedData.notes_client = value
          }
        }
      })

      const allNotes = allContacts
        .map(c => c.notes_client)
        .filter(Boolean)
        .join('\n---\n')
      if (allNotes) {
        mergedData.notes_client = allNotes
      }

      await updateContact(primaryContact.id, mergedData)

      for (const duplicate of duplicateContacts) {
        const { data: bookingContacts } = await supabase
          .from('booking_contacts')
          .select('booking_id, contact_id')
          .eq('contact_id', duplicate.id)
          .returns<Array<{ booking_id: string; contact_id: string }>>()

        if (bookingContacts && bookingContacts.length > 0) {
          for (const bc of bookingContacts) {
            const bookingId = bc.booking_id
            const { data: existing } = await supabase
              .from('booking_contacts')
              .select('id')
              .eq('booking_id', bookingId)
              .eq('contact_id', primaryContact.id)
              .single()

            if (!existing) {
              const updateData: BookingContactUpdate = { contact_id: primaryContact.id }
              await supabase
                .from('booking_contacts')
                // @ts-expect-error - Supabase type inference limitation with update
                .update(updateData)
                .eq('booking_id', bookingId)
                .eq('contact_id', duplicate.id)
            } else {
              await supabase
                .from('booking_contacts')
                .delete()
                .eq('booking_id', bookingId)
                .eq('contact_id', duplicate.id)
            }
          }
        }

        await archiveContact(duplicate.id)
        await updateContact(duplicate.id, {
          archived_reason: t('admin.clients.merge_modal.archived_reason', {
            name: `${primaryContact.first_name} ${primaryContact.last_name || ''}`.trim(),
            id: primaryContact.id
          }),
        })
      }

      onMergeComplete()
      onClose()
    } catch (err) {
      console.error('Error merging contacts:', err)
      setError(t('admin.clients.merge_modal.error'))
    } finally {
      setLoading(false)
    }
  }

  const getContactValue = (contact: Contact, field: ContactField): string => {
    return contact[field] || '-'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-6 h-6 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.clients.merge_modal.title')}
            </h2>
          </div>
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warning */}
          <div className={`p-4 rounded-lg border ${
            isDark
              ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
              : 'bg-yellow-50 border-yellow-200 text-yellow-700'
          }`}>
            <p className="text-sm">
              <strong>{t('admin.clients.merge_modal.warning_title')}</strong> {t('admin.clients.merge_modal.warning_message', { count: duplicateContacts.length })}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className={`p-4 rounded-lg border ${
              isDark
                ? 'bg-red-500/10 border-red-500/50 text-red-400'
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              {error}
            </div>
          )}

          {/* Selection table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? 'bg-gray-700/50' : 'bg-gray-100'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('admin.clients.merge_modal.field_label')}
                  </th>
                  <th className={`px-4 py-3 text-center text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('admin.clients.merge_modal.primary_contact')}
                  </th>
                  {duplicateContacts.map((contact, idx) => (
                    <th key={contact.id} className={`px-4 py-3 text-center text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t('admin.clients.merge_modal.duplicate', { number: idx + 1 })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}>
                {(['first_name', 'last_name', 'phone', 'email', 'notes_client'] as ContactField[]).map((field) => (
                  <tr key={field}>
                    <td className={`px-4 py-3 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t(`admin.clients.merge_modal.fields.${field}`)}
                    </td>
                    <td className="px-4 py-3">
                      <label className="flex items-center justify-center cursor-pointer">
                        <input
                          type="radio"
                          name={`field_${field}`}
                          checked={selectedFields[field] === primaryContact.id}
                          onChange={() => handleFieldSelect(field, primaryContact.id)}
                          className="mr-2"
                        />
                        <span className={isDark ? 'text-white' : 'text-gray-900'}>
                          {getContactValue(primaryContact, field)}
                        </span>
                      </label>
                    </td>
                    {duplicateContacts.map((contact) => (
                      <td key={contact.id} className="px-4 py-3">
                        <label className="flex items-center justify-center cursor-pointer">
                          <input
                            type="radio"
                            name={`field_${field}`}
                            checked={selectedFields[field] === contact.id}
                            onChange={() => handleFieldSelect(field, contact.id)}
                            className="mr-2"
                          />
                          <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                            {getContactValue(contact, field)}
                          </span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
              {t('admin.clients.merge_modal.cancel')}
            </button>
            <button
              onClick={handleMerge}
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('admin.clients.merge_modal.merging')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t('admin.clients.merge_modal.merge')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
