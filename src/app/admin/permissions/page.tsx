'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useBranches } from '@/hooks/useBranches'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { PermissionsTable } from './components/PermissionsTable'
import { createClient } from '@/lib/supabase/client'

export default function PermissionsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { branches, selectedBranch, selectBranch, loading: branchesLoading } = useBranches()
  const { permissions, loading: permissionsLoading, error, savePermissions } = usePermissions()

  // Theme state (synced with localStorage)
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

  // Check permissions - only super_admin can access
  if (user && user.role !== 'super_admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('admin.permissions.access_denied')}
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {t('admin.permissions.access_denied_message')}
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

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header with navigation */}
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
              isDark ? 'bg-red-500/20' : 'bg-red-100'
            }`}>
              <Lock className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.permissions.title')}
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.permissions.subtitle')}
              </p>
            </div>
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
        {permissionsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Permissions Table */}
        {!permissionsLoading && (
          <PermissionsTable
            permissions={permissions}
            isDark={isDark}
            onSavePermissions={savePermissions}
          />
        )}

        {/* Legend */}
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {t('admin.permissions.legend_title')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
              }`}>
                {t('admin.roles.super_admin')}
              </span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {t('admin.permissions.legend_super_admin')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-800'
              }`}>
                {t('admin.roles.branch_admin')}
              </span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {t('admin.permissions.legend_branch_admin')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'
              }`}>
                {t('admin.roles.agent')}
              </span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {t('admin.permissions.legend_agent')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {t('admin.permissions.legend_locked')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
