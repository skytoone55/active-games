'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Edit2, Archive, User, Phone, Mail, Loader2, Eye, ChevronLeft, ChevronRight, Plus, Download, ArrowUpDown, ArrowUp, ArrowDown, Users as UsersIcon, GitMerge, Settings, X, MessageSquare } from 'lucide-react'
import { useContacts, type SearchContactsResult } from '@/hooks/useContacts'
import { useBranches } from '@/hooks/useBranches'
import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { ContactDetailsModal } from '../components/ContactDetailsModal'
import { ClientModal } from './components/ClientModal'
import { MergeContactsModal } from './components/MergeContactsModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { CustomSelect } from '../components/CustomSelect'
import { getClient } from '@/lib/supabase/client'
import type { Contact } from '@/lib/supabase/types'
import { useContactRequests } from '@/hooks/useContactRequests'
import { ContactRequestsPanel } from './components/ContactRequestsPanel'

export default function ClientsPage() {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const { hasPermission, loading: permissionsLoading } = useUserPermissions(user?.role || null)

  // Helper pour obtenir la locale de date en fonction de la langue
  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }
  const { branches, selectedBranch, selectBranch, loading: branchesLoading } = useBranches()
  const { searchContacts, archiveContact, unarchiveContact } = useContacts(selectedBranch?.id || null)
  const { unreadCount: unreadContactRequests } = useContactRequests(selectedBranch?.id || null)

  const [showContactRequests, setShowContactRequests] = useState(false)
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

  // Note: L'auth est gérée par le layout parent, pas de redirection ici

  // Rechercher les contacts
  const performSearch = useCallback(async () => {
    const branchToUse = selectedBranch || (branches.length > 0 ? branches[0] : null)
    if (!branchToUse?.id) return

    setLoading(true)
    try {
      const branchToUse = selectedBranch || (branches.length > 0 ? branches[0] : null)
      if (!branchToUse) return
      
      const result: SearchContactsResult = await searchContacts({
        query: searchQuery.trim() || undefined,
        branchId: branchToUse.id,
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
  }, [searchQuery, includeArchived, page, selectedBranch?.id, branches, sortField, sortDirection, filterStatus, filterSource])

  useEffect(() => {
    const branchToUse = selectedBranch || (branches.length > 0 ? branches[0] : null)
    if (branchToUse?.id) {
      performSearch()
    }
  }, [performSearch, selectedBranch?.id, branches])

  // Gérer l'archivage
  const handleArchive = (contact: Contact) => {
    setConfirmationModal({
      isOpen: true,
      title: t('admin.clients.archive_title'),
      message: t('admin.clients.archive_message'),
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
  const handleViewDetails = (contact: Contact) => {
    setSelectedContact(contact)
    setShowDetailsModal(true)
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      t('admin.common.first_name') || 'First Name',
      t('admin.common.last_name') || 'Last Name',
      t('admin.clients.table.phone'),
      t('admin.clients.table.email'),
      t('admin.clients.table.notes'),
      t('admin.clients.table.source'),
      t('admin.clients.table.status'),
      t('admin.clients.table.created'),
      t('admin.common.updated_at') || 'Updated'
    ]
    const rows = contacts.map(contact => [
      contact.first_name || '',
      contact.last_name || '',
      contact.phone || '',
      contact.email || '',
      contact.notes_client || '',
      contact.source === 'admin_agenda' ? t('admin.clients.source.agenda') : t('admin.clients.source.public'),
      contact.status === 'active' ? t('admin.clients.status.active') : t('admin.clients.status.archived'),
      new Date(contact.created_at).toLocaleDateString(getDateLocale()),
      new Date(contact.updated_at).toLocaleDateString(getDateLocale()),
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
    const supabase = getClient()
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

  // Calculer effectiveSelectedBranch avec fallback
  const effectiveSelectedBranch = selectedBranch || (branches.length > 0 ? branches[0] : null)

  // Permissions pour la ressource 'clients'
  const canCreateClient = hasPermission('clients', 'can_create')
  const canEditClient = hasPermission('clients', 'can_edit')
  const canDeleteClient = hasPermission('clients', 'can_delete')

  if (authLoading || branchesLoading || permissionsLoading || !user || !effectiveSelectedBranch) {
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
        selectedBranch={effectiveSelectedBranch}
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
            }`}>{t('admin.clients.title')}</h1>
            <span className={`px-3 py-1 text-sm rounded-full ${
              isDark
                ? 'bg-blue-600/20 text-blue-400'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {effectiveSelectedBranch.name}
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
                    title: t('admin.clients.duplicate_not_found'),
                    message: t('admin.clients.duplicate_not_found_message'),
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
              {t('admin.clients.detect_duplicates')}
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
              {t('admin.clients.export_csv')}
            </button>
            <button
              onClick={() => handleOpenEditModal(null)}
              disabled={!canCreateClient}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                canCreateClient
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-50'
              }`}
              title={!canCreateClient ? t('admin.common.no_permission') : undefined}
            >
              <Plus className="w-4 h-4" />
              {t('admin.clients.new_contact')}
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
              placeholder={t('admin.clients.search_placeholder')}
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
            }`}>{t('admin.clients.include_archived')}</span>
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
            <span className="hidden sm:inline">{t('admin.clients.advanced_filters')}</span>
          </button>
        </div>

        {/* Bouton Demandes de contact */}
        <div className="mt-3">
          <button
            onClick={() => setShowContactRequests(!showContactRequests)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 relative ${
              showContactRequests
                ? 'bg-blue-600 text-white'
                : isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t('admin.contact_requests.button_label')}</span>
            {unreadContactRequests > 0 && !showContactRequests && (
              <span className="bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                {unreadContactRequests}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Panel Demandes de contact */}
      {showContactRequests && effectiveSelectedBranch && (
        <div className={`px-6 py-4 border-b ${
          isDark ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50/50 border-gray-200'
        }`}>
          <ContactRequestsPanel
            branchId={effectiveSelectedBranch.id}
            isDark={isDark}
            onContactCreated={() => performSearch()}
          />
        </div>
      )}

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
              }`}>{t('admin.clients.table.status')}</label>
              <CustomSelect
                value={filterStatus}
                onChange={(value) => {
                  setFilterStatus(value as 'all' | 'active' | 'archived')
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: t('admin.clients.status.all') },
                  { value: 'active', label: t('admin.clients.status.active') },
                  { value: 'archived', label: t('admin.clients.status.archived') },
                ]}
                placeholder={t('admin.clients.select_status')}
                isDark={isDark}
              />
            </div>

            {/* Source */}
            <div>
              <label className={`block text-sm mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>{t('admin.clients.table.source')}</label>
              <CustomSelect
                value={filterSource}
                onChange={(value) => {
                  setFilterSource(value as 'all' | 'admin_agenda' | 'public_booking')
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: t('admin.clients.source.all') },
                  { value: 'admin_agenda', label: t('admin.clients.source.admin_agenda') },
                  { value: 'public_booking', label: t('admin.clients.source.public_booking') },
                ]}
                placeholder={t('admin.clients.select_source')}
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
              {t('admin.clients.reset_filters')}
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
            {t('admin.clients.no_contacts')}
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
                        {t('admin.clients.table.name')}
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>{t('admin.clients.table.phone')}</th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>{t('admin.clients.table.email')}</th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>{t('admin.clients.table.notes')}</th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>{t('admin.clients.table.source')}</th>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>{t('admin.clients.table.status')}</th>
                    <th
                      className={`px-4 py-3 text-left text-sm font-medium cursor-pointer transition-colors ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center">
                        {t('admin.clients.table.created')}
                        {getSortIcon('created_at')}
                      </div>
                    </th>
                    <th className={`px-4 py-3 text-right text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>{t('admin.clients.table.actions')}</th>
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
                          {contact.source === 'admin_agenda' ? t('admin.clients.source.agenda') : t('admin.clients.source.public')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {contact.status === 'archived' ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-600/20 text-yellow-400">
                            {t('admin.clients.status.archived')}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-600/20 text-green-400">
                            {t('admin.clients.status.active')}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {new Date(contact.created_at).toLocaleDateString(getDateLocale(), {
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
                            title={t('admin.clients.actions.view')}
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(contact)}
                            disabled={!canEditClient}
                            className={`p-2 rounded-lg transition-colors ${
                              canEditClient
                                ? isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                : 'cursor-not-allowed opacity-30'
                            }`}
                            title={!canEditClient ? t('admin.common.no_permission') : t('admin.clients.actions.edit')}
                          >
                            <Edit2 className={`w-4 h-4 ${
                              isDark ? 'text-gray-400' : 'text-gray-600'
                            }`} />
                          </button>
                          {contact.status === 'archived' ? (
                            <button
                              onClick={() => handleUnarchive(contact)}
                              disabled={!canDeleteClient}
                              className={`p-2 rounded-lg transition-colors ${
                                canDeleteClient
                                  ? isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                  : 'cursor-not-allowed opacity-30'
                              }`}
                              title={!canDeleteClient ? t('admin.common.no_permission') : t('admin.clients.actions.unarchive')}
                            >
                              <Archive className={`w-4 h-4 ${canDeleteClient ? 'text-green-400' : 'text-gray-500'}`} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchive(contact)}
                              disabled={!canDeleteClient}
                              className={`p-2 rounded-lg transition-colors ${
                                canDeleteClient
                                  ? isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                  : 'cursor-not-allowed opacity-30'
                              }`}
                              title={!canDeleteClient ? t('admin.common.no_permission') : t('admin.clients.actions.archive')}
                            >
                              <Archive className={`w-4 h-4 ${canDeleteClient ? 'text-yellow-400' : 'text-gray-500'}`} />
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
                  {t('admin.clients.pagination').replace('{{page}}', String(page)).replace('{{totalPages}}', String(totalPages)).replace('{{total}}', String(total)).replace('{{plural}}', total !== 1 ? 's' : '')}
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

      {/* Modal détails du contact - Composant partagé */}
      {showDetailsModal && selectedContact && (
        <ContactDetailsModal
          contactId={selectedContact.id}
          onClose={() => setShowDetailsModal(false)}
          isDark={isDark}
        />
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
      {showMergeModal && effectiveSelectedBranch && duplicatesToMerge.length >= 2 && (
        <MergeContactsModal
          isOpen={showMergeModal}
          onClose={() => {
            setShowMergeModal(false)
            setDuplicatesToMerge([])
          }}
          contacts={duplicatesToMerge}
          onMergeComplete={performSearch}
          branchId={effectiveSelectedBranch.id}
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
