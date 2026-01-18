'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, FileText, Calendar, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBranches } from '@/hooks/useBranches'
import { useLogs } from '@/hooks/useLogs'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { LogsTable } from './components/LogsTable'
import { createClient } from '@/lib/supabase/client'

export default function LogsPage() {
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

  // Get user role for logs hook
  const userRole = user?.role || 'agent'

  // Logs hook - pass branchId only for non-super_admin
  const { logs, loading: logsLoading, error, stats, deleteLogs, refresh } = useLogs(
    userRole === 'super_admin' ? null : selectedBranch?.id || null,
    userRole
  )

  // Date filters
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

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

  // Check permissions - only super_admin and branch_admin can view logs
  if (user && user.role !== 'super_admin' && user.role !== 'branch_admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('admin.logs.access_denied')}
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {t('admin.logs.access_denied_message')}
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (authLoading || branchesLoading || !user || !selectedBranch) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  // Filter logs by search term
  const filteredLogs = searchTerm
    ? logs.filter(log =>
        log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.target_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action_type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs

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
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'
            }`}>
              <FileText className={`w-6 h-6 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.logs.title')}
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.logs.subtitle')}
              </p>
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-4">
            <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.logs.stats.today')}
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.today}
              </div>
            </div>
            <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.logs.stats.this_week')}
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.thisWeek}
              </div>
            </div>
            <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.logs.stats.total')}
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and date filters */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-3`}>
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder={t('admin.logs.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Date filters */}
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
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>
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
        {logsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Table */}
        {!logsLoading && (
          <LogsTable
            logs={filteredLogs}
            isDark={isDark}
            currentUserRole={user.role || 'agent'}
            onDeleteLogs={user.role === 'super_admin' ? deleteLogs : undefined}
          />
        )}
      </div>
    </div>
  )
}
