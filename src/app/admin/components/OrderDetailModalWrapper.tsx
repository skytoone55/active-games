'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/contexts/LanguageContext'
import { OrderDetailModal } from '../orders/components/OrderDetailModal'
import { ConfirmationModal } from './ConfirmationModal'
import type { OrderWithRelations } from '@/lib/supabase/types'

interface OrderDetailModalWrapperProps {
  orderId: string
  onClose: () => void
  isDark: boolean
  onOpenAccounting?: (orderId: string) => void
}

interface ConfirmModalState {
  isOpen: boolean
  title: string
  message: string
  type: 'warning' | 'info' | 'success'
  onConfirm: () => void
}

/**
 * Wrapper autour de OrderDetailModal qui charge l'order à partir de l'orderId
 * Utilisé depuis l'agenda pour ouvrir la fiche commande sans naviguer
 * Implémente toutes les fonctionnalités (resend email, cancel, reactivate, etc.)
 */
export function OrderDetailModalWrapper({
  orderId,
  onClose,
  isDark,
  onOpenAccounting,
}: OrderDetailModalWrapperProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [order, setOrder] = useState<OrderWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {}
  })

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        contact:contacts(*),
        booking:bookings(
          *,
          slots:booking_slots(*)
        )
      `)
      .eq('id', orderId)
      .single()

    if (fetchError) {
      console.error('Error loading order:', fetchError)
      setError(t('admin.orders.loading_error'))
    } else {
      setOrder(data as OrderWithRelations)
    }
    setLoading(false)
  }, [orderId, t])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  // Annuler une commande
  const handleCancel = async (orderId: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.orders.modal.cancel_title'),
      message: t('admin.orders.modal.cancel_message'),
      type: 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel' })
          })

          const data = await response.json()
          if (!data.success) throw new Error(data.error)

          // Recharger la commande pour mettre à jour l'affichage
          loadOrder()
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Error cancelling order:', error)
        }
      }
    })
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

        onClose()
        router.push(`/admin?${params.toString()}`)
      }
    })
  }

  // Aller à l'agenda
  const handleGoToAgenda = (date: string, bookingId?: string) => {
    onClose()
    const params = new URLSearchParams({ date })
    if (bookingId) {
      params.set('booking', bookingId)
    }
    router.push(`/admin?${params.toString()}`)
  }

  // Aller au client
  const handleGoToClient = (contactId: string) => {
    onClose()
    router.push(`/admin/clients?contact=${contactId}`)
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className={`rounded-2xl border p-8 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <Loader2 className={`w-8 h-8 animate-spin ${
            isDark ? 'text-blue-400' : 'text-blue-600'
          }`} />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className={`rounded-2xl border p-6 max-w-md ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <span>{error || t('admin.common.error')}</span>
          </div>
          <button
            onClick={onClose}
            className={`mt-4 w-full px-4 py-2 rounded-lg transition-colors ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {t('admin.common.close')}
          </button>
        </div>
      </div>
    )
  }

  // Render the actual modal
  return (
    <>
      <OrderDetailModal
        order={order}
        onClose={onClose}
        onCancel={handleCancel}
        onRecreate={handleReactivate}
        onResendEmail={handleResendEmail}
        onResendCgvReminder={handleResendCgvReminder}
        onGoToAgenda={handleGoToAgenda}
        onGoToClient={handleGoToClient}
        onOpenAccounting={onOpenAccounting}
        isDark={isDark}
        canEdit={true}
        canDelete={true}
      />

      {/* Modal de confirmation */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={t('admin.common.confirm')}
        cancelText={t('admin.common.cancel')}
        type={confirmModal.type}
        isDark={isDark}
      />
    </>
  )
}
