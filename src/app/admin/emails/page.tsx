'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  AlertCircle,
  Mail,
  Search,
  Calendar,
  RefreshCw,
  ArrowLeft,
  Filter
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBranches } from '@/hooks/useBranches'
import { useEmails } from '@/hooks/useEmails'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { EmailsTable } from './components/EmailsTable'
import { createClient } from '@/lib/supabase/client'

export default function EmailsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { branches, selectedBranch, selectBranch, loading: branchesLoading } = useBranches()

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('admin_theme', newTheme)
  }

  const isDark = theme === 'dark'

  // Get user role
  const userRole = user?.role || 'agent'

  // Emails hook
  const {
    emails,
    loading: emailsLoading,
    error,
    pagination,
    filters,
    setFilters,
    setPage,
    refresh,
    resendEmail,
    deleteEmail,
    stats
  } = useEmails(userRole === 'super_admin' ? undefined : selectedBranch?.id)

  // Local filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Apply filters with debounce for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({
        ...filters,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        branchId: userRole === 'super_admin' ? undefined : selectedBranch?.id
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, statusFilter, dateFrom, dateTo, selectedBranch?.id, userRole])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/admin/login')
    }
  }, [user, authLoading, router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // Loading state
  if (authLoading || branchesLoading || !user || !selectedBranch) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  const handleResend = async (emailId: string) => {
    const result = await resendEmail(emailId)
    if (!result.success) {
      alert(result.error || t('admin.emails.resend_error'))
    }
  }

  const handleDelete = async (emailId: string) => {
    if (confirm(t('admin.emails.delete_confirm'))) {
      const result = await deleteEmail(emailId)
      if (!result.success) {
        alert(result.error || t('admin.emails.delete_error'))
      }
    }
  }

  // Check email status from Brevo API (polling)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const handleCheckStatus = async () => {
    setCheckingStatus(true)
    try {
      const response = await fetch('/api/cron/check-email-status')
      const data = await response.json()
      console.log('[Email Status Check]', data)
      // Refresh the list to show updated statuses
      await refresh()
    } catch (err) {
      console.error('Error checking email status:', err)
    } finally {
      setCheckingStatus(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header */}
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchSelect={selectBranch}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Sub-header with title */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={() => router.push('/admin/orders')}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-purple-500/20' : 'bg-purple-100'
            }`}>
              <Mail className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.emails.title')}
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.emails.subtitle')}
              </p>
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-4">
            <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
              <div className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                {t('admin.emails.stats.sent')}
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                {stats.sent}
              </div>
            </div>
            <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <div className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {t('admin.emails.stats.failed')}
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {stats.failed}
              </div>
            </div>
            <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.emails.stats.total')}
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.total}
              </div>
            </div>

            {/* Check Brevo status button */}
            <button
              onClick={handleCheckStatus}
              disabled={checkingStatus || emailsLoading}
              title={t('admin.emails.check_status')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
              <span className="text-sm">{checkingStatus ? t('admin.emails.checking') : t('admin.emails.check_status')}</span>
            </button>

            {/* Refresh button */}
            <button
              onClick={refresh}
              disabled={emailsLoading}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-5 h-5 ${emailsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-3`}>
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder={t('admin.emails.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-purple-500`}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-gray-50 border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-purple-500`}
          >
            <option value="">{t('admin.emails.filter.all_status')}</option>
            <option value="sent">{t('admin.emails.status.sent')}</option>
            <option value="delivered">{t('admin.emails.status.delivered')}</option>
            <option value="failed">{t('admin.emails.status.failed')}</option>
            <option value="pending">{t('admin.emails.status.pending')}</option>
            <option value="bounced">{t('admin.emails.status.bounced')}</option>
          </select>

          {/* Toggle filters button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            {t('admin.emails.filter.more')}
          </button>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-600 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
              />
              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* Error */}
        {error && (
          <div className={`p-4 rounded-lg border flex items-start gap-2 ${
            isDark
              ? 'bg-red-500/10 border-red-500/50 text-red-400'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {emailsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        )}

        {/* Table */}
        {!emailsLoading && (
          <EmailsTable
            emails={emails}
            isDark={isDark}
            pagination={pagination}
            onPageChange={setPage}
            onResend={handleResend}
            onDelete={userRole === 'super_admin' ? handleDelete : undefined}
          />
        )}
      </div>
    </div>
  )
}
