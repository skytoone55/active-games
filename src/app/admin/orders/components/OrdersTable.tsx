'use client'

import React, { useState, useMemo, useRef } from 'react'
import { 
  Clock, 
  CheckCircle, 
  Users,
  ChevronUp,
  ChevronDown,
  ChevronDown as FilterIcon,
  X,
  Gamepad2,
  Target,
  PartyPopper,
  Zap,
  XCircle
} from 'lucide-react'
import type { OrderWithRelations, OrderStatus, GameArea } from '@/lib/supabase/types'

type SortField = 'date' | 'time' | 'client' | 'status' | 'participants' | 'type' | 'created' | 'source'
type SortDirection = 'asc' | 'desc'

interface OrdersTableProps {
  orders: OrderWithRelations[]
  isDark: boolean
  onCancel: (orderId: string) => void
  onViewOrder: (order: OrderWithRelations) => void
  onViewClient: (contactId: string) => void
}

// Composant Dropdown pour les filtres (position fixed pour éviter overflow)
function FilterDropdown({ 
  label, 
  options, 
  value, 
  onChange, 
  isDark 
}: { 
  label: string
  options: { value: string; label: string; color?: string }[]
  value: string
  onChange: (value: string) => void
  isDark: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const selectedOption = options.find(o => o.value === value)
  
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    setIsOpen(!isOpen)
  }
  
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider ${
          value !== 'all' 
            ? 'text-blue-500' 
            : isDark ? 'text-gray-400' : 'text-gray-600'
        } hover:text-blue-500`}
      >
        {label}
        {value !== 'all' && (
          <span className="text-[10px] bg-blue-500 text-white px-1 rounded">
            {selectedOption?.label}
          </span>
        )}
        <FilterIcon className="w-3 h-3" />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            className={`fixed z-50 rounded-lg shadow-lg border min-w-[140px] ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
            style={{ top: position.top, left: position.left }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm first:rounded-t-lg last:rounded-b-lg ${
                  value === option.value
                    ? 'bg-blue-500 text-white'
                    : isDark
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 500, 1000]

export function OrdersTable({ orders, isDark, onCancel, onViewOrder, onViewClient }: OrdersTableProps) {
  const [sortField, setSortField] = useState<SortField>('created')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Filtres
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [gameAreaFilter, setGameAreaFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Appliquer les filtres
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (typeFilter !== 'all' && order.order_type !== typeFilter) return false
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (gameAreaFilter !== 'all' && order.game_area !== gameAreaFilter) return false
      if (sourceFilter !== 'all' && order.source !== sourceFilter) return false
      return true
    })
  }, [orders, typeFilter, statusFilter, gameAreaFilter, sourceFilter])

  // Trier
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
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
        case 'source':
          comparison = (a.source || '').localeCompare(b.source || '')
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredOrders, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage)
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return sortedOrders.slice(start, start + itemsPerPage)
  }, [sortedOrders, currentPage, itemsPerPage])

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [typeFilter, statusFilter, gameAreaFilter, sourceFilter, itemsPerPage])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 inline ml-1" />
      : <ChevronDown className="w-3 h-3 inline ml-1" />
  }
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (time: string) => {
    return time.slice(0, 5)
  }

  const getStatusDisplay = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'En attente' }
      case 'auto_confirmed':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Confirmé' }
      case 'manually_confirmed':
        return { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Confirmé' }
      case 'cancelled':
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-gray-100 dark:bg-gray-700', label: 'Annulé' }
      default:
        return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: status }
    }
  }

  const getGameIcon = (orderType: string, gameArea: string | null) => {
    if (orderType === 'EVENT') return PartyPopper
    if (gameArea === 'LASER') return Target
    return Zap // Active Games (ACTIVE par défaut)
  }

  // Options des filtres
  const typeOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'GAME', label: 'Game' },
    { value: 'EVENT', label: 'Event' },
  ]

  const statusOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'pending', label: 'En attente' },
    { value: 'auto_confirmed', label: 'Auto confirmé' },
    { value: 'manually_confirmed', label: 'Confirmé manuel' },
    { value: 'cancelled', label: 'Annulé' },
  ]

  const gameAreaOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'LASER', label: 'Laser' },
    { value: 'MIX', label: 'Mix' },
  ]

  const sourceOptions = [
    { value: 'all', label: 'Toutes' },
    { value: 'admin_agenda', label: 'Admin' },
    { value: 'website', label: 'Site web' },
  ]

  // Vérifier si des filtres sont actifs
  const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all' || gameAreaFilter !== 'all' || sourceFilter !== 'all'

  const clearAllFilters = () => {
    setTypeFilter('all')
    setStatusFilter('all')
    setGameAreaFilter('all')
    setSourceFilter('all')
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
      {/* Header avec filtres */}
      <div className={`grid grid-cols-12 gap-2 px-4 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
        <div className="col-span-1">
          <FilterDropdown
            label="Type"
            options={typeOptions}
            value={typeFilter}
            onChange={setTypeFilter}
            isDark={isDark}
          />
        </div>
        <div className="col-span-1">
          <FilterDropdown
            label="Statut"
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            isDark={isDark}
          />
        </div>
        <div className="col-span-2">
          <button
            onClick={() => handleSort('client')}
            className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'} hover:text-blue-500`}
          >
            Client<SortIcon field="client" />
          </button>
        </div>
        <div className="col-span-1">
          <button
            onClick={() => handleSort('date')}
            className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'} hover:text-blue-500`}
          >
            Date<SortIcon field="date" />
          </button>
        </div>
        <div className="col-span-1">
          <button
            onClick={() => handleSort('time')}
            className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'} hover:text-blue-500`}
          >
            Heure<SortIcon field="time" />
          </button>
        </div>
        <div className="col-span-1">
          <button
            onClick={() => handleSort('created')}
            className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'} hover:text-blue-500`}
          >
            Créé<SortIcon field="created" />
          </button>
        </div>
        <div className="col-span-1">
          <button
            onClick={() => handleSort('participants')}
            className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'} hover:text-blue-500`}
          >
            Pers.<SortIcon field="participants" />
          </button>
        </div>
        <div className="col-span-1">
          {typeFilter === 'GAME' ? (
            <FilterDropdown
              label="Zone"
              options={gameAreaOptions}
              value={gameAreaFilter}
              onChange={setGameAreaFilter}
              isDark={isDark}
            />
          ) : (
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Zone
            </span>
          )}
        </div>
        <div className="col-span-1">
          <FilterDropdown
            label="Source"
            options={sourceOptions}
            value={sourceFilter}
            onChange={setSourceFilter}
            isDark={isDark}
          />
        </div>
        <div className="col-span-2 flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Référence
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <X className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Compteur résultats */}
      {hasActiveFilters && (
        <div className={`px-4 py-2 text-xs ${isDark ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-50 text-gray-500'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {sortedOrders.length} résultat{sortedOrders.length !== 1 ? 's' : ''} sur {orders.length} commande{orders.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Rows - hauteur minimale */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 min-h-[300px]">
        {paginatedOrders.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Aucune commande ne correspond aux filtres
          </div>
        ) : (
          paginatedOrders.map((order) => {
            const statusDisplay = getStatusDisplay(order.status)
            const StatusIcon = statusDisplay.icon
            const GameIcon = getGameIcon(order.order_type, order.game_area)
            
            return (
              <div 
                key={order.id}
                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                  order.status === 'pending' ? 'bg-red-50/30 dark:bg-red-900/10' : ''
                } ${order.status === 'cancelled' ? 'opacity-60' : ''}`}
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

                {/* Date */}
                <div className={`col-span-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {order.booking?.start_datetime 
                    ? formatDate(order.booking.start_datetime.split('T')[0])
                    : formatDate(order.requested_date)}
                </div>

                {/* Heure */}
                <div className={`col-span-1 text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {order.booking?.start_datetime 
                    ? new Date(order.booking.start_datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : formatTime(order.requested_time)}
                </div>

                {/* Date création */}
                <div className={`col-span-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {new Date(order.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit'
                  })}
                </div>

                {/* Personnes */}
                <div className="col-span-1 flex items-center gap-1 text-sm">
                  <Users className="w-3 h-3 text-gray-400" />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{order.participants_count}</span>
                </div>

                {/* Zone */}
                <div className="col-span-1">
                  {order.order_type === 'GAME' && order.game_area && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      order.game_area === 'LASER'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {order.game_area}
                    </span>
                  )}
                </div>

                {/* Source */}
                <div className="col-span-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    order.source === 'admin_agenda'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                  }`}>
                    {order.source === 'admin_agenda' ? 'Admin' : 'Site'}
                  </span>
                </div>

                {/* Référence */}
                <div className="col-span-2 text-xs font-mono">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    {order.booking?.reference_code || order.request_reference}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-4">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {sortedOrders.length} commande{sortedOrders.length !== 1 ? 's' : ''}
            {totalPages > 1 && ` • Page ${currentPage}/${totalPages}`}
          </div>
          
          {/* Sélecteur nombre de lignes */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Afficher</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className={`px-2 py-1 rounded text-sm border ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 text-gray-300' 
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>lignes</span>
          </div>
        </div>
        
        {/* Navigation pages */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              «
            </button>
            <span className={`px-3 py-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              »»
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
