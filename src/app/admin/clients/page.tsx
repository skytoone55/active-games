'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Edit2, Archive, User, Phone, Mail, Loader2, Eye, Calendar, Gamepad2, PartyPopper, ChevronLeft, ChevronRight, X, Plus, Download, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, Users as UsersIcon, Clock, GitMerge, Settings, Zap, Target } from 'lucide-react'
import { useContacts, type SearchContactsResult } from '@/hooks/useContacts'
import { useBranches } from '@/hooks/useBranches'
import { useAuth } from '@/hooks/useAuth'
import { AdminHeader } from '../components/AdminHeader'
import { ClientModal } from './components/ClientModal'
import { MergeContactsModal } from './components/MergeContactsModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { CustomSelect } from '../components/CustomSelect'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/lib/supabase/types'

export default function ClientsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { branches, selectedBranch, selectBranch } = useBranches()
  const { searchContacts, archiveContact, unarchiveContact, getLinkedBookings, getContactStats } = useContacts(selectedBranch?.id || null)

  const [searchQuery, setSearchQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [linkedBookings, setLinkedBookings] = useState<any[]>([])
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [contactStats, setContactStats] = useState<any>(null)
  const [sortField, setSortField] = useState<'name' | 'created_at' | 'last_activity'>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [duplicatesToMerge, setDuplicatesToMerge] = useState<Contact[]>([])
  const [showMergeModal, setShowMergeModal] = useState(false)
  
  // Modal de confirmation
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type?: 'warning' | 'info' | 'success'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  })
  
  // Filtres avancés
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('all')
  const [filterSource, setFilterSource] = useState<'all' | 'admin_agenda' | 'public_booking'>('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const pageSize = 20

  // Rechercher les contacts
  const performSearch = useCallback(async () => {
    if (!selectedBranch?.id) return

    setLoading(true)
    try {
      const result: SearchContactsResult = await searchContacts({
        query: searchQuery.trim() || undefined,
        branchId: selectedBranch.id,
        includeArchived: filterStatus === 'all' ? includeArchived : filterStatus === 'archived',
        status: filterStatus === 'all' ? undefined : filterStatus,
        source: filterSource === 'all' ? undefined : filterSource,
        page,
        pageSize,
      })

      // Appliquer le tri côté client
      let sortedContacts = [...result.contacts]
      if (sortField === 'name') {
        sortedContacts.sort((a, b) => {
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase() || a.phone
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase() || b.phone
          return sortDirection === 'asc' 
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA)
        })
      } else if (sortField === 'created_at') {
        sortedContacts.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
        })
      }

      setContacts(sortedContacts)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (error) {
      console.error('Error searching contacts:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, includeArchived, page, selectedBranch?.id, sortField, sortDirection, filterStatus, filterSource])

  useEffect(() => {
    if (selectedBranch?.id) {
      performSearch()
    }
  }, [performSearch, selectedBranch?.id])

  // Gérer l'archivage
  const handleArchive = (contact: Contact) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Archiver le contact',
      message: `Êtes-vous sûr de vouloir archiver le contact ${contact.first_name} ${contact.last_name || ''} ?`,
      type: 'warning',
      onConfirm: async () => {
        const success = await archiveContact(contact.id)
        if (success) {
          await performSearch()
        }
      },
    })
  }

  // Gérer la restauration
  const handleUnarchive = async (contact: Contact) => {
    const success = await unarchiveContact(contact.id)
    if (success) {
      await performSearch()
    }
  }

  // Ouvrir les détails
  const handleViewDetails = async (contact: Contact) => {
    setSelectedContact(contact)
    setShowDetailsModal(true)
    
    // Charger les réservations liées et stats
    setLoadingBookings(true)
    const [bookings, stats] = await Promise.all([
      getLinkedBookings(contact.id),
      getContactStats(contact.id),
    ])
    setLinkedBookings(bookings || [])
    setContactStats(stats)
    setLoadingBookings(false)
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Prénom', 'Nom', 'Téléphone', 'Email', 'Notes', 'Source', 'Statut', 'Créé le', 'Dernière mise à jour']
    const rows = contacts.map(contact => [
      contact.first_name || '',
      contact.last_name || '',
      contact.phone || '',
      contact.email || '',
      contact.notes_client || '',
      contact.source === 'admin_agenda' ? 'Agenda' : 'Public',
      contact.status === 'active' ? 'Actif' : 'Archivé',
      new Date(contact.created_at).toLocaleDateString('fr-FR'),
      new Date(contact.updated_at).toLocaleDateString('fr-FR'),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `clients_${selectedBranch?.name || 'export'}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Tri
  const handleSort = (field: 'name' | 'created_at' | 'last_activity') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: 'name' | 'created_at' | 'last_activity') => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
  }

  // Ouvrir modal création/édition
  const handleOpenEditModal = (contact: Contact | null = null) => {
    setEditingContact(contact)
    setShowClientModal(true)
  }

  // Fermer modal et rafraîchir
  const handleCloseClientModal = () => {
    setShowClientModal(false)
    setEditingContact(null)
    performSearch()
  }

  const getDisplayName = (contact: Contact) => {
    const parts = [contact.first_name, contact.last_name].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : contact.phone
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // Gérer le thème (synchronisé avec localStorage)
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

  if (!user || !selectedBranch) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header avec navigation */}
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchSelect={selectBranch}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Sous-header avec titre et actions */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>Gestion des Clients</h1>
            <span className={`px-3 py-1 text-sm rounded-full ${
              isDark
                ? 'bg-blue-600/20 text-blue-400'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {selectedBranch.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const duplicates: Contact[] = []
                const seen = new Set<string>()
                contacts.forEach(contact => {
                  const key = contact.phone || contact.email || ''
                  if (key && seen.has(key)) {
                    const first = contacts.find(c => (c.phone === key || c.email === key) && !duplicates.includes(c))
                    if (first && !duplicates.includes(first)) duplicates.push(first)
                    if (!duplicates.includes(contact)) duplicates.push(contact)
                  } else if (key) seen.add(key)
                })
                if (duplicates.length >= 2) {
                  setDuplicatesToMerge(duplicates)
                  setShowMergeModal(true)
                } else {
                  setConfirmationModal({
                    isOpen: true,
                    title: 'Aucun doublon',
                    message: 'Aucun doublon trouvé dans les contacts affichés.',
                    type: 'info',
                    onConfirm: () => {
                      setConfirmationModal({ ...confirmationModal, isOpen: false })
                    },
                  })
                }
              }}
              disabled={contacts.length < 2}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GitMerge className="w-4 h-4" />
              Détecter doublons
            </button>
            <button
              onClick={handleExportCSV}
              disabled={contacts.length === 0}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => handleOpenEditModal(null)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouveau contact
            </button>
          </div>
        </div>
      </div>

      {/* Recherche et filtres */}
      <div className={`px-6 py-4 border-b ${
        isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Rechercher par nom, téléphone, email..."
              className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked)
                setPage(1)
              }}
              className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-500 ${
                isDark
                  ? 'border-gray-600 bg-gray-700'
                  : 'border-gray-300 bg-white'
              }`}
            />
            <span className={`text-sm ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>Inclure les archivés</span>
          </label>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Filtres avancés</span>
          </button>
        </div>
      </div>

      {/* Filtres avancés */}
      {showAdvancedFilters && (
        <div className={`px-6 py-4 border-b ${
          isDark ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50/50 border-gray-200'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Statut */}
            <div>
              <label className={`block text-sm mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>Statut</label>
              <CustomSelect
                value={filterStatus}
                onChange={(value) => {
                  setFilterStatus(value as any)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'active', label: 'Actifs' },
                  { value: 'archived', label: 'Archivés' },
                ]}
                placeholder="Sélectionner un statut"
                isDark={isDark}
              />
            </div>

            {/* Source */}
            <div>
              <label className={`block text-sm mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>Source</label>
              <CustomSelect
                value={filterSource}
                onChange={(value) => {
                  setFilterSource(value as any)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Toutes' },
                  { value: 'admin_agenda', label: 'Admin Agenda' },
                  { value: 'public_booking', label: 'Réservation publique' },
                ]}
                placeholder="Sélectionner une source"
                isDark={isDark}
              />
            </div>
          </div>
          {(filterStatus !== 'all' || filterSource !== 'all') && (
            <button
              onClick={() => {
                setFilterStatus('all')
                setFilterSource('all')
                setPage(1)
              }}
              className={`mt-4 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <X className="w-4 h-4" />
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Tableau */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : contacts.length === 0 ? (
          <div className={`text-center py-12 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Aucun contact trouvé
          </div>
        ) : (
          <>
            <div className={`rounded-lg border overflow-hidden ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <table className="w-full">
                <thead className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                  <tr>
                    <th 
                      className={`px-4 py-3 text-left text-sm font-medium cursor-pointer transition-colors ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Nom
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Téléphone</th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Email</th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Notes</th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Source</th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Statut</th>
                    <th 
                      className={`px-4 py-3 text-left text-sm font-medium cursor-pointer transition-colors ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center">
                        Créé le
                        {getSortIcon('created_at')}
                      </div>
                    </th>
                    <th className={`px-4 py-3 text-right text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  isDark ? 'divide-gray-700' : 'divide-gray-200'
                }`}>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className={`transition-colors ${
                      isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <span className={`font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>{getDisplayName(contact)}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>{contact.phone}</td>
                      <td className={`px-4 py-3 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>{contact.email || '-'}</td>
                      <td className={`px-4 py-3 max-w-xs ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {contact.notes_client ? (
                          <div className="truncate" title={contact.notes_client}>
                            {contact.notes_client}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          isDark
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {contact.source === 'admin_agenda' ? 'Agenda' : 'Public'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {contact.status === 'archived' ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-600/20 text-yellow-400">
                            Archivé
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-600/20 text-green-400">
                            Actif
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {new Date(contact.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetails(contact)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            }`}
                            title="Voir détails"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(contact)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            }`}
                            title="Modifier"
                          >
                            <Edit2 className={`w-4 h-4 ${
                              isDark ? 'text-gray-400' : 'text-gray-600'
                            }`} />
                          </button>
                          {contact.status === 'archived' ? (
                            <button
                              onClick={() => handleUnarchive(contact)}
                              className={`p-2 rounded-lg transition-colors ${
                                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              }`}
                              title="Restaurer"
                            >
                              <Archive className="w-4 h-4 text-green-400" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchive(contact)}
                              className={`p-2 rounded-lg transition-colors ${
                                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              }`}
                              title="Archiver"
                            >
                              <Archive className="w-4 h-4 text-yellow-400" />
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Page {page} sur {totalPages} ({total} contact{total !== 1 ? 's' : ''})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={`px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      isDark
                        ? 'bg-gray-800 hover:bg-gray-700 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={`px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      isDark
                        ? 'bg-gray-800 hover:bg-gray-700 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal détails (simplifié pour l'instant) */}
      {showDetailsModal && selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`rounded-lg border max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>Détails du contact</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className={`w-5 h-5 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`} />
                </button>
              </div>
              <div className="space-y-6">
                {/* Informations de base */}
                <div className="space-y-4">
                  <div>
                    <label className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>Nom complet</label>
                    <p className={`font-medium text-lg ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>{getDisplayName(selectedContact)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>Téléphone</label>
                      <p className={isDark ? 'text-white' : 'text-gray-900'}>{selectedContact.phone}</p>
                    </div>
                    {selectedContact.email && (
                      <div>
                        <label className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>Email</label>
                        <p className={isDark ? 'text-white' : 'text-gray-900'}>{selectedContact.email}</p>
                      </div>
                    )}
                  </div>
                  {selectedContact.notes_client && (
                    <div>
                      <label className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>Notes client</label>
                      <p className={`whitespace-pre-wrap p-3 rounded-lg ${
                        isDark
                          ? 'text-white bg-gray-700/50'
                          : 'text-gray-900 bg-gray-100'
                      }`}>{selectedContact.notes_client}</p>
                    </div>
                  )}
                </div>

                {/* Statistiques */}
                {contactStats && (
                  <div className={`pt-4 border-t ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                    <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      <TrendingUp className="w-5 h-5" />
                      Statistiques
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className={`p-4 rounded-lg ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                      }`}>
                        <div className="text-2xl font-bold text-blue-400">{contactStats.totalBookings}</div>
                        <div className={`text-sm mt-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>Réservations totales</div>
                      </div>
                      <div className={`p-4 rounded-lg ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                      }`}>
                        <div className="text-2xl font-bold text-green-400">{contactStats.upcomingBookings}</div>
                        <div className={`text-sm mt-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>À venir</div>
                      </div>
                      <div className={`p-4 rounded-lg ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                      }`}>
                        <div className="text-2xl font-bold text-purple-400">{contactStats.totalParticipants}</div>
                        <div className={`text-sm mt-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>Participants totaux</div>
                      </div>
                      <div className={`p-4 rounded-lg ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className="text-2xl font-bold text-yellow-400">{contactStats.gameBookings}</div>
                          <Gamepad2 className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="text-2xl font-bold text-green-400">{contactStats.eventBookings}</div>
                          <PartyPopper className="w-5 h-5 text-green-400" />
                        </div>
                        <div className={`text-sm mt-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>Jeux / Événements</div>
                      </div>
                    </div>
                    {contactStats.lastActivity && (
                      <div className={`mt-4 flex items-center gap-2 text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        <Clock className="w-4 h-4" />
                        Dernière activité: {new Date(contactStats.lastActivity).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Réservations liées */}
              <div className={`mt-6 pt-6 border-t ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  <Calendar className="w-5 h-5" />
                  Réservations liées ({linkedBookings.length})
                </h3>
                {loadingBookings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className={`w-6 h-6 animate-spin ${
                      isDark ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                  </div>
                ) : linkedBookings.length === 0 ? (
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>Aucune réservation liée à ce contact</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {linkedBookings.map((booking) => {
                      const bookingDate = new Date(booking.start_datetime)
                      const isPast = bookingDate < new Date()
                      
                      // Déterminer le type de jeu pour les GAME
                      let gameIcon = null
                      if (booking.type === 'GAME') {
                        // Vérifier si game_sessions existe et est un tableau
                        const sessions = booking.game_sessions || []
                        if (Array.isArray(sessions) && sessions.length > 0) {
                          // Extraire les game_area (peut être un objet avec game_area ou directement une string)
                          const gameAreas = sessions
                            .map(s => {
                              // Si c'est un objet avec game_area, prendre game_area, sinon prendre directement
                              return (typeof s === 'object' && s !== null) ? s.game_area : s
                            })
                            .filter(Boolean)
                          
                          const hasActive = gameAreas.includes('ACTIVE')
                          const hasLaser = gameAreas.includes('LASER')
                          
                          if (hasActive && !hasLaser) {
                            // Toutes les sessions sont ACTIVE
                            gameIcon = <Zap className="w-5 h-5 flex-shrink-0 text-blue-400" />
                          } else if (hasLaser && !hasActive) {
                            // Toutes les sessions sont LASER
                            gameIcon = <Target className="w-5 h-5 flex-shrink-0 text-purple-400" />
                          } else {
                            // Mix (ACTIVE + LASER) ou autre - garder Gamepad2
                            gameIcon = <Gamepad2 className="w-5 h-5 flex-shrink-0 text-blue-400" />
                          }
                        } else {
                          // Pas de game_sessions - logo par défaut
                          gameIcon = <Gamepad2 className="w-5 h-5 flex-shrink-0 text-blue-400" />
                        }
                      }
                      
                      return (
                        <div
                          key={booking.id}
                          onClick={() => {
                            // Deep-link vers la réservation dans l'agenda
                            const bookingDateStr = bookingDate.toISOString().split('T')[0]
                            router.push(`/admin?date=${bookingDateStr}&booking=${booking.id}`)
                            setShowDetailsModal(false)
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            isPast
                              ? isDark
                                ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                                : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                              : 'bg-blue-600/10 border-blue-600/30 hover:bg-blue-600/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {booking.type === 'EVENT' ? (
                                <PartyPopper className="w-5 h-5 flex-shrink-0 text-green-400" />
                              ) : (
                                gameIcon || <Gamepad2 className="w-5 h-5 flex-shrink-0 text-blue-400" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className={`font-medium truncate ${
                                  isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {booking.reference_code} - {booking.type === 'EVENT' ? 'Événement' : 'Jeu'}
                                </div>
                                <div className={`text-sm ${
                                  isDark ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                  {bookingDate.toLocaleDateString('fr-FR', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              <div className={`text-sm font-medium ${
                                isDark ? 'text-white' : 'text-gray-900'
                              }`}>
                                {booking.participants_count} pers.
                              </div>
                              <div className={`text-xs ${
                                booking.status === 'CANCELLED'
                                  ? 'text-red-400'
                                  : booking.status === 'CONFIRMED'
                                  ? 'text-green-400'
                                  : isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-600'
                              }`}>
                                {booking.status === 'CANCELLED' ? 'Annulé' : booking.status === 'CONFIRMED' ? 'Confirmé' : 'Brouillon'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal création/édition client */}
      {showClientModal && selectedBranch && (
        <ClientModal
          isOpen={showClientModal}
          onClose={handleCloseClientModal}
          contact={editingContact}
          branchId={selectedBranch.id}
          onSave={() => performSearch()}
          isDark={isDark}
        />
      )}

      {/* Modal fusion contacts */}
      {showMergeModal && selectedBranch && duplicatesToMerge.length >= 2 && (
        <MergeContactsModal
          isOpen={showMergeModal}
          onClose={() => {
            setShowMergeModal(false)
            setDuplicatesToMerge([])
          }}
          contacts={duplicatesToMerge}
          onMergeComplete={performSearch}
          branchId={selectedBranch.id}
          isDark={isDark}
        />
      )}

      {/* Modal de confirmation */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
        onConfirm={confirmationModal.onConfirm}
        title={confirmationModal.title}
        message={confirmationModal.message}
        type={confirmationModal.type}
        isDark={isDark}
      />
    </div>
  )
}
