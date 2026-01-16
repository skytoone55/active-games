'use client'

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
  Zap
} from 'lucide-react'
import type { OrderWithRelations } from '@/lib/supabase/types'

interface OrderDetailModalProps {
  order: OrderWithRelations
  onClose: () => void
  onConfirm: (orderId: string) => void
  onCancel: (orderId: string) => void
  onGoToAgenda: (date: string, bookingId?: string) => void
  onGoToClient: (contactId: string) => void
  isDark: boolean
}

export function OrderDetailModal({
  order,
  onClose,
  onConfirm,
  onCancel,
  onGoToAgenda,
  onGoToClient,
  isDark,
}: OrderDetailModalProps) {
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
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
          label: 'En attente de confirmation'
        }
      case 'auto_confirmed':
        return { 
          icon: CheckCircle, 
          color: 'text-green-500', 
          bg: 'bg-green-500/10',
          border: 'border-green-500/30',
          label: 'Confirmée automatiquement'
        }
      case 'manually_confirmed':
        return { 
          icon: CheckCircle, 
          color: 'text-blue-500', 
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          label: 'Confirmée manuellement'
        }
      case 'cancelled':
        return { 
          icon: XCircle, 
          color: 'text-gray-500', 
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30',
          label: 'Annulée'
        }
      default:
        return { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/30', label: order.status }
    }
  }

  const getGameIcon = () => {
    if (order.order_type === 'EVENT') return PartyPopper
    if (order.game_area === 'LASER') return Target
    if (order.game_area === 'MIX') return Gamepad2
    return Zap // Active Games
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
    if (order.game_area === 'MIX') return 'Mix Active + Laser'
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
                    {order.number_of_games} partie{order.number_of_games > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {order.customer_first_name} {order.customer_last_name || ''}
              </h2>
              <p className="text-white/80 text-sm">
                Commande {order.booking?.reference_code || order.request_reference}
              </p>
            </div>
          </div>
        </div>

        {/* Statut */}
        <div className={`mx-6 -mt-4 relative z-10 p-4 rounded-xl border ${statusInfo.bg} ${statusInfo.border}`}>
          <div className="flex items-center gap-3">
            <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
            <span className={`font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          {order.pending_reason && (
            <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Raison: {order.pending_details || order.pending_reason}
            </p>
          )}
        </div>

        {/* Contenu principal */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Colonne gauche - Infos réservation */}
          <div className="md:col-span-2 space-y-6">
            {/* Date & Heure */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Date & Heure
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
                      {formatTime(order.requested_time)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Participants
              </h3>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <p className={`font-bold text-3xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {order.participants_count}
                </p>
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>personnes</span>
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

            {/* Notes */}
            {order.customer_notes && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Notes du client
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
                Accès rapide
              </h3>
              
              {/* Bouton vers Agenda */}
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
                  <p className="font-medium">Voir dans l'agenda</p>
                  <p className={`text-xs ${isDark ? 'text-blue-400/70' : 'text-blue-500/70'}`}>
                    Ouvrir la réservation
                  </p>
                </div>
                <ExternalLink className="w-4 h-4" />
              </button>

              {/* Bouton vers Client */}
              {order.contact_id && (
                <button
                  onClick={() => onGoToClient(order.contact_id!)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isDark 
                      ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400' 
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-600'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <div className="text-left flex-1">
                    <p className="font-medium">Fiche client</p>
                    <p className={`text-xs ${isDark ? 'text-purple-400/70' : 'text-purple-500/70'}`}>
                      Voir dans le CRM
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Actions sur la commande */}
            {order.status === 'pending' && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      onConfirm(order.id)
                      onClose()
                    }}
                    className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Confirmer la commande
                  </button>
                  <button
                    onClick={() => {
                      onCancel(order.id)
                      onClose()
                    }}
                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Annuler la commande
                  </button>
                </div>
              </div>
            )}

            {/* Infos supplémentaires */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Informations
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Créée le</span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {new Date(order.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Source</span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    Site internet
                  </span>
                </div>
                {order.branch?.name && (
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Branche</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {order.branch.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
