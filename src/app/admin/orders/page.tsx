'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  PartyPopper,
  Target,
  Gamepad2,
  Mail,
  CheckCheck
} from 'lucide-react'
import { useOrders, useUnseenOrdersCount, notifyOrdersSeenChanged } from '@/hooks/useOrders'
import { useAdmin } from '@/contexts/AdminContext'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import type { UserRole } from '@/hooks/useUserPermissions'
import { useTranslation } from '@/contexts/LanguageContext'
import { OrdersTable } from './components/OrdersTable'
import { OrderDetailModal } from './components/OrderDetailModal'
import type { OrderStatus } from '@/lib/supabase/types'
import { ContactDetailsModal } from '../components/ContactDetailsModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { AccountingModal } from '../components/AccountingModal'
import type { OrderWithRelations } from '@/lib/supabase/types'

interface ConfirmModalState {
  isOpen: boolean
  title: string
  message: string
  type: 'warning' | 'info' | 'success'
  onConfirm: () => void
}

export default function OrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useTranslation()
  const { user, branches, selectedBranch, selectedBranchId, selectBranch, isDark, signOut } = useAdmin()

  // Helper pour obtenir la locale de date en fonction de la langue
  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }
  const [searchQuery, setSearchQuery] = useState('')
  const [quickStatusFilter, setQuickStatusFilter] = useState<string>('all')
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

  const { counts: unseenCounts, refetch: refetchUnseen } = useUnseenOrdersCount(selectedBranchId)
  const [markingAllSeen, setMarkingAllSeen] = useState<string | null>(null)

  const handleMarkAllSeen = async (status?: string) => {
    if (!selectedBranchId || markingAllSeen) return
    setMarkingAllSeen(status || 'all')
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_seen', branch_id: selectedBranchId, status }),
      })
      if ((await res.json()).success) {
        notifyOrdersSeenChanged()
        refetchUnseen()
      }
    } catch (_) {
      // silencieux
    } finally {
      setMarkingAllSeen(null)
    }
  }

  // Permissions
  const { hasPermission } = useUserPermissions(user?.role as UserRole || null)
  const canEditOrder = hasPermission('orders', 'can_edit')
  const canDeleteOrder = hasPermission('orders', 'can_delete')

  // Note: L'auth est gérée par le layout parent, pas de redirection ici

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
      case 'aborted':
        return {
          icon: XCircle,
          color: 'text-orange-500',
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/30',
          label: t('admin.orders.status.aborted')
        }
      case 'cancelled':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          label: t('admin.orders.status.cancelled')
        }
      case 'closed':
        return {
          icon: CheckCircle,
          color: 'text-purple-500',
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/30',
          label: t('admin.orders.status.closed')
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

  // Clôturer une commande (créer facture iCount)
  const handleCloseOrder = (orderId: string) => {
    console.log('[CLOSE ORDER - Orders Page] Called with orderId:', orderId)
    setConfirmModal({
      isOpen: true,
      title: t('admin.orders.modal.close_title'),
      message: t('admin.orders.modal.close_message'),
      type: 'warning',
      onConfirm: async () => {
        console.log('[CLOSE ORDER - Orders Page] Confirmed, calling API for orderId:', orderId)
        try {
          const response = await fetch(`/api/orders/${orderId}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          const result = await response.json()
          console.log('[CLOSE ORDER - Orders Page] API response:', result)
          if (result.success) {
            // Construire le message de succès avec les détails
            let successMessage = t('admin.orders.close_order_success')
            if (result.data?.icountInvrecId) {
              successMessage += `\n\n📄 ${t('admin.accounting.invoice')}: #${result.data.icountInvrecId}`
            }
            if (result.data?.totalPaidAmount) {
              successMessage += `\n💰 ${t('admin.accounting.total')}: ₪${result.data.totalPaidAmount}`
            }

            // Afficher le message de succès
            setConfirmModal({
              isOpen: true,
              title: t('admin.common.success'),
              message: successMessage,
              type: 'success',
              onConfirm: () => {
                // Rafraîchir la liste des commandes
                window.location.reload()
              }
            })
          } else {
            setConfirmModal({
              isOpen: true,
              title: t('admin.common.error'),
              message: result.error || t('admin.orders.close_error'),
              type: 'warning',
              onConfirm: () => {}
            })
          }
        } catch (error) {
          console.error('Error closing order:', error)
          setConfirmModal({
            isOpen: true,
            title: t('admin.common.error'),
            message: t('admin.orders.network_error'),
            type: 'warning',
            onConfirm: () => {}
          })
        }
      }
    })
  }

  const handleViewOrder = (order: OrderWithRelations) => {
    setSelectedOrder(order)

    // Auto-marquer comme vu si pas encore vu (tous statuts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(order as any).seen_at) {
      fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_seen' }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            notifyOrdersSeenChanged()
          }
        })
        .catch(() => {})
    }
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
      return { success: false, error: t('admin.orders.network_error') }
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
      return { success: false, error: t('admin.orders.network_error') }
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

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
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
          <div className={`p-4 rounded-xl bg-orange-500/10 border border-orange-500/30`}>
            <div className="text-2xl font-bold text-orange-500">{stats.aborted || 0}</div>
            <div className="text-sm text-orange-500/70">{t('admin.orders.stats.aborted')}</div>
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

          {/* Pending */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                quickStatusFilter === 'pending'
                  ? 'bg-red-600 text-white'
                  : unseenCounts.pending > 0
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border-2 border-red-500'
                    : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              {t('admin.orders.filter.pending')}
              {unseenCounts.pending > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  quickStatusFilter === 'pending' ? 'bg-white text-red-600' : 'bg-red-500 text-white'
                }`}>
                  {unseenCounts.pending > 9 ? '9+' : unseenCounts.pending}
                </span>
              )}
            </button>
            {unseenCounts.pending > 0 && (
              <button
                onClick={() => handleMarkAllSeen('pending')}
                disabled={markingAllSeen !== null}
                title="Tout marquer comme lu"
                className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-600'} disabled:opacity-50`}
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Auto confirmée */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickStatusFilter('auto_confirmed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                quickStatusFilter === 'auto_confirmed'
                  ? 'bg-green-600 text-white'
                  : unseenCounts.auto_confirmed > 0
                    ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30 border-2 border-green-500'
                    : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {t('admin.orders.filter.auto_confirmed')} ({stats.auto_confirmed})
              {unseenCounts.auto_confirmed > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  quickStatusFilter === 'auto_confirmed' ? 'bg-white text-green-600' : 'bg-green-500 text-white'
                }`}>
                  {unseenCounts.auto_confirmed > 9 ? '9+' : unseenCounts.auto_confirmed}
                </span>
              )}
            </button>
            {unseenCounts.auto_confirmed > 0 && (
              <button
                onClick={() => handleMarkAllSeen('auto_confirmed')}
                disabled={markingAllSeen !== null}
                title="Tout marquer comme lu"
                className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-green-900/30 hover:bg-green-900/50 text-green-300' : 'bg-green-50 hover:bg-green-100 text-green-600'} disabled:opacity-50`}
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Confirmée manuellement */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickStatusFilter('manually_confirmed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                quickStatusFilter === 'manually_confirmed'
                  ? 'bg-blue-600 text-white'
                  : unseenCounts.manually_confirmed > 0
                    ? 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border-2 border-blue-500'
                    : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {t('admin.orders.filter.manually_confirmed')} ({stats.manually_confirmed})
              {unseenCounts.manually_confirmed > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  quickStatusFilter === 'manually_confirmed' ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'
                }`}>
                  {unseenCounts.manually_confirmed > 9 ? '9+' : unseenCounts.manually_confirmed}
                </span>
              )}
            </button>
            {unseenCounts.manually_confirmed > 0 && (
              <button
                onClick={() => handleMarkAllSeen('manually_confirmed')}
                disabled={markingAllSeen !== null}
                title="Tout marquer comme lu"
                className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-blue-900/30 hover:bg-blue-900/50 text-blue-300' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'} disabled:opacity-50`}
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Abandonnée */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickStatusFilter('aborted')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                quickStatusFilter === 'aborted'
                  ? 'bg-orange-600 text-white'
                  : unseenCounts.aborted > 0
                    ? 'bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 border-2 border-orange-500'
                    : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <XCircle className="w-4 h-4" />
              {t('admin.orders.filter.aborted')} ({stats.aborted || 0})
              {unseenCounts.aborted > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  quickStatusFilter === 'aborted' ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                }`}>
                  {unseenCounts.aborted > 9 ? '9+' : unseenCounts.aborted}
                </span>
              )}
            </button>
            {unseenCounts.aborted > 0 && (
              <button
                onClick={() => handleMarkAllSeen('aborted')}
                disabled={markingAllSeen !== null}
                title="Tout marquer comme lu"
                className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-orange-900/30 hover:bg-orange-900/50 text-orange-300' : 'bg-orange-50 hover:bg-orange-100 text-orange-600'} disabled:opacity-50`}
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Annulée */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickStatusFilter('cancelled')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                quickStatusFilter === 'cancelled'
                  ? 'bg-red-600 text-white'
                  : unseenCounts.cancelled > 0
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border-2 border-red-500'
                    : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <XCircle className="w-4 h-4" />
              {t('admin.orders.filter.cancelled')} ({stats.cancelled})
              {unseenCounts.cancelled > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  quickStatusFilter === 'cancelled' ? 'bg-white text-red-600' : 'bg-red-500 text-white'
                }`}>
                  {unseenCounts.cancelled > 9 ? '9+' : unseenCounts.cancelled}
                </span>
              )}
            </button>
            {unseenCounts.cancelled > 0 && (
              <button
                onClick={() => handleMarkAllSeen('cancelled')}
                disabled={markingAllSeen !== null}
                title="Tout marquer comme lu"
                className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-600'} disabled:opacity-50`}
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
          </div>

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
            onCloseOrder={handleCloseOrder}
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
          onCloseOrder={handleCloseOrder}
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
