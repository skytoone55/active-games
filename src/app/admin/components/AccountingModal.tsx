'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Loader2,
  Receipt,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  CreditCard,
  Users,
  Calendar,
  Hash,
  Plus,
  Banknote,
  ShieldCheck,
  CheckCheck,
  Send
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/contexts/LanguageContext'
import { usePricingData } from '@/hooks/usePricingData'
import { calculateBookingPrice, type PriceCalculationResult } from '@/lib/price-calculator'
import { PaymentModal, type PaymentData, type PaymentMode } from './PaymentModal'
import { ConfirmationModal } from './ConfirmationModal'
import type { OrderWithRelations, Payment } from '@/lib/supabase/types'

interface AccountingModalProps {
  orderId: string
  onClose: () => void
  onCloseOrder?: (orderId: string) => void
  isDark: boolean
  branchId: string
}

type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'guaranteed'

export function AccountingModal({
  orderId,
  onClose,
  onCloseOrder,
  isDark,
  branchId,
}: AccountingModalProps) {
  const { t, locale } = useTranslation()
  const [order, setOrder] = useState<OrderWithRelations | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [notification, setNotification] = useState<{
    isOpen: boolean
    type: 'success' | 'warning' | 'info'
    title: string
    message: string
  }>({ isOpen: false, type: 'info', title: '', message: '' })

  const { products, eventFormulas, rooms, loading: loadingPricing } = usePricingData(branchId)

  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    // Load order with relations
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

    // Load payments for this order
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    if (paymentsData) {
      setPayments(paymentsData as Payment[])
    }

    setLoading(false)
  }, [orderId, t])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  // Calcul du prix basé sur les données de la commande
  const getPriceCalculation = (): PriceCalculationResult | null => {
    try {
      if (!order || loadingPricing) return null
      if (!products || !Array.isArray(products) || products.length === 0) return null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const booking = order.booking as any
      if (!booking) return null

      const bookingType = order.order_type as 'GAME' | 'EVENT'
      if (!bookingType) return null

      const gameArea = (order.game_area || 'ACTIVE') as 'ACTIVE' | 'LASER' | 'CUSTOM'
      const participants = order.participants_count || 0

      if (participants < 1) return null

      let laserGames = 0
      let activeDuration = 0

      const slots = booking?.slots
      if (slots && Array.isArray(slots) && slots.length > 0) {
        slots.forEach((slot: any) => {
          if (slot?.area === 'LASER') {
            laserGames++
          } else if (slot?.area === 'ACTIVE') {
            activeDuration += slot?.duration_minutes || 30
          }
        })
      } else {
        if (gameArea === 'LASER' || gameArea === 'CUSTOM') {
          laserGames = (order as any).laser_games_count || 1
        }
        if (gameArea === 'ACTIVE' || gameArea === 'CUSTOM') {
          activeDuration = (order as any).active_duration || 60
        }
      }

      const safeProducts = products || []
      const safeEventFormulas = eventFormulas || []
      const safeRooms = rooms || []

      let eventQuickPlan = 'AA'
      if (bookingType === 'EVENT') {
        if (gameArea === 'LASER') eventQuickPlan = 'LL'
        else if (gameArea === 'ACTIVE') eventQuickPlan = 'AA'
        else eventQuickPlan = 'AL'
      }

      return calculateBookingPrice({
        bookingType,
        gameArea,
        participants,
        numberOfGames: laserGames || 1,
        gameDurations: activeDuration > 0 ? [String(activeDuration)] : ['60'],
        eventQuickPlan,
        eventRoomId: null, // Laisser le calcul utiliser formula.room_id (icount_rooms)
        products: safeProducts,
        eventFormulas: safeEventFormulas,
        rooms: safeRooms,
      })
    } catch (error) {
      console.error('Error calculating price:', error)
      return null
    }
  }

  // Helper pour afficher le type de jeu avec la zone
  const getGameLabel = (): string => {
    if (!order) return ''

    // Même logique pour GAME et EVENT
    if (order.game_area === 'LASER') return 'Laser City'
    if (order.game_area === 'MIX' || order.game_area === 'CUSTOM') return 'Active + Laser'
    if (order.game_area === 'ACTIVE') return 'Active Games'

    // Fallback sur event_type pour les anciennes commandes EVENT
    if (order.order_type === 'EVENT') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderAny = order as any
      if (orderAny.event_type === 'event_active') return 'Active Games'
      if (orderAny.event_type === 'event_laser') return 'Laser City'
      if (orderAny.event_type === 'event_mix') return 'Active + Laser'
    }

    return 'Active Games'
  }

  const getPaymentStatus = (): PaymentStatus => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderAny = order as any

    // Si la commande est clôturée, elle est considérée comme payée
    if (orderAny?.status === 'closed') return 'paid'

    // Check payment_status field first
    if (orderAny?.payment_status === 'fully_paid') return 'paid'
    if (orderAny?.payment_status === 'deposit_paid') return 'partial'
    if (orderAny?.payment_status === 'card_authorized') return 'guaranteed'

    // Fallback to legacy check - check icount_invrec_id on order itself
    if (orderAny?.icount_invrec_id) return 'paid'
    return 'unpaid'
  }

  // Calculate totals from payments
  const totalPaid = payments.reduce((sum, p) => {
    if (p.status === 'completed') return sum + (p.amount || 0)
    return sum
  }, 0)

  // Handle payment submission
  const handlePaymentSubmit = async (data: PaymentData): Promise<{ success: boolean; error?: string }> => {
    try {
      // Si mode pré-autorisation, appeler l'API preauth
      if (data.mode === 'preauth') {
        const response = await fetch(`/api/orders/${orderId}/preauth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: data.amount,
            cardInfo: data.cardInfo,
            saveCard: data.saveCard,
          }),
        })

        const result = await response.json()

        if (result.success) {
          // Ne pas recharger immédiatement - laisser l'utilisateur voir le message de succès
          return { success: true }
        } else {
          return { success: false, error: result.error }
        }
      }

      // Mode paiement normal
      const response = await fetch(`/api/orders/${orderId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        // Ne pas recharger immédiatement - laisser l'utilisateur voir le message de succès
        // Le rechargement se fera quand le modal se ferme
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (err) {
      console.error('Payment error:', err)
      return { success: false, error: 'Network error' }
    }
  }

  // Handle send invoice email
  const handleSendInvoice = async () => {
    if (sendingInvoice) return

    setSendingInvoice(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/send-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json()

      if (result.success) {
        setNotification({
          isOpen: true,
          type: 'success',
          title: t('admin.invoice.success_title') || 'Facture envoyée',
          message: t('admin.invoice.success') || 'La facture a été envoyée avec succès au client.',
        })
      } else {
        const errorMsg = result.messageKey ? t(result.messageKey) : result.error
        setNotification({
          isOpen: true,
          type: 'warning',
          title: t('admin.common.error') || 'Erreur',
          message: errorMsg || 'Échec de l\'envoi de la facture',
        })
      }
    } catch (err) {
      console.error('Send invoice error:', err)
      setNotification({
        isOpen: true,
        type: 'warning',
        title: t('admin.common.error') || 'Erreur',
        message: t('errors.networkError') || 'Erreur réseau',
      })
    } finally {
      setSendingInvoice(false)
    }
  }

  const getPaymentStatusConfig = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return {
          label: t('admin.accounting.status.paid'),
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: isDark ? 'bg-green-500/10' : 'bg-green-50',
          borderColor: 'border-green-500/20'
        }
      case 'partial':
        return {
          label: t('admin.accounting.status.partial'),
          icon: Clock,
          color: 'text-amber-500',
          bgColor: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
          borderColor: 'border-amber-500/20'
        }
      case 'guaranteed':
        return {
          label: t('admin.accounting.status.guaranteed'),
          icon: CreditCard,
          color: 'text-blue-500',
          bgColor: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
          borderColor: 'border-blue-500/20'
        }
      default:
        return {
          label: t('admin.accounting.status.unpaid'),
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: isDark ? 'bg-red-500/10' : 'bg-red-50',
          borderColor: 'border-red-500/20'
        }
    }
  }

  if (loading || loadingPricing) {
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

  const priceCalculation = getPriceCalculation()
  const paymentStatus = getPaymentStatus()
  const statusConfig = getPaymentStatusConfig(paymentStatus)
  const StatusIcon = statusConfig.icon
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const booking = order.booking as any

  const participants = order.participants_count || 0
  const unitPrice = priceCalculation?.details?.unitPrice || 0
  const unitLabel = priceCalculation?.details?.unitLabel || ''
  const roomPrice = priceCalculation?.details?.roomPrice
  const roomName = priceCalculation?.details?.roomName

  // Format date for display
  const bookingDate = booking?.start_datetime
    ? new Date(booking.start_datetime).toLocaleDateString(getDateLocale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : null

  const bookingTime = booking?.start_datetime
    ? new Date(booking.start_datetime).toLocaleTimeString(getDateLocale(), {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`rounded-2xl border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Receipt className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.accounting.title')}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Hash className={`w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <span className={`text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {order.request_reference || booking?.reference_code || 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Layout horizontal */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-px lg:bg-gray-200 dark:lg:bg-gray-700">

            {/* COLONNE GAUCHE - Détails & Prix */}
            <div className={`p-6 space-y-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>

              {/* Infos rapides */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.orders.table.date')}
                    </span>
                  </div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {bookingDate || '-'}
                  </p>
                  {bookingTime && (
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {bookingTime}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.orders.table.players')}
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {participants}
                  </p>
                </div>
              </div>

              {/* Tableau des lignes - Style iCount */}
              <div>
                <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('admin.accounting.price_breakdown')}
                </h3>

                {priceCalculation && priceCalculation.valid ? (
                  <div className={`rounded-xl border overflow-hidden ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                    {/* Header du tableau */}
                    <div className={`grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium ${
                      isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-50 text-gray-500'
                    }`}>
                      <div className="col-span-6">{t('admin.accounting.description')}</div>
                      <div className="col-span-2 text-center">{t('admin.accounting.qty')}</div>
                      <div className="col-span-2 text-right">{t('admin.accounting.unit_price')}</div>
                      <div className="col-span-2 text-right">{t('admin.common.total')}</div>
                    </div>

                    {/* Lignes */}
                    <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
                      {/* Ligne principale - Participants */}
                      <div className={`grid grid-cols-12 gap-2 px-4 py-3 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <div className="col-span-6">
                          <span className="font-medium">
                            {getGameLabel()}
                          </span>
                          {unitLabel && (
                            <span className={`block text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {unitLabel}
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 text-center">{participants}</div>
                        <div className="col-span-2 text-right">{unitPrice.toLocaleString()} ₪</div>
                        <div className={`col-span-2 text-right font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {(participants * unitPrice).toLocaleString()} ₪
                        </div>
                      </div>

                      {/* Ligne Salle si EVENT */}
                      {roomPrice && roomPrice > 0 && (
                        <div className={`grid grid-cols-12 gap-2 px-4 py-3 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          <div className="col-span-6">
                            <span className="font-medium">{t('admin.accounting.room')}</span>
                            {roomName && (
                              <span className={`block text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {roomName}
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 text-center">1</div>
                          <div className="col-span-2 text-right">{roomPrice.toLocaleString()} ₪</div>
                          <div className={`col-span-2 text-right font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {roomPrice.toLocaleString()} ₪
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer - Totaux */}
                    <div className={`px-4 py-3 space-y-2 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                      {/* Sous-total si remise */}
                      {priceCalculation.discountAmount > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                              {t('admin.accounting.subtotal')}
                            </span>
                            <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                              {priceCalculation.subtotal.toLocaleString()} ₪
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-green-500">
                            <span>
                              {t('admin.accounting.discount')}
                              {priceCalculation.details?.discountType === 'percent' && priceCalculation.details?.discountValue && (
                                <span className="ml-1">({priceCalculation.details.discountValue}%)</span>
                              )}
                            </span>
                            <span>-{priceCalculation.discountAmount.toLocaleString()} ₪</span>
                          </div>
                        </>
                      )}

                      {/* Total final */}
                      <div className={`flex justify-between items-center pt-2 ${
                        priceCalculation.discountAmount > 0 ? `border-t ${isDark ? 'border-gray-600' : 'border-gray-200'}` : ''
                      }`}>
                        <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {t('admin.common.total')}
                        </span>
                        <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {priceCalculation.total.toLocaleString()} ₪
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-6 rounded-xl border text-center ${
                    isDark ? 'bg-gray-700/30 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}>
                    {t('admin.accounting.no_price_data')}
                  </div>
                )}
              </div>
            </div>

            {/* COLONNE DROITE - Statut & Actions */}
            <div className={`p-6 space-y-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>

              {/* Statut de paiement - Card principale */}
              <div className={`p-4 rounded-xl border-2 ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'}`}>
                      <StatusIcon className={`w-6 h-6 ${statusConfig.color}`} />
                    </div>
                    <div>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('admin.accounting.payment_status')}
                      </p>
                      <p className={`text-lg font-semibold ${statusConfig.color}`}>
                        {statusConfig.label}
                      </p>
                    </div>
                  </div>
                  {/* Bouton Ajouter paiement */}
                  {paymentStatus !== 'paid' && priceCalculation?.valid && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isDark
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      {t('admin.payment.add_payment')}
                    </button>
                  )}
                </div>

                {/* Montant payé / restant */}
                {priceCalculation?.valid && (
                  <div className={`mt-4 pt-4 border-t space-y-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    {totalPaid > 0 && (
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {t('admin.payment.already_paid')}
                        </span>
                        <span className="text-green-500 font-medium">
                          {totalPaid.toLocaleString()} ₪
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('admin.accounting.amount_due')}
                      </span>
                      <span className={`text-xl font-bold ${
                        paymentStatus === 'paid' ? 'text-green-500' : isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {Math.max(0, priceCalculation.total - totalPaid).toLocaleString()} ₪
                      </span>
                    </div>
                  </div>
                )}

                {/* Indicateur de pré-autorisation existante */}
                {Boolean((order as unknown as Record<string, unknown>).preauth_code) && (
                  <div className={`mt-4 p-4 rounded-xl border ${
                    isDark ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-200 bg-blue-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                        <ShieldCheck className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                          {t('admin.payment.preauth_info_title')}
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className={`text-sm ${isDark ? 'text-blue-400/70' : 'text-blue-600/70'}`}>
                            {((order as unknown as Record<string, unknown>).preauth_amount as number)?.toLocaleString()} ₪
                          </span>
                          <span className={`text-xs font-mono ${isDark ? 'text-blue-400/50' : 'text-blue-600/50'}`}>
                            •••• {(order as unknown as Record<string, unknown>).preauth_cc_last4 as string}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Historique des paiements */}
              {payments.length > 0 && (
                <div>
                  <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('admin.payment.title')}
                  </h3>
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          payment.payment_method === 'card'
                            ? isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                            : payment.payment_method === 'cash'
                              ? isDark ? 'bg-green-500/20' : 'bg-green-100'
                              : isDark ? 'bg-gray-600' : 'bg-gray-200'
                        }`}>
                          {payment.payment_method === 'card' ? (
                            <CreditCard className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                          ) : payment.payment_method === 'cash' ? (
                            <Banknote className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                          ) : (
                            <Receipt className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {payment.amount.toLocaleString()} ₪
                            </p>
                            {payment.status === 'completed' && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {new Date(payment.created_at).toLocaleDateString(getDateLocale(), {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {payment.cc_last4 && (
                              <span className="ml-2 font-mono">•••• {payment.cc_last4}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Indicateur de commande clôturée */}
              {(order as unknown as Record<string, unknown>).status === 'closed' && (
                <div className={`p-4 rounded-xl border-2 ${
                  isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                      <CheckCheck className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    </div>
                    <div>
                      <p className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                        {t('admin.orders.status.closed')}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-purple-400/70' : 'text-purple-600/70'}`}>
                        {(order as unknown as Record<string, unknown>).closed_at
                          ? new Date((order as unknown as Record<string, unknown>).closed_at as string).toLocaleDateString(getDateLocale(), {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Documents iCount */}
              <div>
                <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('admin.accounting.documents')}
                </h3>

                <div className="space-y-2">
                  {/* Facture+Reçu iCount - depuis l'order */}
                  {(order as unknown as Record<string, unknown>).icount_invrec_id ? (
                    (order as unknown as Record<string, unknown>).icount_invrec_url ? (
                      <a
                        href={(order as unknown as Record<string, unknown>).icount_invrec_url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isDark
                            ? 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20'
                            : 'bg-green-50 border-green-200 hover:bg-green-100'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                          <Receipt className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                            {t('admin.accounting.invoice')}
                          </p>
                          <p className={`text-xs font-mono ${isDark ? 'text-green-500/70' : 'text-green-600/70'}`}>
                            #{String((order as unknown as Record<string, unknown>).icount_invrec_id)}
                          </p>
                        </div>
                        <ExternalLink className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                      </a>
                    ) : (
                      <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200'
                      }`}>
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                          <Receipt className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                            {t('admin.accounting.invoice')}
                          </p>
                          <p className={`text-xs font-mono ${isDark ? 'text-green-500/70' : 'text-green-600/70'}`}>
                            #{String((order as unknown as Record<string, unknown>).icount_invrec_id)}
                          </p>
                        </div>
                        <CheckCircle className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                      </div>
                    )
                  ) : (
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                      isDark ? 'bg-gray-700/30 border-gray-700 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                      <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{t('admin.accounting.invoice')}</p>
                        <p className="text-xs">{t('admin.accounting.not_generated')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Actions rapides - Placeholder pour le futur */}
              {/*
              <div>
                <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Actions rapides
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button className="...">Envoyer rappel</button>
                  <button className="...">Marquer payé</button>
                  <button className="...">Générer facture</button>
                  <button className="...">Ajouter paiement</button>
                </div>
              </div>
              */}

              {/* Section Historique - Placeholder pour le futur */}
              {/*
              <div>
                <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Historique
                </h3>
                <div className="space-y-2">
                  Timeline des événements: création, envoi devis, paiement, etc.
                </div>
              </div>
              */}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-between ${
          isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        }`}>
          {/* Boutons à gauche */}
          <div className="flex items-center gap-2">
            {/* Bouton Clôturer - visible uniquement si commande non fermée */}
            {onCloseOrder && order?.status !== 'closed' && order?.status !== 'cancelled' && (
              <button
                onClick={() => {
                  onClose()
                  onCloseOrder(orderId)
                }}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  isDark
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                <CheckCheck className="w-4 h-4" />
                {t('admin.orders.close_order')}
              </button>
            )}
            {/* Bouton Envoyer facture - visible uniquement si commande fermée avec facture */}
            {order?.status === 'closed' && Boolean((order as unknown as Record<string, unknown>).icount_invrec_url) && (
              <button
                onClick={handleSendInvoice}
                disabled={sendingInvoice}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  sendingInvoice
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : isDark
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {sendingInvoice ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {t('admin.invoice.send_invoice')}
              </button>
            )}
          </div>
          {/* Bouton Fermer - à droite */}
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg transition-colors ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {t('admin.common.close')}
          </button>
        </div>
      </div>

      {/* PaymentModal */}
      {showPaymentModal && priceCalculation?.valid && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false)
            loadOrder() // Recharger les données après fermeture du modal
          }}
          onSubmit={handlePaymentSubmit}
          orderId={orderId}
          orderRef={order.request_reference || booking?.reference_code || ''}
          totalAmount={priceCalculation.total}
          paidAmount={totalPaid}
          isDark={isDark}
          existingPreauth={
            (order as unknown as Record<string, unknown>).preauth_code
              ? {
                  code: (order as unknown as Record<string, unknown>).preauth_code as string,
                  amount: ((order as unknown as Record<string, unknown>).preauth_amount as number) || 0,
                  ccLast4: ((order as unknown as Record<string, unknown>).preauth_cc_last4 as string) || '',
                }
              : null
          }
          storedCard={
            (order.contact as unknown as Record<string, unknown>)?.icount_cc_token_id
              ? {
                  tokenId: (order.contact as unknown as Record<string, unknown>).icount_cc_token_id as number,
                  last4: ((order.contact as unknown as Record<string, unknown>).cc_last4 as string) || '',
                  type: ((order.contact as unknown as Record<string, unknown>).cc_type as string) || 'card',
                }
              : null
          }
        />
      )}

      {/* Notification Modal */}
      <ConfirmationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => setNotification(prev => ({ ...prev, isOpen: false }))}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        isDark={isDark}
      />
    </div>
  )
}
