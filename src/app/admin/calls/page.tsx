'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Phone, PhoneIncoming, PhoneOutgoing, Loader2, ChevronLeft, ChevronRight, RefreshCw, Play, Download, User, ArrowUpDown } from 'lucide-react'
import { useCalls, type SearchCallsResult } from '@/hooks/useCalls'
import { useBranches } from '@/hooks/useBranches'
import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { CustomSelect } from '../components/CustomSelect'
import { ContactDetailsModal } from '../components/ContactDetailsModal'
import type { Call, CallStatus, CallDirection, Contact } from '@/lib/supabase/types'

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
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [pageSize, setPageSize] = useState(20)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'started_at' | 'duration_seconds'>('started_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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
        status: 'all',
        direction: 'all',
        page,
        pageSize,
      })

      // Tri local des résultats
      const sortedCalls = [...result.calls].sort((a: any, b: any) => {
        if (sortBy === 'started_at') {
          const dateA = new Date(a.started_at).getTime()
          const dateB = new Date(b.started_at).getTime()
          return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
        } else {
          return sortOrder === 'desc'
            ? b.duration_seconds - a.duration_seconds
            : a.duration_seconds - b.duration_seconds
        }
      })

      setCalls(sortedCalls)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error('Error searching calls:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedBranch, branches, searchCalls, searchQuery, page, pageSize, sortBy, sortOrder])

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

  // Format date only
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : locale === 'en' ? 'en-US' : 'fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }

  // Format time only
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : locale === 'en' ? 'en-US' : 'fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  // Gérer le tri
  const handleSort = (column: 'started_at' | 'duration_seconds') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  // Synchroniser les appels depuis Telnyx CDR
  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const response = await fetch('/api/calls/sync', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        setSyncMessage({
          type: 'success',
          text: `✅ ${data.imported} appels importés, ${data.skipped} ignorés (déjà présents)`
        })
        // Rafraîchir la liste
        await performSearch()
      } else {
        setSyncMessage({
          type: 'error',
          text: `❌ Erreur: ${data.error}`
        })
      }
    } catch (error) {
      setSyncMessage({
        type: 'error',
        text: `❌ Erreur de synchronisation`
      })
    } finally {
      setSyncing(false)
      // Effacer le message après 5 secondes
      setTimeout(() => setSyncMessage(null), 5000)
    }
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Phone className="inline-block w-8 h-8 mr-2 mb-1" />
              {t('admin.header.calls') || 'Appels'}
            </h1>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Gestion des appels téléphoniques
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              syncing
                ? 'bg-gray-400 cursor-not-allowed'
                : isDark
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>
        </div>

        {/* Message de sync */}
        {syncMessage && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              syncMessage.type === 'success'
                ? isDark
                  ? 'bg-green-900/50 text-green-200'
                  : 'bg-green-100 text-green-800'
                : isDark
                  ? 'bg-red-900/50 text-red-200'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {syncMessage.text}
          </div>
        )}

        {/* Barre de recherche et lignes par page */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-4 mb-6`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recherche */}
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
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>

            {/* Lignes par page */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Lignes par page
              </label>
              <CustomSelect
                options={[
                  { value: '10', label: '10' },
                  { value: '20', label: '20' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' },
                ]}
                value={String(pageSize)}
                onChange={(value) => {
                  setPageSize(parseInt(value))
                  setPage(1)
                }}
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
                      Contact
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      Statut
                    </th>
                    <th
                      onClick={() => handleSort('duration_seconds')}
                      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600 ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        Durée
                        {sortBy === 'duration_seconds' && <ArrowUpDown className="w-3 h-3" />}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('started_at')}
                      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600 ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortBy === 'started_at' && <ArrowUpDown className="w-3 h-3" />}
                      </div>
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      Heure
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      Audio
                    </th>
                  </tr>
                </thead>
                <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y ${
                  isDark ? 'divide-gray-700' : 'divide-gray-200'
                }`}>
                  {calls.map((call: any) => (
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
                        {call.contact ? (
                          <button
                            onClick={() => {
                              setSelectedContactId(call.contact.id)
                              setContactModalOpen(true)
                            }}
                            className={`flex items-center gap-2 hover:underline ${
                              isDark ? 'text-blue-400' : 'text-blue-600'
                            }`}
                          >
                            <User className="w-4 h-4" />
                            {call.contact.first_name} {call.contact.last_name}
                          </button>
                        ) : (
                          <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
                        )}
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
                      <td className={`px-6 py-4 whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                        {formatTime(call.started_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {call.recording_url ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => window.open(call.recording_url, '_blank')}
                              className={`p-2 rounded-lg transition-colors ${
                                isDark
                                  ? 'bg-green-900/50 hover:bg-green-800 text-green-400'
                                  : 'bg-green-100 hover:bg-green-200 text-green-700'
                              }`}
                              title="Écouter"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <a
                              href={call.recording_url}
                              download
                              className={`p-2 rounded-lg transition-colors ${
                                isDark
                                  ? 'bg-blue-900/50 hover:bg-blue-800 text-blue-400'
                                  : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                              }`}
                              title="Télécharger"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        ) : (
                          <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
                        )}
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

      {/* Modal de détails du contact */}
      {contactModalOpen && selectedContactId && (
        <ContactDetailsModal
          contactId={selectedContactId}
          onClose={() => {
            setContactModalOpen(false)
            setSelectedContactId(null)
          }}
          isDark={isDark}
        />
      )}
    </div>
  )
}
