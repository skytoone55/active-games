'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  X,
  PartyPopper,
  Target,
  Gamepad2,
  Mail
} from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { useBranches } from '@/hooks/useBranches'
import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import type { UserRole } from '@/hooks/useUserPermissions'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { OrdersTable } from './components/OrdersTable'
import { OrderDetailModal } from './components/OrderDetailModal'
import type { OrderStatus } from '@/lib/supabase/types'
import { ContactDetailsModal } from '../components/ContactDetailsModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { AccountingModal } from '../components/AccountingModal'
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
  const searchParams = useSearchParams()
  const { t, locale } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()

  // Helper pour obtenir la locale de date en fonction de la langue
  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }
  const branchesHook = useBranches()
  const branches = branchesHook.branches
  const branchesLoading = branchesHook.loading
  const selectedBranchIdFromHook = branchesHook.selectedBranchId
  
  // Calculer effectiveSelectedBranchId avec fallback
  const effectiveSelectedBranchId = selectedBranchIdFromHook || (branches.length > 0 ? branches[0]?.id : null)
  
  // Synchroniser avec le hook si nécessaire
  useEffect(() => {
    if (effectiveSelectedBranchId && !selectedBranchIdFromHook && branches.length === 1) {
      branchesHook.selectBranch(effectiveSelectedBranchId)
    }
  }, [effectiveSelectedBranchId, selectedBranchIdFromHook, branches.length, branchesHook.selectBranch])
  
  const selectedBranchId = effectiveSelectedBranchId
  const [searchQuery, setSearchQuery] = useState('')
  const [quickStatusFilter, setQuickStatusFilter] = useState<string>('all')
  const [theme, setTheme] = useState<Theme>('light')
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [accountingOrderId, setAccountingOrderId] = useState<string | null>(null)
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
    cancelOrder
  } = useOrders(selectedBranchId)

  // Permissions
  const { hasPermission } = useUserPermissions(user?.role as UserRole || null)
  const canEditOrder = hasPermission('orders', 'can_edit')
  const canDeleteOrder = hasPermission('orders', 'can_delete')

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

  // Note: L'auth est gérée par le layout parent, pas de redirection ici

  // Sélectionner la première branche par défaut si aucune n'est sélectionnée
  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      branchesHook.selectBranch(branches[0].id)
    }
  }, [branches, selectedBranchId, branchesHook.selectBranch])

  // Gérer le paramètre order dans l'URL pour ouvrir une commande spécifique
  useEffect(() => {
    const orderId = searchParams?.get('order')
    if (orderId && orders.length > 0) {
      const order = orders.find(o => o.id === orderId)
      if (order) {
        setSelectedOrder(order)
        // Nettoyer l'URL
        router.replace('/admin/orders')
      }
    }
  }, [searchParams, orders, router])

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
    return new Date(date).toLocaleDateString(getDateLocale(), {
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
          label: t('admin.orders.status.pending')
        }
      case 'auto_confirmed':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          border: 'border-green-500/30',
          label: t('admin.orders.status.auto_confirmed')
        }
      case 'manually_confirmed':
        return {
          icon: CheckCircle,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          label: t('admin.orders.status.manually_confirmed')
        }
      case 'cancelled':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          label: t('admin.orders.status.cancelled')
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

  const handleCancel = (orderId: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.orders.modal.cancel_title'),
      message: t('admin.orders.modal.cancel_message'),
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

  // Renvoyer l'email de confirmation
  const handleResendEmail = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/orders/${orderId}/resend-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error resending email:', error)
      return { success: false, error: 'Network error' }
    }
  }

  // Renvoyer un rappel CGV
  const handleResendCgvReminder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/orders/${orderId}/resend-cgv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error resending CGV reminder:', error)
      return { success: false, error: 'Network error' }
    }
  }

  // Réactiver une réservation annulée - redirige vers l'agenda pour vérifier les disponibilités
  const handleReactivate = (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    setConfirmModal({
      isOpen: true,
      title: t('admin.orders.modal.reactivate_title'),
      message: t('admin.orders.modal.reactivate_message'),
      type: 'success',
      onConfirm: () => {
        // Construire les query params avec les données de la commande
        const params = new URLSearchParams({
          reactivate: 'true',
          orderId: order.id,
          date: order.requested_date,
          time: order.requested_time,
          type: order.order_type,
          participants: order.participants_count.toString(),
          firstName: order.customer_first_name,
          lastName: order.customer_last_name || '',
          phone: order.customer_phone,
          email: order.customer_email || '',
          reference: order.request_reference
        })
        
        if (order.game_area) {
          params.set('gameArea', order.game_area)
        }
        if (order.number_of_games) {
          params.set('numberOfGames', order.number_of_games.toString())
        }
        if (order.contact_id) {
          params.set('contactId', order.contact_id)
        }
        
        closeOrderModal()
        router.push(`/admin?${params.toString()}`)
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

  const selectedBranch = branches.find(b => b.id === selectedBranchId) || (branches.length > 0 ? branches[0] : null)

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={selectedBranch || branches[0] || null}
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
                placeholder={t('admin.orders.search_placeholder')}
                className={`w-full pl-10 pr-4 py-3 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-base placeholder-gray-500 focus:border-blue-500 focus:outline-none`}
              />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.orders.stats.total')}</div>
          </div>
          <div className={`p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30`}>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-sm text-yellow-500/70">{t('admin.orders.stats.pending')}</div>
          </div>
          <div className={`p-4 rounded-xl bg-green-500/10 border border-green-500/30`}>
            <div className="text-2xl font-bold text-green-500">{stats.auto_confirmed}</div>
            <div className="text-sm text-green-500/70">{t('admin.orders.stats.auto_confirmed')}</div>
          </div>
          <div className={`p-4 rounded-xl bg-blue-500/10 border border-blue-500/30`}>
            <div className="text-2xl font-bold text-blue-500">{stats.manually_confirmed}</div>
            <div className="text-sm text-blue-500/70">{t('admin.orders.stats.manually_confirmed')}</div>
          </div>
          <div className={`p-4 rounded-xl bg-red-500/10 border border-red-500/30`}>
            <div className="text-2xl font-bold text-red-500">{stats.cancelled}</div>
            <div className="text-sm text-red-500/70">{t('admin.orders.stats.cancelled')}</div>
          </div>
        </div>

        {/* Conversion Rate */}
        {stats.total > 0 && (
          <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{t('admin.orders.stats.conversion_rate')}</span>
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
          <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.orders.filter.label')}</span>

          <button
            onClick={() => setQuickStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              quickStatusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t('admin.orders.filter.all')} ({stats.total})
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
            {t('admin.orders.filter.pending')}
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
            {t('admin.orders.filter.auto_confirmed')} ({stats.auto_confirmed})
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
            {t('admin.orders.filter.manually_confirmed')} ({stats.manually_confirmed})
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
            {t('admin.orders.filter.cancelled')} ({stats.cancelled})
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bouton Emails */}
          <Link
            href="/admin/emails"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isDark
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            {t('admin.orders.emails_button')}
          </Link>
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
            onCancel={handleCancel}
            onViewOrder={handleViewOrder}
            onViewClient={handleViewClient}
            onOpenAccounting={(orderId) => setAccountingOrderId(orderId)}
            canDelete={canDeleteOrder}
          />
        )}
      </main>

      {/* Modal Détail Commande */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={closeOrderModal}
          onCancel={handleCancel}
          onRecreate={handleReactivate}
          onResendEmail={handleResendEmail}
          onResendCgvReminder={handleResendCgvReminder}
          onGoToAgenda={handleGoToAgenda}
          onGoToClient={handleViewClient}
          onOpenAccounting={(orderId) => setAccountingOrderId(orderId)}
          isDark={isDark}
          canEdit={canEditOrder}
          canDelete={canDeleteOrder}
        />
      )}

      {/* Modal Fiche Comptable */}
      {accountingOrderId && selectedBranchId && (
        <AccountingModal
          orderId={accountingOrderId}
          branchId={selectedBranchId}
          onClose={() => setAccountingOrderId(null)}
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
