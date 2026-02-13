'use client'

import { useState } from 'react'
import {
  Mail,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import type { EmailLog } from '@/lib/supabase/types'

interface EmailsTableProps {
  emails: EmailLog[]
  isDark: boolean
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  onPageChange: (page: number) => void
  onResend: (emailId: string) => void
  onDelete?: (emailId: string) => void
}

export function EmailsTable({
  emails,
  isDark,
  pagination,
  onPageChange,
  onResend,
  onDelete
}: EmailsTableProps) {
  const { t } = useTranslation()
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null)
  const [resending, setResending] = useState<string | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'failed':
      case 'bounced':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClass = 'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1'
    switch (status) {
      case 'sent':
        return `${baseClass} ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`
      case 'delivered':
        return `${baseClass} ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`
      case 'failed':
        return `${baseClass} ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`
      case 'bounced':
        return `${baseClass} ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'}`
      case 'pending':
        return `${baseClass} ${isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`
      default:
        return `${baseClass} ${isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700'}`
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleResend = async (emailId: string) => {
    setResending(emailId)
    await onResend(emailId)
    setResending(null)
  }

  if (emails.length === 0) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{t('admin.emails.no_emails')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className={`rounded-lg border overflow-hidden ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <table className="w-full">
          <thead>
            <tr className={isDark ? 'bg-gray-900/50' : 'bg-gray-50'}>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.emails.table.status')}
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.emails.table.recipient')}
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.emails.table.subject')}
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.emails.table.date')}
              </th>
              <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.emails.table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {emails.map((email) => (
              <tr
                key={email.id}
                className={`transition-colors ${
                  isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Status */}
                <td className="px-4 py-3">
                  <span className={getStatusBadge(email.status)}>
                    {getStatusIcon(email.status)}
                    {t(`admin.emails.status.${email.status}`)}
                  </span>
                </td>

                {/* Recipient */}
                <td className="px-4 py-3">
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {email.recipient_name || '-'}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {email.recipient_email}
                    </p>
                  </div>
                </td>

                {/* Subject */}
                <td className="px-4 py-3">
                  <p className={`${isDark ? 'text-white' : 'text-gray-900'} max-w-xs truncate`}>
                    {email.subject}
                  </p>
                  {email.template_code && (
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Template: {email.template_code}
                    </p>
                  )}
                </td>

                {/* Date */}
                <td className="px-4 py-3">
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {formatDate(email.created_at)}
                  </p>
                  {email.sent_at && email.sent_at !== email.created_at && (
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.emails.table.sent_at')}: {formatDate(email.sent_at)}
                    </p>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {/* View details */}
                    <button
                      onClick={() => setSelectedEmail(email)}
                      className={`p-1.5 rounded transition-colors ${
                        isDark
                          ? 'hover:bg-gray-600 text-gray-400 hover:text-white'
                          : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                      }`}
                      title={t('admin.emails.view_details') || 'Voir'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Resend */}
                    <button
                      onClick={() => handleResend(email.id)}
                      disabled={resending === email.id}
                      className={`p-1.5 rounded transition-colors ${
                        isDark
                          ? 'hover:bg-blue-600/50 text-blue-400 hover:text-blue-300 disabled:opacity-50'
                          : 'hover:bg-blue-100 text-blue-500 hover:text-blue-700 disabled:opacity-50'
                      }`}
                      title={t('admin.emails.resend') || 'Renvoyer'}
                    >
                      {resending === email.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>

                    {/* Delete (super_admin only) */}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(email.id)}
                        className={`p-1.5 rounded transition-colors ${
                          isDark
                            ? 'hover:bg-red-600/50 text-red-400 hover:text-red-300'
                            : 'hover:bg-red-100 text-red-500 hover:text-red-700'
                        }`}
                        title={t('admin.emails.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('admin.emails.pagination.showing', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total
            })}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:bg-gray-800 disabled:text-gray-600'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className={`px-3 py-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {pagination.page} / {pagination.totalPages}
            </span>

            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:bg-gray-800 disabled:text-gray-600'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Email details modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedEmail(null)}
          />
          <div className={`relative w-full max-w-lg rounded-xl p-6 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.emails.details_title')}
            </h3>

            <div className="space-y-3">
              <div>
                <label className={`text-xs uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('admin.emails.table.status')}
                </label>
                <p className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span className={getStatusBadge(selectedEmail.status)}>
                    {getStatusIcon(selectedEmail.status)}
                    {t(`admin.emails.status.${selectedEmail.status}`)}
                  </span>
                </p>
              </div>

              <div>
                <label className={`text-xs uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('admin.emails.table.recipient')}
                </label>
                <p className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedEmail.recipient_name} &lt;{selectedEmail.recipient_email}&gt;
                </p>
              </div>

              <div>
                <label className={`text-xs uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('admin.emails.table.subject')}
                </label>
                <p className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedEmail.subject}
                </p>
              </div>

              {selectedEmail.body_html && (
                <div>
                  <label className={`text-xs uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {t('admin.emails.preview')}
                  </label>
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-600">
                    <iframe
                      srcDoc={selectedEmail.body_html}
                      className="w-full h-80 bg-white"
                      title="Email preview"
                    />
                  </div>
                </div>
              )}

              {selectedEmail.error_message && (
                <div>
                  <label className={`text-xs uppercase text-red-500`}>
                    {t('admin.emails.error')}
                  </label>
                  <p className={`mt-1 text-sm text-red-400`}>
                    {selectedEmail.error_message}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {t('admin.emails.created_at')}
                  </label>
                  <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {formatDate(selectedEmail.created_at)}
                  </p>
                </div>
                {selectedEmail.sent_at && (
                  <div>
                    <label className={`text-xs uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.emails.sent_at')}
                    </label>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {formatDate(selectedEmail.sent_at)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedEmail(null)}
                className={`px-4 py-2 rounded-lg ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('admin.common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
