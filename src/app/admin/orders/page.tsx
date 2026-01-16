'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  X
} from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { useBranches } from '@/hooks/useBranches'
import { useAuth } from '@/hooks/useAuth'
import { AdminHeader } from '../components/AdminHeader'
import { OrdersTable } from './components/OrdersTable'
import { OrderDetailModal } from './components/OrderDetailModal'
import { ContactDetailsModal } from '../components/ContactDetailsModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { createClient } from '@/lib/supabase/client'
import type { OrderWithRelations } from '@/lib/supabase/types'

interface ConfirmModalState {
  isOpen: boolean
  title: string
  message: string
  type: 'warning' | 'info' | 'success'
  onConfirm: () => void
}

type Theme = 'light' | 'dark'

export default function OrdersPage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const branchesHook = useBranches()
  const selectedBranchId = branchesHook.selectedBranchId
  const branches = branchesHook.branches
  const branchesLoading = branchesHook.loading
  const [searchQuery, setSearchQuery] = useState('')
  const [quickStatusFilter, setQuickStatusFilter] = useState<string>('all')
  const [theme, setTheme] = useState<Theme>('light')
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {}
  })
  
  const { 
    orders, 
    loading, 
    error, 
    stats, 
    pendingCount,
    confirmOrder, 
    cancelOrder
  } = useOrders(selectedBranchId)

  // Charger le thème depuis localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin-theme') as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  // Toggle thème
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('admin-theme', newTheme)
  }

  // Rediriger si pas authentifié
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Sélectionner la première branche par défaut si aucune n'est sélectionnée
  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      branchesHook.selectBranch(branches[0].id)
    }
  }, [branches, selectedBranchId, branchesHook])

  // Filtrer les commandes par recherche et statut rapide
  const filteredOrders = orders.filter(order => {
    // Filtre par statut rapide (en haut de page)
    if (quickStatusFilter !== 'all' && order.status !== quickStatusFilter) {
      return false
    }
    
    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matchesName = `${order.customer_first_name} ${order.customer_last_name}`.toLowerCase().includes(query)
      const matchesPhone = order.customer_phone.toLowerCase().includes(query)
      const matchesEmail = order.customer_email?.toLowerCase().includes(query)
      const matchesReference = order.request_reference.toLowerCase().includes(query)
      const matchesBookingRef = order.booking?.reference_code?.toLowerCase().includes(query)
      
      return matchesName || matchesPhone || matchesEmail || matchesReference || matchesBookingRef
    }
    
    return true
  })

  // Formater la date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Formater l'heure
  const formatTime = (time: string) => {
    return time.slice(0, 5)
  }

  // Obtenir l'icône et la couleur du statut
  const getStatusDisplay = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { 
          icon: Clock, 
          color: 'text-yellow-500', 
          bg: 'bg-yellow-500/10', 
          border: 'border-yellow-500/30',
          label: 'En attente'
        }
      case 'auto_confirmed':
        return { 
          icon: CheckCircle, 
          color: 'text-green-500', 
          bg: 'bg-green-500/10', 
          border: 'border-green-500/30',
          label: 'Confirmé auto'
        }
      case 'manually_confirmed':
        return { 
          icon: CheckCircle, 
          color: 'text-blue-500', 
          bg: 'bg-blue-500/10', 
          border: 'border-blue-500/30',
          label: 'Confirmé manuel'
        }
      case 'cancelled':
        return { 
          icon: XCircle, 
          color: 'text-red-500', 
          bg: 'bg-red-500/10', 
          border: 'border-red-500/30',
          label: 'Annulé'
        }
      default:
        return { 
          icon: AlertCircle, 
          color: 'text-gray-500', 
          bg: 'bg-gray-500/10', 
          border: 'border-gray-500/30',
          label: status
        }
    }
  }

  // Obtenir l'icône du type de commande
  const getTypeIcon = (orderType: string, gameArea: string | null) => {
    if (orderType === 'EVENT') return PartyPopper
    if (gameArea === 'LASER') return Target
    return Gamepad2
  }

  const handleConfirm = (orderId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmer la commande',
      message: 'Voulez-vous confirmer cette commande et créer la réservation ?',
      type: 'success',
      onConfirm: async () => {
        await confirmOrder(orderId)
        closeOrderModal()
      }
    })
  }

  const handleCancel = (orderId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Annuler la commande',
      message: 'Voulez-vous vraiment annuler cette commande ? Cette action est réversible.',
      type: 'warning',
      onConfirm: async () => {
        await cancelOrder(orderId)
        closeOrderModal()
      }
    })
  }

  const handleViewOrder = (order: OrderWithRelations) => {
    setSelectedOrder(order)
  }

  // Ouvrir la fiche client dans une modal (comme dans la section Clients)
  const handleViewClient = (contactId: string) => {
    setSelectedContactId(contactId)
  }

  const closeClientModal = () => {
    setSelectedContactId(null)
  }

  const closeOrderModal = () => {
    setSelectedOrder(null)
  }


  // Navigation vers l'agenda avec la date et booking
  const handleGoToAgenda = (date: string, bookingId?: string) => {
    if (bookingId) {
      router.push(`/admin?date=${date}&booking=${bookingId}`)
    } else {
      router.push(`/admin?date=${date}`)
    }
  }

  // Navigation vers le CRM
  const handleGoToCRM = (contactId: string) => {
    router.push(`/admin/clients?contact=${contactId}`)
  }

  // Réactiver une réservation annulée - garde la même référence
  const handleReactivate = (orderId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Réactiver la réservation',
      message: 'Voulez-vous réactiver cette réservation ? Elle sera remise en statut "Confirmé" avec la même référence.',
      type: 'success',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reactivate' })
          })
          
          const data = await response.json()
          if (data.success) {
            closeOrderModal()
            window.location.reload()
          } else {
            setConfirmModal({
              isOpen: true,
              title: 'Erreur',
              message: data.error || 'Erreur lors de la réactivation',
              type: 'warning',
              onConfirm: () => {}
            })
          }
        } catch (err) {
          console.error('Error reactivating order:', err)
          setConfirmModal({
            isOpen: true,
            title: 'Erreur',
            message: 'Erreur lors de la réactivation',
            type: 'warning',
            onConfirm: () => {}
          })
        }
      }
    })
  }

  const isDark = theme === 'dark'

  if (authLoading || branchesLoading || !user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchSelect={(branchId) => branchesHook.selectBranch(branchId)}
        onSignOut={signOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="p-6">
        {/* Barre de recherche */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'} mb-6`}>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une commande (nom, téléphone, email, référence)..."
                className={`w-full pl-10 pr-4 py-3 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-base placeholder-gray-500 focus:border-blue-500 focus:outline-none`}
              />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total</div>
          </div>
          <div className={`p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30`}>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-sm text-yellow-500/70">En attente</div>
          </div>
          <div className={`p-4 rounded-xl bg-green-500/10 border border-green-500/30`}>
            <div className="text-2xl font-bold text-green-500">{stats.auto_confirmed}</div>
            <div className="text-sm text-green-500/70">Confirmés auto</div>
          </div>
          <div className={`p-4 rounded-xl bg-blue-500/10 border border-blue-500/30`}>
            <div className="text-2xl font-bold text-blue-500">{stats.manually_confirmed}</div>
            <div className="text-sm text-blue-500/70">Confirmés manuel</div>
          </div>
          <div className={`p-4 rounded-xl bg-red-500/10 border border-red-500/30`}>
            <div className="text-2xl font-bold text-red-500">{stats.cancelled}</div>
            <div className="text-sm text-red-500/70">Annulés</div>
          </div>
        </div>

        {/* Conversion Rate */}
        {stats.total > 0 && (
          <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Taux de conversion</span>
              <span className="text-2xl font-bold text-cyan-500">
                {Math.round(((stats.auto_confirmed + stats.manually_confirmed) / stats.total) * 100)}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"
                style={{ width: `${((stats.auto_confirmed + stats.manually_confirmed) / stats.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Filtres rapides par statut */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Filtrer :</span>
          
          <button
            onClick={() => setQuickStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              quickStatusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Toutes ({stats.total})
          </button>
          
          <button
            onClick={() => setQuickStatusFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              quickStatusFilter === 'pending'
                ? 'bg-red-600 text-white'
                : stats.pending > 0
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border-2 border-red-500'
                  : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            En attente
            {stats.pending > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                quickStatusFilter === 'pending' ? 'bg-white text-red-600' : 'bg-red-500 text-white'
              }`}>
                {stats.pending}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setQuickStatusFilter('auto_confirmed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              quickStatusFilter === 'auto_confirmed'
                ? 'bg-green-600 text-white'
                : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Confirmés auto ({stats.auto_confirmed})
          </button>
          
          <button
            onClick={() => setQuickStatusFilter('manually_confirmed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              quickStatusFilter === 'manually_confirmed'
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Confirmés manuel ({stats.manually_confirmed})
          </button>
          
          <button
            onClick={() => setQuickStatusFilter('cancelled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              quickStatusFilter === 'cancelled'
                ? 'bg-gray-600 text-white'
                : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <XCircle className="w-4 h-4" />
            Annulées ({stats.cancelled})
          </button>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : (
          <OrdersTable
            orders={filteredOrders}
            isDark={isDark}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onViewOrder={handleViewOrder}
            onViewClient={handleViewClient}
          />
        )}
      </main>

      {/* Modal Détail Commande */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={closeOrderModal}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onRecreate={handleReactivate}
          onGoToAgenda={handleGoToAgenda}
          onGoToClient={handleViewClient}
          isDark={isDark}
        />
      )}

      {/* Modal Fiche Client - Identique à section Clients */}
      {selectedContactId && (
        <ContactDetailsModal
          contactId={selectedContactId}
          onClose={closeClientModal}
          isDark={isDark}
        />
      )}

      {/* Modal de confirmation stylisée */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        isDark={isDark}
      />
    </div>
  )
}
