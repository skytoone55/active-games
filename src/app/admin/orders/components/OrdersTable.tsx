'use client'

import { useState } from 'react'
import { 
  Clock, 
  CheckCircle, 
  Users,
  Calendar,
  Phone,
  Mail,
  ExternalLink,
  Gamepad2,
  Target,
  PartyPopper,
  Zap,
  User,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import Link from 'next/link'
import type { OrderWithRelations, OrderStatus } from '@/lib/supabase/types'

type SortField = 'date' | 'time' | 'client' | 'status' | 'participants' | 'type' | 'created'
type SortDirection = 'asc' | 'desc'

interface OrdersTableProps {
  orders: OrderWithRelations[]
  isDark: boolean
  onConfirm: (orderId: string) => void
  onCancel: (orderId: string) => void
  onViewOrder: (order: OrderWithRelations) => void
  onViewClient: (contactId: string) => void
}

export function OrdersTable({ orders, isDark, onConfirm, onCancel, onViewOrder, onViewClient }: OrdersTableProps) {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedOrders = [...orders].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'date':
        comparison = new Date(a.requested_date).getTime() - new Date(b.requested_date).getTime()
        break
      case 'time':
        comparison = a.requested_time.localeCompare(b.requested_time)
        break
      case 'client':
        comparison = (a.customer_first_name || '').localeCompare(b.customer_first_name || '')
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
      case 'participants':
        comparison = a.participants_count - b.participants_count
        break
      case 'type':
        comparison = a.order_type.localeCompare(b.order_type)
        break
      case 'created':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 inline ml-1" />
      : <ChevronDown className="w-3 h-3 inline ml-1" />
  }
  
  // Formater la date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
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
          color: 'text-red-600', 
          bg: 'bg-red-50', 
          label: 'En attente'
        }
      case 'auto_confirmed':
        return { 
          icon: CheckCircle, 
          color: 'text-green-600', 
          bg: 'bg-green-50', 
          label: 'Confirmé auto'
        }
      case 'manually_confirmed':
        return { 
          icon: CheckCircle, 
          color: 'text-blue-600', 
          bg: 'bg-blue-50', 
          label: 'Confirmé manuel'
        }
      case 'cancelled':
        return { 
          icon: CheckCircle, 
          color: 'text-gray-500', 
          bg: 'bg-gray-50', 
          label: 'Annulé'
        }
      default:
        return { 
          icon: Clock, 
          color: 'text-gray-500', 
          bg: 'bg-gray-50', 
          label: status
        }
    }
  }

  // Obtenir l'icône du type de jeu (cohérent avec BookingModal)
  const getGameIcon = (orderType: string, gameArea: string | null) => {
    if (orderType === 'EVENT') return PartyPopper
    if (gameArea === 'LASER') return Target
    if (gameArea === 'MIX') return Gamepad2
    return Zap // Active Games
  }

  if (orders.length === 0) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        Aucune commande trouvée
      </div>
    )
  }

  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
      {/* Header */}
      <div className={`grid grid-cols-12 gap-3 px-4 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider`}>
        <div className="col-span-1 cursor-pointer hover:text-blue-500" onClick={() => handleSort('type')}>
          Type<SortIcon field="type" />
        </div>
        <div className="col-span-1 cursor-pointer hover:text-blue-500" onClick={() => handleSort('status')}>
          Statut<SortIcon field="status" />
        </div>
        <div className="col-span-2 cursor-pointer hover:text-blue-500" onClick={() => handleSort('client')}>
          Client<SortIcon field="client" />
        </div>
        <div className="col-span-1 cursor-pointer hover:text-blue-500" onClick={() => handleSort('date')}>
          Date<SortIcon field="date" />
        </div>
        <div className="col-span-1 cursor-pointer hover:text-blue-500" onClick={() => handleSort('time')}>
          Heure<SortIcon field="time" />
        </div>
        <div className="col-span-1 cursor-pointer hover:text-blue-500" onClick={() => handleSort('created')}>
          Créé le<SortIcon field="created" />
        </div>
        <div className="col-span-1 cursor-pointer hover:text-blue-500" onClick={() => handleSort('participants')}>
          Pers.<SortIcon field="participants" />
        </div>
        <div className="col-span-2">Référence</div>
        <div className="col-span-2">Source</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedOrders.map((order) => {
          const statusDisplay = getStatusDisplay(order.status)
          const StatusIcon = statusDisplay.icon
          const GameIcon = getGameIcon(order.order_type, order.game_area)
          
          return (
            <div 
              key={order.id}
              className={`grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                order.status === 'pending' ? 'bg-red-50/30 dark:bg-red-900/10' : ''
              }`}
              onClick={() => onViewOrder(order)}
            >
              {/* Type */}
              <div className="col-span-1 flex items-center">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <GameIcon className={`w-4 h-4 ${
                    order.order_type === 'EVENT' ? 'text-green-500' :
                    order.game_area === 'LASER' ? 'text-purple-500' :
                    'text-blue-500'
                  }`} />
                </div>
              </div>

              {/* Statut */}
              <div className="col-span-1">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusDisplay.bg} ${statusDisplay.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  <span className="hidden xl:inline">{statusDisplay.label}</span>
                </div>
              </div>

              {/* Client */}
              <div 
                className="col-span-2"
                onClick={(e) => {
                  e.stopPropagation()
                  if (order.contact_id) {
                    onViewClient(order.contact_id)
                  }
                }}
              >
                <span className={`font-medium hover:underline cursor-pointer ${
                  order.contact_id ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-gray-400' : 'text-gray-600')
                }`}>
                  {order.customer_first_name} {order.customer_last_name || ''}
                </span>
                <div className="text-xs text-gray-500 mt-0.5">{order.customer_phone}</div>
              </div>

              {/* Date - utilise booking.booking_date si disponible pour avoir la date à jour */}
              <div className={`col-span-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {formatDate(order.booking?.booking_date || order.requested_date)}
              </div>

              {/* Heure - utilise booking.start_time si disponible */}
              <div className={`col-span-1 text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {order.booking?.start_time ? formatTime(order.booking.start_time) : formatTime(order.requested_time)}
              </div>

              {/* Date création */}
              <div className={`col-span-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {new Date(order.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit'
                })}
              </div>

              {/* Personnes */}
              <div className="col-span-1 flex items-center gap-1 text-sm">
                <Users className="w-3 h-3 text-gray-400" />
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{order.participants_count}</span>
              </div>

              {/* Référence */}
              <div className="col-span-2 text-xs font-mono">
                <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  {order.booking?.reference_code || order.request_reference}
                </div>
              </div>

              {/* Source */}
              <div className="col-span-2">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                  order.source === 'admin_agenda'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                }`}>
                  {order.source === 'admin_agenda' ? 'Admin' : 'Site'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
