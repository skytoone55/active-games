'use client'

import { useState } from 'react'
import {
  X,
  Calendar,
  Clock,
  Users,
  Phone,
  Mail,
  MessageSquare,
  Gamepad2,
  Target,
  PartyPopper,
  ExternalLink,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  RefreshCw,
  Send,
  Loader2,
  FileText,
  FileCheck,
  AlertTriangle,
  Receipt
} from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import type { OrderWithRelations } from '@/lib/supabase/types'
import { formatIsraelTime } from '@/lib/dates'

interface OrderDetailModalProps {
  order: OrderWithRelations
  onClose: () => void
  onCancel: (orderId: string) => void
  onRecreate?: (orderId: string) => void
  onResendEmail?: (orderId: string) => Promise<{ success: boolean; error?: string }>
  onResendCgvReminder?: (orderId: string) => Promise<{ success: boolean; error?: string }>
  onGoToAgenda: (date: string, bookingId?: string) => void
  onGoToClient: (contactId: string) => void
  onOpenAccounting?: (orderId: string) => void
  isDark: boolean
  canEdit?: boolean // Permission de modifier (recréer, renvoyer email)
  canDelete?: boolean // Permission d'annuler une commande
}

export function OrderDetailModal({
  order,
  onClose,
  onCancel,
  onRecreate,
  onResendEmail,
  onResendCgvReminder,
  onGoToAgenda,
  onGoToClient,
  onOpenAccounting,
  isDark,
  canEdit = true,
  canDelete = true,
}: OrderDetailModalProps) {
  const { t, locale } = useTranslation()
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sendingCgv, setSendingCgv] = useState(false)
  const [cgvSent, setCgvSent] = useState(false)
  const [cgvError, setCgvError] = useState<string | null>(null)

  const handleResendEmail = async () => {
    if (!onResendEmail || !order.customer_email) return

    setSendingEmail(true)
    setEmailError(null)

    try {
      const result = await onResendEmail(order.id)
      if (result.success) {
        setEmailSent(true)
        setTimeout(() => setEmailSent(false), 3000)
      } else {
        setEmailError(result.error || t('admin.orders.resend_email_error'))
      }
    } catch {
      setEmailError(t('admin.orders.resend_email_error'))
    } finally {
      setSendingEmail(false)
    }
  }

  const handleResendCgvReminder = async () => {
    if (!onResendCgvReminder || !order.customer_email) return

    setSendingCgv(true)
    setCgvError(null)

    try {
      const result = await onResendCgvReminder(order.id)
      if (result.success) {
        setCgvSent(true)
        setTimeout(() => setCgvSent(false), 3000)
      } else {
        setCgvError(result.error || t('admin.orders.resend_cgv_error') || 'Erreur lors de l\'envoi')
      }
    } catch {
      setCgvError(t('admin.orders.resend_cgv_error') || 'Erreur lors de l\'envoi')
    } finally {
      setSendingCgv(false)
    }
  }

  // Helper pour obtenir la locale de date en fonction de la langue
  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(getDateLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatTime = (time: string) => {
    return time.slice(0, 5)
  }

  const getStatusInfo = () => {
    switch (order.status) {
      case 'pending':
        return {
          icon: AlertCircle,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
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
          color: 'text-gray-500',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30',
          label: t('admin.orders.status.cancelled')
        }
      default:
        return { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/30', label: order.status }
    }
  }

  const getGameIcon = () => {
    if (order.order_type === 'EVENT') return PartyPopper
    if (order.game_area === 'LASER') return Target
    return Zap // Active Games (ACTIVE par défaut)
  }

  const getGameLabel = () => {
    if (order.order_type === 'EVENT') {
      // Nouveaux types d'événements (basés sur le type de jeu)
      if (order.game_area === 'ACTIVE' || order.event_type === 'event_active') return 'Événement Active Games'
      if (order.game_area === 'LASER' || order.event_type === 'event_laser') return 'Événement Laser City'
      if (order.event_type === 'event_mix') return 'Événement Mix'
      // Anciens types (compatibilité)
      switch (order.event_type) {
        case 'birthday': return 'Anniversaire'
        case 'bar_mitzvah': return 'Bar/Bat Mitzvah'
        case 'corporate': return 'Team Building'
        case 'other': return 'Événement privé'
        default: return 'Événement'
      }
    }
    if (order.game_area === 'LASER') return 'Laser City'
    return 'Active Games'
  }

  const getGameColor = () => {
    if (order.order_type === 'EVENT') return 'text-green-500'
    if (order.game_area === 'LASER') return 'text-purple-500'
    return 'text-blue-500'
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon
  const GameIcon = getGameIcon()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className={`relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? 'bg-gray-900' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec gradient */}
        <div className={`relative p-6 ${
          order.status === 'pending'
            ? 'bg-gradient-to-r from-amber-600 to-orange-600'
            : order.status === 'aborted'
            ? 'bg-gradient-to-r from-orange-600 to-orange-700'
            : order.status === 'cancelled'
            ? 'bg-gradient-to-r from-gray-600 to-gray-700'
            : 'bg-gradient-to-r from-blue-600 to-cyan-600'
        }`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-start gap-4">
            {/* Icône type */}
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <GameIcon className="w-8 h-8 text-white" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
                  {getGameLabel()}
                </span>
                {order.number_of_games && order.order_type === 'GAME' && (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm">
                    {order.number_of_games} {order.number_of_games > 1 ? t('admin.orders.games_plural') : t('admin.orders.game_singular')}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {order.customer_first_name} {order.customer_last_name || ''}
              </h2>
              <p className="text-white/80 text-sm">
                {t('admin.orders.order_ref')} {order.booking?.reference_code || order.request_reference}
              </p>
            </div>
          </div>
        </div>

        {/* Statut - compact */}
        <div className={`mx-6 mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${statusInfo.bg} ${statusInfo.border} border`}>
          <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
          <span className={`font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>
        {order.pending_reason && (
          <p className={`mx-6 mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('admin.orders.reason')}: {order.pending_details || order.pending_reason}
          </p>
        )}

        {/* Contenu principal */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Colonne gauche - Infos réservation */}
          <div className="md:col-span-2 space-y-6">
            {/* Date & Heure */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.orders.table.date')} & {t('admin.orders.table.time')}
              </h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatDate(order.requested_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                    <Clock className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className={`font-medium text-2xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {order.booking?.start_datetime
                        ? formatIsraelTime(order.booking.start_datetime, getDateLocale())
                        : formatTime(order.requested_time)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.orders.table.players')}
              </h3>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <p className={`font-bold text-3xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {order.participants_count}
                </p>
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t('admin.common.players')}</span>
              </div>
            </div>

            {/* Contact */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Contact
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${order.customer_phone}`} className="text-blue-500 hover:underline">
                    {order.customer_phone}
                  </a>
                </div>
                {order.customer_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${order.customer_email}`} className="text-blue-500 hover:underline">
                      {order.customer_email}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* CGV Status - pour toutes les commandes */}
            <div className={`p-4 rounded-xl ${
              order.cgv_validated_at
                  ? isDark ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200'
                  : isDark ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-amber-50 border border-amber-200'
              }`}>
                <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('admin.orders.cgv.title') || 'Conditions Générales de Vente'}
                </h3>
                <div className="flex items-center gap-3">
                  {order.cgv_validated_at ? (
                    <>
                      <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-100'}`}>
                        <FileCheck className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                          {t('admin.orders.cgv.validated') || 'CGV Validées'}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-green-400/70' : 'text-green-600'}`}>
                          {new Date(order.cgv_validated_at).toLocaleDateString(getDateLocale(), {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`p-2 rounded-lg ${isDark ? 'bg-amber-900/30' : 'bg-amber-100'}`}>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className={`font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                          {t('admin.orders.cgv.pending') || 'En attente de validation'}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-amber-400/70' : 'text-amber-600'}`}>
                          {t('admin.orders.cgv.pending_desc') || 'Le client n\'a pas encore validé les CGV'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

            {/* Notes */}
            {order.customer_notes && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('admin.orders.table.notes')}
                </h3>
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-1" />
                  <p className={`whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {order.customer_notes}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite - Actions */}
          <div className="space-y-4">
            {/* Actions rapides */}
            <div className={`p-4 rounded-xl border-2 border-dashed ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.orders.quick_access')}
              </h3>
              
              {/* Bouton vers Agenda - grisé si annulé ou aborted */}
              {order.status === 'cancelled' || order.status === 'aborted' || !order.booking_id ? (
                <>
                  <div
                    className={`w-full mb-3 flex items-center gap-3 p-3 rounded-xl cursor-not-allowed ${
                      isDark 
                        ? 'bg-gray-700/50 text-gray-500' 
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                    <div className="text-left flex-1">
                      <p className="font-medium">{t('admin.orders.view_in_agenda')}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('admin.orders.booking_cancelled_or_deleted')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Bouton Réactiver - seulement si annulé ou aborted */}
                  {(order.status === 'cancelled' || order.status === 'aborted') && onRecreate && (
                    <button
                      onClick={() => canEdit && onRecreate(order.id)}
                      disabled={!canEdit}
                      title={!canEdit ? t('admin.common.no_permission') : undefined}
                      className={`w-full mb-3 flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        !canEdit
                          ? 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-400'
                          : isDark
                            ? 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                            : 'bg-green-50 hover:bg-green-100 text-green-600'
                      }`}
                    >
                      <RefreshCw className="w-5 h-5" />
                      <div className="text-left flex-1">
                        <p className="font-medium">{t('admin.orders.reactivate_booking')}</p>
                        <p className={`text-xs ${isDark ? 'text-green-400/70' : 'text-green-500/70'}`}>
                          {t('admin.orders.reactivate_description')}
                        </p>
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => onGoToAgenda(order.requested_date, order.booking?.id)}
                  className={`w-full mb-3 flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isDark 
                      ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400' 
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                  <div className="text-left flex-1">
                    <p className="font-medium">{t('admin.orders.view_in_agenda')}</p>
                    <p className={`text-xs ${isDark ? 'text-blue-400/70' : 'text-blue-500/70'}`}>
                      {t('admin.orders.open_booking')}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}

              {/* Bouton vers Client */}
              {order.contact_id && (
                <button
                  onClick={() => onGoToClient(order.contact_id!)}
                  className={`w-full mb-3 flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-600'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <div className="text-left flex-1">
                    <p className="font-medium">{t('admin.orders.client_card')}</p>
                    <p className={`text-xs ${isDark ? 'text-purple-400/70' : 'text-purple-500/70'}`}>
                      {t('admin.orders.view_in_crm')}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}

              {/* Bouton vers Devis iCount */}
              {order.booking?.icount_offer_url && (
                <a
                  href={order.booking.icount_offer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full mb-3 flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <div className="text-left flex-1">
                    <p className="font-medium">{t('admin.orders.view_offer')}</p>
                    <p className={`text-xs ${isDark ? 'text-emerald-400/70' : 'text-emerald-500/70'}`}>
                      {t('admin.orders.open_icount_offer')}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* Bouton Fiche Comptable */}
              {onOpenAccounting && (
                <button
                  onClick={() => onOpenAccounting(order.id)}
                  className={`w-full mb-3 flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400'
                      : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-600'
                  }`}
                >
                  <Receipt className="w-5 h-5" />
                  <div className="text-left flex-1">
                    <p className="font-medium">{t('admin.accounting.title')}</p>
                    <p className={`text-xs ${isDark ? 'text-cyan-400/70' : 'text-cyan-500/70'}`}>
                      {t('admin.accounting.price_breakdown')}
                    </p>
                  </div>
                </button>
              )}

              {/* Bouton Renvoyer Email de confirmation */}
              {onResendEmail && order.status !== 'cancelled' && order.status !== 'aborted' && (
                <button
                  onClick={handleResendEmail}
                  disabled={sendingEmail || !order.customer_email}
                  className={`w-full mb-3 flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    !order.customer_email
                      ? isDark
                        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : emailSent
                        ? isDark
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-green-50 text-green-600'
                        : emailError
                          ? isDark
                            ? 'bg-red-600/20 text-red-400'
                            : 'bg-red-50 text-red-600'
                          : isDark
                            ? 'bg-orange-600/20 hover:bg-orange-600/30 text-orange-400'
                            : 'bg-orange-50 hover:bg-orange-100 text-orange-600'
                  }`}
                >
                  {sendingEmail ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : emailSent ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <div className="text-left flex-1">
                    <p className="font-medium">
                      {emailSent
                        ? t('admin.orders.resend_email_success')
                        : t('admin.orders.resend_confirmation_email') || 'Renvoyer email de confirmation'
                      }
                    </p>
                    <p className={`text-xs ${
                      !order.customer_email
                        ? isDark ? 'text-gray-600' : 'text-gray-400'
                        : emailError
                          ? isDark ? 'text-red-400/70' : 'text-red-500/70'
                          : isDark ? 'text-orange-400/70' : 'text-orange-500/70'
                    }`}>
                      {!order.customer_email
                        ? t('admin.orders.no_email_address')
                        : emailError
                          ? emailError
                          : t('admin.orders.resend_confirmation_desc') || 'Inclut le lien de validation CGV'
                      }
                    </p>
                  </div>
                </button>
              )}

              {/* Bouton Renvoyer Rappel CGV - seulement pour orders admin avec CGV non validées et non fermées */}
              {onResendCgvReminder && order.status !== 'cancelled' && order.status !== 'aborted' && order.status !== 'closed' && order.source === 'admin_agenda' && !order.cgv_validated_at && (
                <button
                  onClick={handleResendCgvReminder}
                  disabled={sendingCgv || !order.customer_email}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    !order.customer_email
                      ? isDark
                        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : cgvSent
                        ? isDark
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-green-50 text-green-600'
                        : cgvError
                          ? isDark
                            ? 'bg-red-600/20 text-red-400'
                            : 'bg-red-50 text-red-600'
                          : isDark
                            ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-600'
                  }`}
                >
                  {sendingCgv ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : cgvSent ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <FileCheck className="w-5 h-5" />
                  )}
                  <div className="text-left flex-1">
                    <p className="font-medium">
                      {cgvSent
                        ? t('admin.orders.resend_cgv_success') || 'Rappel CGV envoyé'
                        : t('admin.orders.resend_cgv_reminder') || 'Envoyer rappel CGV'
                      }
                    </p>
                    <p className={`text-xs ${
                      !order.customer_email
                        ? isDark ? 'text-gray-600' : 'text-gray-400'
                        : cgvError
                          ? isDark ? 'text-red-400/70' : 'text-red-500/70'
                          : isDark ? 'text-amber-400/70' : 'text-amber-500/70'
                    }`}>
                      {!order.customer_email
                        ? t('admin.orders.no_email_address')
                        : cgvError
                          ? cgvError
                          : t('admin.orders.resend_cgv_desc') || 'Relancer le client pour valider les CGV'
                      }
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* Action Confirmer pour commandes pending */}
            {order.status === 'pending' && onRecreate && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('admin.common.actions')}
                </h3>
                <button
                  onClick={() => {
                    if (!canEdit) return
                    onRecreate(order.id)
                    onClose()
                  }}
                  disabled={!canEdit}
                  title={!canEdit ? t('admin.common.no_permission') : undefined}
                  className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    !canEdit
                      ? 'bg-gray-400 cursor-not-allowed opacity-50 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  <RefreshCw className="w-5 h-5" />
                  {t('admin.orders.actions.confirm')}
                </button>
              </div>
            )}

            {/* Infos supplémentaires */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.orders.informations')}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{t('admin.orders.created_on')}</span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {new Date(order.created_at).toLocaleDateString(getDateLocale())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{t('admin.orders.table.source')}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    order.source === 'admin_agenda'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                  }`}>
                    {order.source === 'admin_agenda' ? t('admin.common.source_admin') : t('admin.orders.source_website')}
                  </span>
                </div>
                {order.branch?.name && (
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{t('admin.orders.branch')}</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {order.branch.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer avec bouton d'annulation - masqué si annulé, aborted ou fermé */}
        {order.status !== 'cancelled' && order.status !== 'aborted' && order.status !== 'closed' && (
          <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
            <button
              onClick={() => {
                if (!canDelete) return
                onCancel(order.id)
                onClose()
              }}
              disabled={!canDelete}
              title={!canDelete ? t('admin.common.no_permission') : undefined}
              className={`py-2 px-4 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
                !canDelete
                  ? 'bg-gray-400 cursor-not-allowed opacity-50 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <XCircle className="w-4 h-4" />
              {t('admin.orders.actions.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
