'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Phone, PhoneIncoming, PhoneOutgoing, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalls, type SearchCallsResult } from '@/hooks/useCalls'
import { useBranches } from '@/hooks/useBranches'
import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { CustomSelect } from '../components/CustomSelect'
import type { Call, CallStatus, CallDirection } from '@/lib/supabase/types'

export default function CallsPage() {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const { hasPermission, loading: permissionsLoading } = useUserPermissions(user?.role || null)

  const { branches, selectedBranch, selectBranch, loading: branchesLoading } = useBranches()
  const { searchCalls } = useCalls(selectedBranch?.id || null)

  const [searchQuery, setSearchQuery] = useState('')
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState<'all' | CallStatus>('all')
  const [filterDirection, setFilterDirection] = useState<'all' | CallDirection>('all')

  const pageSize = 20

  // Thème (pour correspondre au pattern des autres pages)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('admin_theme', newTheme)
    setTheme(newTheme)
  }

  const isDark = theme === 'dark'

  // Branche effective
  const effectiveSelectedBranch = selectedBranch || (branches.length > 0 ? branches[0] : null)

  // Rechercher les appels
  const performSearch = useCallback(async () => {
    const branchToUse = selectedBranch || (branches.length > 0 ? branches[0] : null)
    if (!branchToUse?.id) return

    setLoading(true)
    try {
      const result: SearchCallsResult = await searchCalls({
        query: searchQuery.trim() || undefined,
        branchId: branchToUse.id,
        status: filterStatus,
        direction: filterDirection,
        page,
        pageSize,
      })

      setCalls(result.calls)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error('Error searching calls:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedBranch, branches, searchCalls, searchQuery, filterStatus, filterDirection, page, pageSize])

  useEffect(() => {
    if (effectiveSelectedBranch?.id) {
      performSearch()
    }
  }, [performSearch, effectiveSelectedBranch?.id])

  // Gestion de la pagination
  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1)
    }
  }

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1)
    }
  }

  // Handler pour la déconnexion
  const handleSignOut = async () => {
    await signOut()
    router.push('/admin/login')
  }

  // Loading state
  if (authLoading || branchesLoading || permissionsLoading || !user || !effectiveSelectedBranch) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : locale === 'en' ? 'en-US' : 'fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={effectiveSelectedBranch}
        onBranchSelect={selectBranch}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Phone className="inline-block w-8 h-8 mr-2 mb-1" />
            {t('admin.header.calls') || 'Appels'}
          </h1>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Gestion des appels téléphoniques
          </p>
        </div>

        {/* Barre de recherche et filtres */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-4 mb-6`}>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Recherche */}
            <div className="flex-1">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  type="text"
                  placeholder="Rechercher par numéro..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      setPage(1)
                      performSearch()
                    }
                  }}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
            </div>

            {/* Filtre statut */}
            <div className="flex flex-col gap-1">
              <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Statut
              </label>
              <CustomSelect
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'completed', label: 'Terminés' },
                  { value: 'missed', label: 'Manqués' },
                  { value: 'no-answer', label: 'Sans réponse' },
                ]}
                value={filterStatus}
                onChange={(value) => setFilterStatus(value as 'all' | CallStatus)}
                isDark={isDark}
              />
            </div>

            {/* Filtre direction */}
            <div className="flex flex-col gap-1">
              <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Direction
              </label>
              <CustomSelect
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'inbound', label: 'Entrants' },
                  { value: 'outbound', label: 'Sortants' },
                ]}
                value={filterDirection}
                onChange={(value) => setFilterDirection(value as 'all' | CallDirection)}
                isDark={isDark}
              />
            </div>
          </div>
        </div>

        {/* Table des appels */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : calls.length === 0 ? (
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-12 text-center`}>
            <Phone className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Aucun appel trouvé
            </p>
          </div>
        ) : (
          <>
            <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      Direction
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      Numéro
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      Statut
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      Durée
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y ${
                  isDark ? 'divide-gray-700' : 'divide-gray-200'
                }`}>
                  {calls.map((call) => (
                    <tr key={call.id} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="w-5 h-5 text-green-500" />
                        ) : (
                          <PhoneOutgoing className="w-5 h-5 text-blue-500" />
                        )}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                        {call.direction === 'inbound' ? call.from_number : call.to_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          call.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : call.status === 'missed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {call.status}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                        {formatDuration(call.duration_seconds)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                        {formatDate(call.started_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={`mt-4 flex items-center justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <div>
                Affichage de {(page - 1) * pageSize + 1} à {Math.min(page * pageSize, total)} sur {total} appels
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={page === 1}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    page === 1
                      ? isDark
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Précédent
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={page === totalPages}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    page === totalPages
                      ? isDark
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
