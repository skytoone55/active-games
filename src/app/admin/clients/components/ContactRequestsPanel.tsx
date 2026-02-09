'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Mail, MailOpen, UserPlus, Clock, Loader2, Filter, Eye } from 'lucide-react'
import { useContactRequests, notifyContactRequestsChanged } from '@/hooks/useContactRequests'
import { useTranslation } from '@/contexts/LanguageContext'
import type { ContactRequest } from '@/lib/supabase/types'

interface ContactRequestsPanelProps {
  branchId: string
  isDark: boolean
  onContactCreated?: () => void
}

type FilterStatus = 'all' | 'unread' | 'read'

export function ContactRequestsPanel({ branchId, isDark, onContactCreated }: ContactRequestsPanelProps) {
  const { t, locale } = useTranslation()
  const {
    requests,
    loading,
    total,
    totalPages,
    fetchRequests,
    markAsRead,
    createContactFromRequest,
  } = useContactRequests(branchId)

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('unread')
  const [page, setPage] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }

  const loadRequests = useCallback(() => {
    fetchRequests({ status: filterStatus, page, pageSize: 20 })
  }, [fetchRequests, filterStatus, page])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleMarkAsRead = async (id: string) => {
    setActionLoading(id)
    const success = await markAsRead(id)
    if (success) {
      // Update selected if open
      if (selectedRequest?.id === id) {
        setSelectedRequest(prev => prev ? { ...prev, is_read: true, read_at: new Date().toISOString() } : null)
      }
      // Notifier le header pour mise à jour instantanée du badge
      notifyContactRequestsChanged()
    }
    setActionLoading(null)
  }

  const handleCreateContact = async (requestId: string) => {
    // Empêcher le double-clic : vérifier si un contact existe déjà
    const req = requests.find(r => r.id === requestId) || selectedRequest
    if (req?.contact_id) return

    setActionLoading(requestId)
    const success = await createContactFromRequest(requestId, branchId)
    if (success) {
      // Mettre à jour le selectedRequest avec contact_id pour cacher le bouton
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(prev => prev ? { ...prev, is_read: true, read_at: new Date().toISOString(), contact_id: 'created' } : null)
      }
      // Notifier le header pour mise à jour instantanée du badge
      notifyContactRequestsChanged()
      onContactCreated?.()
    }
    setActionLoading(null)
  }

  // Detail view
  if (selectedRequest) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          onClick={() => setSelectedRequest(null)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
            isDark
              ? 'hover:bg-gray-700 text-gray-300'
              : 'hover:bg-gray-200 text-gray-600'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('admin.contact_requests.back_to_list')}
        </button>

        {/* Detail card */}
        <div className={`rounded-lg border p-6 space-y-4 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 text-xs rounded-full font-medium ${
              selectedRequest.is_read
                ? isDark ? 'bg-green-600/20 text-green-400' : 'bg-green-100 text-green-700'
                : isDark ? 'bg-orange-600/20 text-orange-400' : 'bg-orange-100 text-orange-700'
            }`}>
              {selectedRequest.is_read
                ? t('admin.contact_requests.status.read')
                : t('admin.contact_requests.status.unread')}
            </span>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {new Date(selectedRequest.created_at).toLocaleDateString(getDateLocale(), {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.contact_requests.detail.name')}
              </label>
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {selectedRequest.name}
              </p>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.contact_requests.detail.email')}
              </label>
              <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {selectedRequest.email}
              </p>
            </div>
            {selectedRequest.phone && (
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('admin.contact_requests.detail.phone')}
                </label>
                <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {selectedRequest.phone}
                </p>
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('admin.contact_requests.detail.message')}
            </label>
            <div className={`p-4 rounded-lg whitespace-pre-wrap ${
              isDark ? 'bg-gray-700/50 text-gray-200' : 'bg-gray-50 text-gray-800'
            }`}>
              {selectedRequest.message}
            </div>
          </div>

          {/* Read info */}
          {selectedRequest.is_read && selectedRequest.read_at && (
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('admin.contact_requests.detail.treated_at')}: {new Date(selectedRequest.read_at).toLocaleDateString(getDateLocale(), {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-700">
            {!selectedRequest.is_read && (
              <button
                onClick={() => handleMarkAsRead(selectedRequest.id)}
                disabled={actionLoading === selectedRequest.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                {actionLoading === selectedRequest.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MailOpen className="w-4 h-4" />
                )}
                {t('admin.contact_requests.mark_as_read')}
              </button>
            )}
            {!selectedRequest.contact_id && (
              <button
                onClick={() => handleCreateContact(selectedRequest.id)}
                disabled={actionLoading === selectedRequest.id}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                {actionLoading === selectedRequest.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {t('admin.contact_requests.create_contact')}
              </button>
            )}
            {selectedRequest.contact_id && (
              <span className={`text-sm flex items-center gap-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                ✓ {t('admin.contact_requests.contact_created')}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('admin.contact_requests.title')}
          {total > 0 && (
            <span className={`ml-2 text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              ({total})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <Filter className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          {(['all', 'unread', 'read'] as const).map((status) => (
            <button
              key={status}
              onClick={() => { setFilterStatus(status); setPage(1) }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t(`admin.contact_requests.filter.${status}`)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          {t('admin.contact_requests.empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <div
              key={request.id}
              onClick={() => setSelectedRequest(request)}
              className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                !request.is_read
                  ? isDark
                    ? 'bg-gray-800 border-blue-500/30 hover:border-blue-500/50'
                    : 'bg-blue-50/50 border-blue-200 hover:border-blue-300'
                  : isDark
                    ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!request.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <span className={`font-medium truncate ${
                      isDark ? 'text-white' : 'text-gray-900'
                    } ${!request.is_read ? 'font-semibold' : ''}`}>
                      {request.name}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      &lt;{request.email}&gt;
                    </span>
                  </div>
                  <p className={`text-sm truncate ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {request.message}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className={`w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                      {new Date(request.created_at).toLocaleDateString(getDateLocale(), {
                        day: 'numeric', month: 'short'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!request.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkAsRead(request.id) }}
                        disabled={actionLoading === request.id}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        }`}
                        title={t('admin.contact_requests.mark_as_read')}
                      >
                        {actionLoading === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        ) : (
                          <MailOpen className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedRequest(request) }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      <Eye className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`px-3 py-1 text-sm rounded disabled:opacity-50 ${
              isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            ←
          </button>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`px-3 py-1 text-sm rounded disabled:opacity-50 ${
              isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
