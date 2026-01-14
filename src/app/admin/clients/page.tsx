'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Edit2, Archive, User, Phone, Mail, Loader2, Eye, Calendar, Gamepad2, PartyPopper, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react'
import { useContacts, type SearchContactsResult } from '@/hooks/useContacts'
import { useBranches } from '@/hooks/useBranches'
import { useAuth } from '@/hooks/useAuth'
import { ClientModal } from './components/ClientModal'
import type { Contact } from '@/lib/supabase/types'

export default function ClientsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { branches, selectedBranch } = useBranches()
  const { searchContacts, archiveContact, unarchiveContact, getLinkedBookings } = useContacts(selectedBranch?.id || null)

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

  const pageSize = 20

  // Rechercher les contacts
  const performSearch = useCallback(async () => {
    if (!selectedBranch?.id) return

    setLoading(true)
    try {
      const result: SearchContactsResult = await searchContacts({
        query: searchQuery.trim() || undefined,
        branchId: selectedBranch.id,
        includeArchived,
        page,
        pageSize,
      })

      setContacts(result.contacts)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (error) {
      console.error('Error searching contacts:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, includeArchived, page, selectedBranch, searchContacts])

  useEffect(() => {
    performSearch()
  }, [performSearch])

  // Gérer l'archivage
  const handleArchive = async (contact: Contact) => {
    if (!confirm(`Archiver le contact ${contact.first_name} ${contact.last_name || ''} ?`)) return

    const success = await archiveContact(contact.id)
    if (success) {
      await performSearch()
    }
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
    
    // Charger les réservations liées
    setLoadingBookings(true)
    const bookings = await getLinkedBookings(contact.id)
    setLinkedBookings(bookings || [])
    setLoadingBookings(false)
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

  if (!user || !selectedBranch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Gestion des Clients</h1>
            <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-sm rounded-full">
              {selectedBranch.name}
            </span>
          </div>
          <button
            onClick={() => handleOpenEditModal(null)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouveau contact
          </button>
        </div>
      </div>

      {/* Recherche et filtres */}
      <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Rechercher par nom, téléphone, email..."
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Inclure les archivés</span>
          </label>
        </div>
      </div>

      {/* Tableau */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Aucun contact trouvé
          </div>
        ) : (
          <>
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Nom</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Téléphone</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Source</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Statut</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-medium">{getDisplayName(contact)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{contact.phone}</td>
                      <td className="px-4 py-3 text-gray-300">{contact.email || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-300">
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
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetails(contact)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                            title="Voir détails"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(contact)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4 text-gray-400" />
                          </button>
                          {contact.status === 'archived' ? (
                            <button
                              onClick={() => handleUnarchive(contact)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                              title="Restaurer"
                            >
                              <Archive className="w-4 h-4 text-green-400" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchive(contact)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
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
                <div className="text-sm text-gray-400">
                  Page {page} sur {totalPages} ({total} contact{total !== 1 ? 's' : ''})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Détails du contact</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Nom complet</label>
                  <p className="text-white font-medium">{getDisplayName(selectedContact)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Téléphone</label>
                  <p className="text-white">{selectedContact.phone}</p>
                </div>
                {selectedContact.email && (
                  <div>
                    <label className="text-sm text-gray-400">Email</label>
                    <p className="text-white">{selectedContact.email}</p>
                  </div>
                )}
                {selectedContact.notes_client && (
                  <div>
                    <label className="text-sm text-gray-400">Notes client</label>
                    <p className="text-white whitespace-pre-wrap">{selectedContact.notes_client}</p>
                  </div>
                )}
              </div>

              {/* Réservations liées */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Réservations liées
                </h3>
                {loadingBookings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  </div>
                ) : linkedBookings.length === 0 ? (
                  <p className="text-gray-400 text-sm">Aucune réservation liée</p>
                ) : (
                  <div className="space-y-2">
                    {linkedBookings.map((booking) => {
                      const bookingDate = new Date(booking.start_datetime)
                      const isPast = bookingDate < new Date()
                      
                      return (
                        <div
                          key={booking.id}
                          onClick={() => {
                            router.push(`/admin?booking=${booking.id}`)
                            setShowDetailsModal(false)
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            isPast
                              ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                              : 'bg-blue-600/10 border-blue-600/30 hover:bg-blue-600/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {booking.type === 'EVENT' ? (
                                <PartyPopper className={`w-5 h-5 ${isPast ? 'text-gray-400' : 'text-green-400'}`} />
                              ) : (
                                <Gamepad2 className={`w-5 h-5 ${isPast ? 'text-gray-400' : 'text-blue-400'}`} />
                              )}
                              <div>
                                <div className="font-medium text-white">
                                  {booking.reference_code} - {booking.type}
                                </div>
                                <div className="text-sm text-gray-400">
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
                            <div className="text-right">
                              <div className="text-sm font-medium text-white">
                                {booking.participants_count} pers.
                              </div>
                              <div className={`text-xs ${
                                booking.status === 'CANCELLED'
                                  ? 'text-red-400'
                                  : booking.status === 'CONFIRMED'
                                  ? 'text-green-400'
                                  : 'text-gray-400'
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
          onSave={performSearch}
          isDark={true}
        />
      )}
    </div>
  )
}
